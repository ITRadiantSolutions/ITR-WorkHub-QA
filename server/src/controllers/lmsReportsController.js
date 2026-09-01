import Course from "../models/Course.js";
import CourseProgress from "../models/CourseProgress.js";
import CourseAssessment from "../models/CourseAssessment.js";
import CourseAssignment from "../models/CourseAssignment.js";
import User from "../models/User.js";
import LmsLearningReport from "../models/LmsLearningReport.js";
import { getManagedEmployeeFilter } from "../utils/lmsTeamScope.js";


const buildAttemptHistory = ({ storedHistory = [], liveHistory = [], attempts = 0, latest = {} }) => {
  const source = liveHistory.length ? liveHistory : storedHistory;
  if (source.length) {
    return source.map((attempt, index) => ({ ...attempt, attemptNo: attempt?.attemptNo ?? index + 1, historicalDataAvailable: true }));
  }
  return Array.from({ length: Number(attempts) || 0 }, (_, index) => {
    const isLatest = index === Number(attempts) - 1;
    return {
      attemptNo: index + 1,
      score: isLatest ? latest.score : null,
      correctAnswers: isLatest ? latest.correctAnswers : null,
      wrongAnswers: isLatest ? latest.wrongAnswers : null,
      passed: isLatest ? latest.passed : null,
      status: isLatest ? latest.status : "recorded",
      submittedAt: isLatest ? latest.submittedAt : null,
      completedAt: isLatest ? latest.submittedAt : null,
      badgeAwarded: isLatest ? !!latest.badgeAwarded : false,
      skillAwarded: isLatest ? !!latest.skillAwarded : false,
      historicalDataAvailable: false,
    };
  });
};

const getReportUserFilter = (actor) =>
  actor.roles.lms === "manager" ? getManagedEmployeeFilter(actor) : { "roles.lms": { $in: ["employee", "admin", "manager"] } };

const pickLatestAssessment = async (courseId, assessmentType) => {
  const published = await CourseAssessment.findOne({ course: courseId, assessmentType, isPublished: true }).sort({ createdAt: -1 });
  if (published) return published;
  return CourseAssessment.findOne({ course: courseId, assessmentType }).sort({ createdAt: -1 });
};

const buildMaterialKeys = (lectures = []) => {
  const keys = [];
  for (const lecture of lectures) {
    const materials = lecture.materials || [];
    for (let idx = 0; idx < materials.length; idx++) {
      const material = materials[idx];
      const type = material?.type;
      if (!type) continue;
      const hasFile = typeof material?.fileUrl === "string" && material.fileUrl.trim().length > 0;
      const hasVideoLink = typeof material?.videoLink === "string" && material.videoLink.trim().length > 0;
      if ((type === "pdf" || type === "video") && hasFile) {
        keys.push({ key: `${lecture._id}:${idx}:${type}`, lecture, idx, material, type });
      } else if (type === "videoLink" && hasVideoLink) {
        keys.push({ key: `${lecture._id}:${idx}:${type}`, lecture, idx, material, type });
      }
    }
  }
  return keys;
};

const computePercent = ({ totalMaterialsCount, completedMaterialsCount, quizStatus, finalAssignmentStatus, hasQuiz = true, hasAssignment = true }) => {
  const total = totalMaterialsCount + Number(hasQuiz) + Number(hasAssignment);
  if (total <= 0) return 0;
  const completed =
    completedMaterialsCount + (hasQuiz && quizStatus === "passed" ? 1 : 0) + (hasAssignment && finalAssignmentStatus === "submitted" ? 1 : 0);
  const pct = Math.round((completed / total) * 100);
  const isFull =
    completedMaterialsCount >= totalMaterialsCount && (!hasQuiz || quizStatus === "passed") && (!hasAssignment || finalAssignmentStatus === "submitted");
  return isFull ? 100 : Math.min(pct, 99);
};

const computeCourseStatus = ({ percent, quizStatus, finalAssignmentStatus }) => {
  if (percent >= 100 || (quizStatus === "passed" && finalAssignmentStatus === "submitted")) return "completed";
  if (quizStatus === "passed") return "passed";
  if (quizStatus === "failed") return "failed";
  if (percent > 0) return "learning";
  return "not_started";
};

export const adminRegenerateEmpReports = async (req, res) => {
  const employees = await User.find(getReportUserFilter(req.user)).select("_id name email");
  const results = [];

  for (const employee of employees) {
    const employeeId = employee._id;

    const [enrolledCourses, assignmentDocs] = await Promise.all([
      Course.find({ enrolledStudents: employeeId }).select("_id"),
      CourseAssignment.find({ assignedTo: employeeId }).select("course"),
    ]);
    const uniqueCourseIds = [...new Set([...enrolledCourses.map((c) => String(c._id)), ...assignmentDocs.map((a) => String(a.course))])];

    const snapshotCourses = [];

    for (const courseId of uniqueCourseIds) {
      const course = await Course.findById(courseId).select("_id title category level thumbnail lectures").populate({ path: "lectures", select: "materials title" });
      if (!course) continue;

      const progressDoc = await CourseProgress.findOne({ course: courseId, employee: employeeId });

      const quizStatus = progressDoc?.quizStatus || "not_started";
      const finalAssignStatus = progressDoc?.finalAssignmentStatus || "not_submitted";
      const completedMaterials = progressDoc?.completedMaterials || [];

      const materialEntries = buildMaterialKeys(course.lectures || []);
      const totalMaterialsCount = materialEntries.length;
      const completedMaterialsCount = materialEntries.filter(({ key }) => completedMaterials.includes(key)).length;

      const [quizAssessment, finalAssessment] = await Promise.all([pickLatestAssessment(courseId, "quiz"), pickLatestAssessment(courseId, "assignment")]);

      const percent = computePercent({
        totalMaterialsCount,
        completedMaterialsCount,
        quizStatus,
        finalAssignmentStatus: finalAssignStatus,
        hasQuiz: !!quizAssessment,
        hasAssignment: !!finalAssessment,
      });
      const status = computeCourseStatus({ percent, quizStatus, finalAssignmentStatus: finalAssignStatus });

      const materialSnapshots = materialEntries.map(({ key, lecture, idx, material, type }) => {
        const done = completedMaterials.includes(key);
        return {
          lectureId: lecture._id,
          materialIndex: idx,
          materialType: type,
          title: material?.title || "",
          completed: done,
          completedAt: done ? progressDoc?.updatedAt || new Date() : undefined,
          timeSpentMinutes: 0,
        };
      });

      snapshotCourses.push({
        courseId: course._id,
        title: course.title || "",
        category: course.category || "",
        level: course.level || "",
        thumbnail: course.thumbnail || "",
        status,
        progress: percent,
        learningHours: 0,
        totalLectures: (course.lectures || []).length,
        totalMaterials: totalMaterialsCount,
        completedMaterials: completedMaterialsCount,
        pendingMaterials: Math.max(0, totalMaterialsCount - completedMaterialsCount),
        materials: materialSnapshots,
        quiz: {
          assessmentId: quizAssessment?._id || null,
          available: !!quizAssessment,
          status: quizAssessment ? quizStatus : "not_started",
          attempts: quizAssessment ? (progressDoc?.quizAttempt ?? 0) : 0,
          maxAttempts: quizAssessment?.maxAttempts ?? 1,
          score: quizAssessment ? (progressDoc?.quizScore ?? 0) : 0,
          passingPercentage: quizAssessment?.passingPercentage ?? 80,
          totalQuestions: quizAssessment?.questions?.length ?? 0,
          correctAnswers: quizAssessment ? (progressDoc?.correctAnswers ?? 0) : 0,
          wrongAnswers: quizAssessment ? (progressDoc?.wrongAnswers ?? 0) : 0,
          attemptsHistory: buildAttemptHistory({
            liveHistory: progressDoc?.quizAttemptsHistory || [],
            attempts: progressDoc?.quizAttempt ?? 0,
            latest: { score: progressDoc?.quizScore, passed: quizStatus === "passed", status: quizStatus },
          }),
        },
        assignment: {
          assessmentId: finalAssessment?._id || null,
          available: !!finalAssessment,
          status: finalAssessment ? finalAssignStatus : "not_submitted",
          attempts: finalAssessment ? (progressDoc?.finalAssignmentAttempt ?? 0) : 0,
          maxAttempts: finalAssessment?.maxAttempts ?? 1,
          score: finalAssessment ? (progressDoc?.finalAssignmentScore ?? 0) : 0,
          passingPercentage: finalAssessment?.passingPercentage ?? 80,
          attemptsHistory: buildAttemptHistory({
            liveHistory: progressDoc?.finalAssignmentAttemptsHistory || [],
            attempts: progressDoc?.finalAssignmentAttempt ?? 0,
            latest: { score: progressDoc?.finalAssignmentScore, passed: finalAssignStatus === "submitted", status: finalAssignStatus },
          }),
        },
        earnedSkills: [],
        earnedBadges: [],
      });
    }

    const completedCount = snapshotCourses.filter((c) => c.status === "completed" || c.status === "passed" || c.progress >= 100).length;
    const summary = {
      enrolledCourses: snapshotCourses.length,
      completedCourses: completedCount,
      inProgressCourses: snapshotCourses.filter((c) => c.status === "learning").length,
      notStartedCourses: snapshotCourses.filter((c) => c.status === "not_started").length,
      failedCourses: snapshotCourses.filter((c) => c.status === "failed").length,
      averageProgress: snapshotCourses.length ? Math.round(snapshotCourses.reduce((s, c) => s + (c.progress || 0), 0) / snapshotCourses.length) : 0,
      totalLearningHours: 0,
      totalMaterials: snapshotCourses.reduce((s, c) => s + (c.totalMaterials || 0), 0),
      completedMaterials: snapshotCourses.reduce((s, c) => s + (c.completedMaterials || 0), 0),
      pendingMaterials: snapshotCourses.reduce((s, c) => s + (c.pendingMaterials || 0), 0),
      totalSkills: 0,
      verifiedSkills: 0,
      earnedBadges: 0,
      certificates: 0,
      quizPassed: snapshotCourses.filter((c) => c.quiz?.status === "passed").length,
      assignmentsSubmitted: snapshotCourses.filter((c) => c.assignment?.status === "submitted").length,
    };

    await LmsLearningReport.findOneAndUpdate(
      { employeeId },
      {
        $set: {
          employeeId,
          employeeName: employee.name || "",
          employeeEmail: employee.email || "",
          generatedAt: new Date(),
          summary,
          courses: snapshotCourses,
          skills: [],
          badges: [],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    results.push({ employeeId, name: employee.name, courseCount: snapshotCourses.length });
  }

  res.json({ message: "Employee reports regenerated successfully.", count: results.length, employees: results });
};

export const adminGetAllEmpReports = async (req, res) => {
  const employees = await User.find(getReportUserFilter(req.user)).select("_id name email");
  if (employees.length === 0) return res.json([]);

  const employeeIds = employees.map((e) => e._id);
  const reports = await LmsLearningReport.find({ employeeId: { $in: employeeIds } }).lean();
  const reportMap = new Map(reports.map((r) => [String(r.employeeId), r]));

  const liveProgressDocs = await CourseProgress.find({ employee: { $in: employeeIds } }).lean();
  const liveProgressMap = new Map(liveProgressDocs.map((p) => [`${String(p.employee)}:${String(p.course)}`, p]));

  const enriched = employees.map((employee) => {
    const report = reportMap.get(String(employee._id));

    const courses = (report?.courses || []).map((course) => {
      const live = liveProgressMap.get(`${String(employee._id)}:${String(course.courseId)}`);

      const totalMats = course.totalMaterials ?? 0;
      const completedKeys = new Set(live?.completedMaterials || []);
      const completedMats = live ? Math.min(totalMats, completedKeys.size) : (course.completedMaterials ?? 0);

      const quizStatus = live?.quizStatus ?? course.quiz?.status ?? "not_started";
      const quiz = {
        available: course.quiz?.available ?? false,
        status: quizStatus,
        attempts: live?.quizAttempt ?? course.quiz?.attempts ?? 0,
        maxAttempts: course.quiz?.maxAttempts ?? 1,
        score: live?.quizScore ?? course.quiz?.score ?? 0,
        passingPercentage: course.quiz?.passingPercentage ?? 80,
        attemptsHistory: live?.quizAttemptsHistory?.length ? live.quizAttemptsHistory : course.quiz?.attemptsHistory || [],
      };

      const finalStatus = live?.finalAssignmentStatus ?? course.assignment?.status ?? "not_submitted";
      const finalAssignment = {
        available: course.assignment?.available ?? false,
        status: finalStatus,
        attempts: live?.finalAssignmentAttempt ?? course.assignment?.attempts ?? 0,
        maxAttempts: course.assignment?.maxAttempts ?? 1,
        score: live?.finalAssignmentScore ?? course.assignment?.score ?? 0,
        passingPercentage: course.assignment?.passingPercentage ?? 80,
        attemptsHistory: live?.finalAssignmentAttemptsHistory?.length ? live.finalAssignmentAttemptsHistory : course.assignment?.attemptsHistory || [],
      };

      const percent = live
        ? computePercent({ totalMaterialsCount: totalMats, completedMaterialsCount: completedMats, quizStatus: quiz.status, finalAssignmentStatus: finalAssignment.status, hasQuiz: quiz.available, hasAssignment: finalAssignment.available })
        : (course.progress ?? 0);
      const status = computeCourseStatus({ percent, quizStatus: quiz.status, finalAssignmentStatus: finalAssignment.status });

      return {
        courseId: course.courseId,
        title: course.title || "Untitled Course",
        category: course.category || "General",
        level: course.level || "",
        thumbnail: course.thumbnail || "",
        status,
        percent,
        lastAccessed: live?.updatedAt ?? null,
        learningHours: course.learningHours ?? 0,
        totalLectures: course.totalLectures ?? 0,
        earnedSkills: course.earnedSkills ?? [],
        earnedBadges: course.earnedBadges ?? [],
        quiz,
        finalAssignment,
        materials: { totalMaterialsCount: totalMats, completedMaterialsCount: completedMats },
      };
    });

    const summary = {
      ...(report?.summary || {}),
      enrolledCourses: courses.length,
      completedCourses: courses.filter((c) => c.status === "completed" || c.status === "passed" || c.percent >= 100).length,
      inProgressCourses: courses.filter((c) => c.status === "learning").length,
      notStartedCourses: courses.filter((c) => c.status === "not_started").length,
      failedCourses: courses.filter((c) => c.status === "failed").length,
      averageProgress: courses.length ? Math.round(courses.reduce((s, c) => s + (c.percent || 0), 0) / courses.length) : 0,
      quizPassed: courses.filter((c) => c.quiz?.status === "passed").length,
      assignmentsSubmitted: courses.filter((c) => c.finalAssignment?.status === "submitted").length,
    };

    return {
      employeeId: employee._id,
      employee: { _id: employee._id, name: employee.name || report?.employeeName || "Unknown", email: employee.email || report?.employeeEmail || "" },
      generatedAt: report?.generatedAt || null,
      summary,
      courses,
      courseCount: courses.length,
    };
  });

  res.json(enriched);
};
