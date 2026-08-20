import Course from "../models/Course.js";
import CourseAssessment from "../models/CourseAssessment.js";
import Badge from "../models/Badge.js";
import Skill from "../models/Skill.js";

// Ported from the standalone LMS project's courseAssessmentController.js.
// Admin/manager-only quiz & final-assignment definitions attached to a course.

const isManager = (user) => user.isSuperAdmin || ["manager", "admin"].includes(user.roles.lms);

const resolveBadgeOrSkill = async ({ badge, skill }) => {
  // In the source app, the badge <select> may actually submit a Skill id —
  // resolve whichever collection the id belongs to.
  let badgeId = null;
  let skillId = null;

  if (badge) {
    const badgeDoc = await Badge.findById(badge);
    if (badgeDoc) {
      if (!badgeDoc.isActive) throw Object.assign(new Error("Badge is inactive"), { status: 400 });
      badgeId = badgeDoc._id;
    } else {
      const skillDoc = await Skill.findById(badge);
      if (!skillDoc) throw Object.assign(new Error("Badge not found"), { status: 400 });
      if (skillDoc.status !== "Active") throw Object.assign(new Error("Skill is inactive"), { status: 400 });
      skillId = skillDoc._id;
    }
  }

  if (skill) {
    const skillDoc = await Skill.findById(skill);
    if (!skillDoc) throw Object.assign(new Error("Skill not found"), { status: 400 });
    if (skillDoc.status !== "Active") throw Object.assign(new Error("Skill is inactive"), { status: 400 });
    skillId = skillDoc._id;
  }

  return { badgeId, skillId };
};

export const adminCreateAssessment = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { courseId } = req.params;
  const { assessmentType, title, durationMinutes, questions, maxAttempts, passingPercentage, sampleSize, badge, skill } = req.body;

  if (!assessmentType) return res.status(400).json({ message: "assessmentType is required" });
  if (!title) return res.status(400).json({ message: "title is required" });
  if (!durationMinutes) return res.status(400).json({ message: "durationMinutes is required" });

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });

  const parsedQuestions = typeof questions === "string" ? JSON.parse(questions) : questions;
  if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
    return res.status(400).json({ message: "At least one question is required" });
  }

  let parsedSampleSize = null;
  if (sampleSize !== undefined && sampleSize !== null && sampleSize !== "") {
    parsedSampleSize = Number(sampleSize);
    if (!Number.isFinite(parsedSampleSize) || parsedSampleSize < 1) {
      return res.status(400).json({ message: "sampleSize must be at least 1" });
    }
    if (parsedSampleSize > parsedQuestions.length) {
      return res.status(400).json({ message: "sampleSize cannot exceed the number of questions" });
    }
  }

  try {
    const { badgeId, skillId } = await resolveBadgeOrSkill({ badge, skill });

    const assessment = await CourseAssessment.create({
      course: courseId,
      createdBy: req.user._id,
      assessmentType,
      title,
      durationMinutes,
      questions: parsedQuestions,
      isPublished: req.body.isPublished === true || req.body.isPublished === "true",
      maxAttempts: maxAttempts !== undefined ? Math.max(1, Math.min(10, Number(maxAttempts) || 3)) : 3,
      passingPercentage: passingPercentage !== undefined ? Math.max(0, Math.min(100, Number(passingPercentage) || 80)) : 80,
      sampleSize: parsedSampleSize,
      badge: badgeId,
      skill: skillId,
    });

    res.status(201).json(assessment);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

// Shared by two audiences: the admin CourseBuilder (needs the answer key to
// edit questions) and the employee AssessmentPlayer (must never see it before
// submitting). Only managers/admins get correctOptionIndex in the response.
export const adminListAssessmentsByCourse = async (req, res) => {
  const query = CourseAssessment.find({ course: req.params.courseId })
    .populate("skill", "name")
    .populate("badge", "name description imageUrl")
    .sort({ createdAt: -1 });
  if (!isManager(req.user)) query.select("-questions.correctOptionIndex");
  res.json(await query);
};

export const adminUpdateAssessment = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { assessmentId } = req.params;
  const { assessmentType, title, durationMinutes, questions, isPublished, maxAttempts, passingPercentage, sampleSize, badge, skill } = req.body;

  if (!assessmentType) return res.status(400).json({ message: "assessmentType is required" });
  if (!title) return res.status(400).json({ message: "title is required" });
  if (!durationMinutes) return res.status(400).json({ message: "durationMinutes is required" });

  const parsedQuestions = typeof questions === "string" ? JSON.parse(questions) : questions;
  if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
    return res.status(400).json({ message: "At least one question is required" });
  }

  const updateData = {
    assessmentType,
    title,
    durationMinutes,
    questions: parsedQuestions,
    isPublished: isPublished === true || isPublished === "true",
  };
  if (maxAttempts !== undefined) updateData.maxAttempts = Math.max(1, Math.min(10, Number(maxAttempts) || 3));
  if (passingPercentage !== undefined) updateData.passingPercentage = Math.max(0, Math.min(100, Number(passingPercentage) || 80));
  if (sampleSize !== undefined) {
    if (sampleSize === null || sampleSize === "") {
      updateData.sampleSize = null;
    } else {
      const parsedSampleSize = Number(sampleSize);
      if (!Number.isFinite(parsedSampleSize) || parsedSampleSize < 1) {
        return res.status(400).json({ message: "sampleSize must be at least 1" });
      }
      if (parsedSampleSize > parsedQuestions.length) {
        return res.status(400).json({ message: "sampleSize cannot exceed the number of questions" });
      }
      updateData.sampleSize = parsedSampleSize;
    }
  }

  try {
    if (badge !== undefined || skill !== undefined) {
      const { badgeId, skillId } = await resolveBadgeOrSkill({ badge, skill });
      if (badge !== undefined) updateData.badge = badgeId;
      if (skill !== undefined) updateData.skill = skillId;
    }

    const updated = await CourseAssessment.findByIdAndUpdate(assessmentId, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: "Assessment not found" });
    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

export const adminDeleteAssessment = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const deleted = await CourseAssessment.findByIdAndDelete(req.params.assessmentId);
  if (!deleted) return res.status(404).json({ message: "Assessment not found" });
  res.json({ message: "Assessment deleted successfully" });
};
