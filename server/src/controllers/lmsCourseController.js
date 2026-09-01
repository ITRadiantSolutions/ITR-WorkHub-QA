import mongoose from "mongoose";
import Course from "../models/Course.js";
import Lecture from "../models/Lecture.js";
import CourseAssessment from "../models/CourseAssessment.js";
import CourseProgress from "../models/CourseProgress.js";
import CourseAssignment from "../models/CourseAssignment.js";
import CourseReview from "../models/CourseReview.js";
import LmsLearningReport from "../models/LmsLearningReport.js";
import { uploadAttachment, deleteAttachments, createReadUrl } from "../config/blobStorage.js";


const isManager = (user) => user.isSuperAdmin || ["manager", "admin"].includes(user.roles.lms);

const resolveThumbnail = (value) => (value && !value.startsWith("http") ? createReadUrl(value) : value);

const resolveLecture = (lecture) => {
  if (!lecture) return lecture;
  const obj = typeof lecture.toObject === "function" ? lecture.toObject() : lecture;
  return {
    ...obj,
    materials: (obj.materials || []).map((material) => ({
      ...material,
      fileUrl: resolveThumbnail(material.fileUrl),
    })),
  };
};

const resolveCourse = (course) => {
  if (!course) return course;
  const obj = typeof course.toObject === "function" ? course.toObject() : course;
  return {
    ...obj,
    thumbnail: resolveThumbnail(obj.thumbnail),
    lectures: Array.isArray(obj.lectures) && obj.lectures.length && typeof obj.lectures[0] === "object"
      ? obj.lectures.map(resolveLecture)
      : obj.lectures,
  };
};

const uploadMaterialFile = async (file, courseId) => {
  const { blobName } = await uploadAttachment({
    buffer: file.buffer,
    fileName: file.originalname,
    mimeType: file.mimetype,
    scope: "lms-course-materials",
    parentId: courseId,
  });
  return blobName;
};

const attachUploadedMaterials = async (materials, files, courseId) => {
  const pdfUploads = files?.pdfFiles || [];
  const videoUploads = files?.videoFiles || [];
  let pdfIdx = 0;
  let videoIdx = 0;

  const out = [];
  for (const material of materials || []) {
    if (material?.type === "pdf" && !material.fileUrl && pdfUploads[pdfIdx]) {
      out.push({ ...material, fileUrl: await uploadMaterialFile(pdfUploads[pdfIdx++], courseId) });
      continue;
    }
    if (material?.type === "video" && !material.fileUrl && videoUploads[videoIdx]) {
      out.push({ ...material, fileUrl: await uploadMaterialFile(videoUploads[videoIdx++], courseId) });
      continue;
    }
    out.push(material);
  }
  return out;
};

const parseMaterials = (materials) => {
  if (!materials) return [];
  return typeof materials === "string" ? JSON.parse(materials) : materials;
};

export const getPublishedCourses = async (req, res) => {
  const courses = await Course.find({ isPublished: true }).populate("lectures reviews").lean();
  res.json(courses.map(resolveCourse));
};

export const getAllCoursesAdmin = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });

  const courses = await Course.find().populate("creator", "name email").populate("lectures").populate("reviews").lean();
  const courseIds = courses.map((course) => course._id);
  const assessmentCounts = await CourseAssessment.aggregate([
    { $match: { course: { $in: courseIds } } },
    { $group: { _id: { course: "$course", type: "$assessmentType" }, count: { $sum: 1 } } },
  ]);
  const countMap = new Map(assessmentCounts.map((item) => [`${String(item._id.course)}:${item._id.type}`, item.count]));

  res.json(
    courses.map((course) => ({
      ...resolveCourse(course),
      lectureCount: course.lectures?.length || 0,
      quizCount: countMap.get(`${String(course._id)}:quiz`) || 0,
      assignmentCount: countMap.get(`${String(course._id)}:assignment`) || 0,
    })),
  );
};

export const getCreatorCourses = async (req, res) => {
  const courses = await Course.find({ creator: req.user._id }).lean();
  res.json(courses.map(resolveCourse));
};

export const getCourseById = async (req, res) => {
  const course = await Course.findById(req.params.courseId).populate("lectures reviews").lean();
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!course.isPublished && !isManager(req.user)) return res.status(404).json({ message: "Course not found" });
  res.json(resolveCourse(course));
};

export const getCoursesByIds = async (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ message: "ids parameter is required" });

  const filter = { _id: { $in: ids.split(",") } };
  if (!isManager(req.user)) filter.isPublished = true;
  const courses = await Course.find(filter).lean();
  res.json(courses.map(resolveCourse));
};

export const createCourse = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { title, subTitle, description, category, level, isPublished, creator } = req.body;
  if (!title || !category) return res.status(400).json({ message: "title and category are required" });

  const courseId = new mongoose.Types.ObjectId();
  let thumbnail;
  if (req.file) {
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "lms-course-thumbnails",
      parentId: courseId,
    });
    thumbnail = uploaded.blobName;
  }

  const course = await Course.create({
    _id: courseId,
    title,
    subTitle: subTitle || "",
    description: description || "",
    category,
    ...(level ? { level } : {}),
    thumbnail,
    creator: req.user.roles.lms === "admin" && creator ? creator : req.user._id,
    isPublished: isPublished === "true" || isPublished === true,
  });

  res.status(201).json(resolveCourse(course));
};

export const editCourse = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { courseId } = req.params;
  const { title, subTitle, description, category, level, isPublished } = req.body;

  const existingCourse = await Course.findById(courseId);
  if (!existingCourse) return res.status(404).json({ message: "Course not found" });

  let thumbnail;
  if (req.file) {
    const uploaded = await uploadAttachment({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      scope: "lms-course-thumbnails",
      parentId: courseId,
    });
    thumbnail = uploaded.blobName;
  }

  const updateData = {
    ...(title !== undefined ? { title } : {}),
    ...(subTitle !== undefined ? { subTitle } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(category !== undefined ? { category } : {}),
    ...(level ? { level } : {}),
    ...(isPublished !== undefined ? { isPublished: isPublished === "true" || isPublished === true } : {}),
    ...(thumbnail ? { thumbnail } : {}),
  };
  const course = await Course.findByIdAndUpdate(courseId, updateData, { new: true });

  if (thumbnail && existingCourse.thumbnail && existingCourse.thumbnail !== thumbnail) {
    deleteAttachments([existingCourse.thumbnail]).catch((error) => console.error("Failed to delete replaced course thumbnail:", error));
  }

  res.json(resolveCourse(course));
};

export const removeCourse = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });

  const course = await Course.findById(req.params.courseId).populate("lectures");
  if (!course) return res.status(404).json({ message: "Course not found" });

  const blobNames = [
    course.thumbnail,
    ...(course.lectures || []).flatMap((lecture) => (lecture.materials || []).map((material) => material.fileUrl)),
  ].filter(Boolean);

  await Promise.all([
    Lecture.deleteMany({ _id: { $in: course.lectures } }),
    CourseAssessment.deleteMany({ course: course._id }),
    CourseProgress.deleteMany({ course: course._id }),
    CourseAssignment.deleteMany({ course: course._id }),
    CourseReview.deleteMany({ course: course._id }),
    LmsLearningReport.updateMany({}, { $pull: { courses: { courseId: course._id } } }),
  ]);
  await course.deleteOne();
  await deleteAttachments(blobNames);

  res.json({ message: "Course removed successfully" });
};

export const createLecture = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { courseId } = req.params;
  const { chapterTitle, lectureTitle, materials, isPreviewFree } = req.body;
  if (!lectureTitle) return res.status(400).json({ message: "lectureTitle is required" });

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });

  const parsedMaterials = parseMaterials(materials);
  const uploadedMaterials = await attachUploadedMaterials(parsedMaterials, req.files, courseId);

  const lecture = await Lecture.create({
    chapterTitle: chapterTitle || "",
    lectureTitle,
    materials: uploadedMaterials,
    isPreviewFree: isPreviewFree === "true" || isPreviewFree === true,
  });

  if (!course.lectures.some((id) => String(id) === String(lecture._id))) {
    course.lectures.push(lecture._id);
    await course.save();
  }

  res.status(201).json({ lecture: resolveLecture(lecture), course: resolveCourse(course) });
};

export const getCourseLecture = async (req, res) => {
  const course = await Course.findById(req.params.courseId).populate("lectures").lean();
  if (!course) return res.status(404).json({ message: "Course not found" });
  if (!course.isPublished && !isManager(req.user)) return res.status(404).json({ message: "Course not found" });
  res.json(resolveCourse(course));
};

export const editLecture = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { lectureId } = req.params;
  const { lectureTitle, chapterTitle, materials, isPreviewFree } = req.body;

  const lecture = await Lecture.findById(lectureId);
  if (!lecture) return res.status(404).json({ message: "Lecture not found" });

  const previousMaterialUrls = (lecture.materials || []).map((material) => material.fileUrl).filter(Boolean);

  const parsedMaterials = parseMaterials(materials);
  const uploadedMaterials = await attachUploadedMaterials(parsedMaterials, req.files, String(lectureId));

  if (lectureTitle) lecture.lectureTitle = lectureTitle;
  if (chapterTitle !== undefined) lecture.chapterTitle = chapterTitle;
  if (materials !== undefined) lecture.materials = uploadedMaterials;
  if (isPreviewFree !== undefined) lecture.isPreviewFree = isPreviewFree === "true" || isPreviewFree === true;

  await lecture.save();

  const currentUrls = new Set((lecture.materials || []).map((material) => material.fileUrl));
  const staleUrls = previousMaterialUrls.filter((url) => !currentUrls.has(url));
  if (staleUrls.length) deleteAttachments(staleUrls).catch((error) => console.error("Failed to delete replaced lecture materials:", error));

  res.json(resolveLecture(lecture));
};

export const removeLecture = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { lectureId } = req.params;

  const lecture = await Lecture.findByIdAndDelete(lectureId);
  if (!lecture) return res.status(404).json({ message: "Lecture not found" });

  await Course.updateOne({ lectures: lectureId }, { $pull: { lectures: lectureId } });
  const blobNames = (lecture.materials || []).map((material) => material.fileUrl).filter(Boolean);
  if (blobNames.length) await deleteAttachments(blobNames);

  res.json({ message: "Lecture removed successfully" });
};
