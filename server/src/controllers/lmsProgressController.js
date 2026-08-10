import Course from "../models/Course.js";
import CourseAssessment from "../models/CourseAssessment.js";
import CourseProgress from "../models/CourseProgress.js";
import EmployeeProfile from "../models/EmployeeProfile.js";
import Badge from "../models/Badge.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";

// Ported from the standalone LMS project's courseProgressController.js.
// req.userId/req.role (raw JWT claims) become req.user._id/req.user.roles.lms
// (the full User doc protect() attaches). Logic is otherwise unchanged.

const getOrCreateProgress = async (courseId, employeeId) => {
  let progress = await CourseProgress.findOne({ course: courseId, employee: employeeId });
  if (!progress) progress = await CourseProgress.create({ course: courseId, employee: employeeId });
  return progress;
};

const awardBadgeToEmployee = async ({ employeeId, badgeId, courseId, assessmentType }) => {
  if (!badgeId || !courseId || !assessmentType) return false;

  let profile = await EmployeeProfile.findOne({ employee: employeeId });
  if (!profile) profile = await EmployeeProfile.create({ employee: employeeId });

  const hasBadge = profile.badges.some((id) => String(id) === String(badgeId));
  if (!hasBadge) profile.badges.push(badgeId);

  const hasCourseAward = (profile.badgeAwards || []).some(
    (award) => String(award.badge) === String(badgeId) && String(award.course) === String(courseId) && award.assessmentType === assessmentType,
  );
  if (hasCourseAward) return false;

  profile.badgeAwards.push({ badge: badgeId, course: courseId, assessmentType, earnedAt: new Date() });
  await profile.save();
  return true;
};

const awardSkillToEmployee = async (employeeId, skillId) => {
  if (!skillId) return false;

  let profile = await EmployeeProfile.findOne({ employee: employeeId });
  if (!profile) profile = await EmployeeProfile.create({ employee: employeeId });

  const skillIndex = profile.skills.findIndex((item) => String(item.skill) === String(skillId));
  if (skillIndex !== -1) {
    if (profile.skills[skillIndex].status !== "Verified") {
      profile.skills[skillIndex].status = "Verified";
      profile.skills[skillIndex].verifiedAt = new Date();
    }
  } else {
    profile.skills.push({ skill: skillId, level: "Beginner", status: "Verified", verifiedAt: new Date(), assignedAt: new Date() });
    profile.totalSkills = profile.skills.length;
  }

  await profile.save();
  return true;
};

const loadBadgeOrSkill = async (Model, id) => {
  if (!id) return null;
  const doc = await Model.findById(id);
  if (!doc) return null;
  return { id: doc._id, name: doc.name, description: doc.description || doc.category || "", imageUrl: doc.imageUrl || "" };
};

const awardBadgeOnce = async ({ employeeId, badgeId, progress, alreadyAwardedFlag, assessmentType }) => {
  if (!badgeId || progress[alreadyAwardedFlag]) return { badgeAwarded: false, badge: null };
  const ok = await awardBadgeToEmployee({ employeeId, badgeId, courseId: progress.course, assessmentType });
  if (!ok) return { badgeAwarded: false, badge: null };
  return { badgeAwarded: true, badge: await loadBadgeOrSkill(Badge, badgeId) };
};

const awardSkillOnce = async ({ employeeId, skillId, progress, alreadyAwardedFlag }) => {
  if (!skillId || progress[alreadyAwardedFlag]) return { skillAwarded: false, skill: null };
  const ok = await awardSkillToEmployee(employeeId, skillId);
  if (!ok) return { skillAwarded: false, skill: null };
  return { skillAwarded: true, skill: await loadBadgeOrSkill(Skill, skillId) };
};

// Closes the "employee fails, someone should assign them a course" loop: the
// LMS has no automated recommendation engine, so instead of silently leaving
// a maxed-out failure sitting in CourseProgress, the employee's manager (or,
// absent one, every LMS admin) gets notified so a human can assign remedial
// coursework. Fires once, on the attempt that exhausts the allowance.
const notifyManagerOfExhaustedAttempts = async ({ employeeId, courseId, assessmentType, title, score, maxAttempts }) => {
  const employee = await User.findById(employeeId).select("name managerId");
  if (!employee) return;

  const recipientIds = employee.managerId
    ? [employee.managerId]
    : (await User.find({ "roles.lms": "admin" }).select("_id").lean()).map((admin) => admin._id);
  if (!recipientIds.length) return;

  await notifyUsers(recipientIds, {
    title: "Employee did not pass a skill assessment",
    message: `${employee.name} did not pass "${title}" (${assessmentType}) after ${maxAttempts} attempt(s) — last score ${score}%. Consider assigning a course to help them build this skill.`,
    type: "lmsAssessmentFailed",
    activityType: "status_change",
    performedBy: employeeId,
    metadata: { courseId, assessmentType, score, maxAttempts },
  });
};

const buildMaterialKeys = (lectures = []) => {
  const keys = [];
  lectures.forEach((lecture) => {
    (lecture.materials || []).forEach((material, index) => {
      const type = material?.type;
      if (!type) return;
      const hasFile = typeof material.fileUrl === "string" && material.fileUrl.trim() !== "";
      const hasVideoLink = typeof material.videoLink === "string" && material.videoLink.trim() !== "";
      if ((type === "pdf" || type === "video") && hasFile) keys.push(`${lecture._id}:${index}:${type}`);
      if (type === "videoLink" && hasVideoLink) keys.push(`${lecture._id}:${index}:${type}`);
    });
  });
  return keys;
};

const buildProgressSummary = async (courseId, employeeId) => {
  const course = await Course.findById(courseId).populate("lectures");
  if (!course) return null;

  const materialKeys = buildMaterialKeys(course.lectures || []);
  const totalMaterialsCount = materialKeys.length;

  const progress = await getOrCreateProgress(courseId, employeeId);
  const completedSet = new Set(progress.completedMaterials || []);
  const completedMaterialsCount = materialKeys.filter((key) => completedSet.has(key)).length;

  const quizFinal =
    (await CourseAssessment.findOne({ course: courseId, assessmentType: "quiz", isPublished: true }).sort({ createdAt: -1 })) ||
    (await CourseAssessment.findOne({ course: courseId, assessmentType: "quiz" }).sort({ createdAt: -1 }));
  const assignmentFinal =
    (await CourseAssessment.findOne({ course: courseId, assessmentType: "assignment", isPublished: true }).sort({ createdAt: -1 })) ||
    (await CourseAssessment.findOne({ course: courseId, assessmentType: "assignment" }).sort({ createdAt: -1 }));

  const hasQuiz = !!quizFinal;
  const hasAssignment = !!assignmentFinal;
  const allMaterialsCompleted = totalMaterialsCount > 0 && completedMaterialsCount === totalMaterialsCount;

  let totalUnits = totalMaterialsCount;
  if (hasQuiz) totalUnits++;
  if (hasAssignment) totalUnits++;

  let completedUnits = completedMaterialsCount;
  if (hasQuiz && progress.quizStatus === "passed") completedUnits++;
  if (hasAssignment && progress.finalAssignmentStatus === "submitted") completedUnits++;

  const percent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  return {
    courseId,
    percent,
    allMaterialsCompleted,
    totalMaterialsCount,
    completedMaterialsCount,
    materialKeys,
    completedMaterialsKeys: progress.completedMaterials || [],
    completedPdfKeys: progress.completedPdfs || [],
    quiz: {
      exists: hasQuiz,
      status: progress.quizStatus,
      assessmentId: quizFinal?._id || null,
      title: quizFinal?.title || null,
      score: progress.quizScore ?? 0,
      correctAnswers: progress.correctAnswers ?? 0,
      wrongAnswers: progress.wrongAnswers ?? 0,
      attempts: progress.quizAttempt ?? 0,
      maxAttempts: quizFinal?.maxAttempts || 3,
      passingPercentage: quizFinal?.passingPercentage || 80,
    },
    finalAssignment: {
      exists: hasAssignment,
      status: progress.finalAssignmentStatus || "not_submitted",
      assessmentId: assignmentFinal?._id || null,
      title: assignmentFinal?.title || null,
      score: progress.finalAssignmentScore ?? 0,
      correctAnswers: progress.finalAssignmentCorrectAnswers ?? 0,
      wrongAnswers: progress.finalAssignmentWrongAnswers ?? 0,
      attempts: progress.finalAssignmentAttempt ?? 0,
      maxAttempts: assignmentFinal?.maxAttempts || 3,
      passingPercentage: assignmentFinal?.passingPercentage || 80,
    },
  };
};

export const employeeGetCourseProgressSummary = async (req, res) => {
  const summary = await buildProgressSummary(req.params.courseId, req.user._id);
  if (!summary) return res.status(404).json({ message: "Course not found" });
  res.json(summary);
};

export const adminGetUserCourseProgressSummary = async (req, res) => {
  const summary = await buildProgressSummary(req.params.courseId, req.params.userId);
  if (!summary) return res.status(404).json({ message: "Course not found" });
  res.json(summary);
};

export const employeeMarkMaterialComplete = async (req, res) => {
  const { courseId, lectureId, materialIndex } = req.params;
  const { type } = req.body;
  if (!type || !["pdf", "video", "videoLink"].includes(type)) {
    return res.status(400).json({ message: "type must be pdf|video|videoLink" });
  }

  const progress = await getOrCreateProgress(courseId, req.user._id);
  const key = `${lectureId}:${Number(materialIndex)}:${type}`;
  const set = new Set(progress.completedMaterials || []);
  const isNewCompletion = !set.has(key);
  set.add(key);
  progress.completedMaterials = Array.from(set);

  if (isNewCompletion) {
    progress.activityHistory.push({ eventType: "material_completed", detail: key, at: new Date() });
  }

  await progress.save();
  res.json({ message: "Material marked complete", completedMaterialsKeys: progress.completedMaterials });
};

export const employeeSubmitQuiz = async (req, res) => {
  const { courseId } = req.params;
  const employeeId = req.user._id;
  const { assessmentId, answers } = req.body;
  if (!assessmentId) return res.status(400).json({ message: "assessmentId required" });

  const assessment = await CourseAssessment.findById(assessmentId);
  if (!assessment) return res.status(404).json({ message: "Assessment not found" });

  const passingPercentage = assessment.passingPercentage || 80;
  const maxAttempts = assessment.maxAttempts || 3;
  const progress = await getOrCreateProgress(courseId, employeeId);

  if (progress.quizStatus === "passed") {
    return res.status(409).json({ message: "You have already passed this quiz." });
  }

  // A resubmission of the same answers for the attempt we already scored
  // (double-click, client-side retry after a slow response) is idempotent:
  // return the cached outcome instead of re-scoring and burning an attempt.
  const isDuplicateRetry =
    String(progress.quizLastSubmission?.assessmentId || "") === String(assessmentId) &&
    progress.quizLastSubmission?.attemptNo === progress.quizAttempt &&
    JSON.stringify(progress.submittedAnswers ?? {}) === JSON.stringify(answers ?? {});

  if (isDuplicateRetry) {
    return res.json({
      passed: progress.quizStatus === "passed",
      score: progress.quizScore,
      total: assessment.questions.length,
      correct: progress.correctAnswers,
      wrong: progress.wrongAnswers,
      attempts: progress.quizAttempt,
      maxAttempts,
      passingPercentage,
      remainingAttempts: Math.max(0, maxAttempts - progress.quizAttempt),
      canRetake: progress.quizStatus !== "passed" && progress.quizAttempt < maxAttempts,
      badgeAwarded: false,
      skillAwarded: false,
      badge: null,
      skill: null,
      duplicate: true,
    });
  }

  // Atomically reserve the next attempt slot so two concurrent submissions
  // (e.g. a network retry racing the original request) can't both read the
  // same quizAttempt and both slip past the maxAttempts check.
  const reservedProgress = await CourseProgress.findOneAndUpdate(
    { _id: progress._id, quizStatus: { $ne: "passed" }, quizAttempt: { $lt: maxAttempts } },
    { $inc: { quizAttempt: 1 } },
    { new: true },
  );
  if (!reservedProgress) {
    return res.status(409).json({
      message: progress.quizStatus === "passed" ? "You have already passed this quiz." : `Maximum attempts (${maxAttempts}) reached for this quiz.`,
    });
  }

  let correct = 0;
  let wrong = 0;
  const result = assessment.questions.map((question, index) => {
    const selected = answers?.[index];
    const isCorrect = Number(selected) === Number(question.correctOptionIndex);
    isCorrect ? correct++ : wrong++;
    return { question: question.prompt, selected, correctAnswer: question.correctOptionIndex, isCorrect };
  });

  const total = assessment.questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = score >= passingPercentage;

  reservedProgress.quizStatus = passed ? "passed" : "failed";
  reservedProgress.quizScore = score;
  reservedProgress.correctAnswers = correct;
  reservedProgress.wrongAnswers = wrong;
  reservedProgress.quizAssessmentId = assessmentId;
  reservedProgress.submittedAnswers = answers;
  reservedProgress.quizLastSubmission = { assessmentId, attemptNo: reservedProgress.quizAttempt };

  const responseData = {
    passed,
    score,
    total,
    correct,
    wrong,
    result,
    attempts: reservedProgress.quizAttempt,
    maxAttempts,
    passingPercentage,
    remainingAttempts: Math.max(0, maxAttempts - reservedProgress.quizAttempt),
    canRetake: !passed && reservedProgress.quizAttempt < maxAttempts,
    badgeAwarded: false,
    skillAwarded: false,
    badge: null,
    skill: null,
  };

  if (passed && assessment.badge) {
    const badgeResult = await awardBadgeOnce({ employeeId, badgeId: assessment.badge, progress: reservedProgress, alreadyAwardedFlag: "quizBadgeAwarded", assessmentType: "quiz" });
    responseData.badgeAwarded = badgeResult.badgeAwarded;
    responseData.badge = badgeResult.badge;
    if (badgeResult.badgeAwarded) reservedProgress.quizBadgeAwarded = true;
  }
  if (passed && assessment.skill) {
    const skillResult = await awardSkillOnce({ employeeId, skillId: assessment.skill, progress: reservedProgress, alreadyAwardedFlag: "quizSkillAwarded" });
    responseData.skillAwarded = skillResult.skillAwarded;
    responseData.skill = skillResult.skill;
    if (skillResult.skillAwarded) reservedProgress.quizSkillAwarded = true;
  }

  reservedProgress.quizAttemptsHistory.push({
    attemptNo: reservedProgress.quizAttempt,
    assessmentId,
    submittedAt: new Date(),
    score,
    passed,
    correctAnswers: correct,
    wrongAnswers: wrong,
    maxAttempts,
    passingPercentage,
    totalQuestions: total,
    badgeAwarded: responseData.badgeAwarded,
    badgeId: responseData.badge?.id || assessment.badge || null,
    skillAwarded: responseData.skillAwarded,
    skillId: responseData.skill?.id || assessment.skill || null,
  });
  reservedProgress.activityHistory.push({ eventType: "quiz_submitted", detail: `attempt ${reservedProgress.quizAttempt}, score ${score}`, at: new Date() });

  await reservedProgress.save();

  if (!passed && reservedProgress.quizAttempt >= maxAttempts) {
    await notifyManagerOfExhaustedAttempts({ employeeId, courseId, assessmentType: "quiz", title: assessment.title, score, maxAttempts });
  }

  res.json(responseData);
};

export const employeeSubmitFinalAssignment = async (req, res) => {
  const { courseId } = req.params;
  const employeeId = req.user._id;
  const { assessmentId, answers } = req.body;
  if (!assessmentId) return res.status(400).json({ message: "assessmentId is required" });

  const assessment = await CourseAssessment.findById(assessmentId);
  if (!assessment) return res.status(404).json({ message: "Assessment not found" });

  const passingPercentage = assessment.passingPercentage || 80;
  const maxAttempts = assessment.maxAttempts || 3;
  const progress = await getOrCreateProgress(courseId, employeeId);

  const alreadyPassed = progress.finalAssignmentScore >= passingPercentage && progress.finalAssignmentStatus === "submitted";
  if (alreadyPassed) {
    return res.status(409).json({ message: "You already passed this assignment." });
  }

  // A resubmission of the same answers for the attempt we already scored
  // (double-click, client-side retry) is idempotent: return the cached
  // outcome instead of re-scoring and burning an attempt.
  const isDuplicateRetry =
    String(progress.finalAssignmentLastSubmission?.assessmentId || "") === String(assessmentId) &&
    progress.finalAssignmentLastSubmission?.attemptNo === progress.finalAssignmentAttempt &&
    JSON.stringify(progress.finalAssignmentSubmittedAnswers ?? {}) === JSON.stringify(answers ?? {});

  if (isDuplicateRetry) {
    return res.json({
      message: progress.finalAssignmentScore >= passingPercentage ? "Final Assignment Passed" : "Final Assignment Submitted",
      passed: progress.finalAssignmentScore >= passingPercentage,
      score: progress.finalAssignmentScore,
      correct: progress.finalAssignmentCorrectAnswers,
      wrong: progress.finalAssignmentWrongAnswers,
      total: assessment.questions?.length || 0,
      attempts: progress.finalAssignmentAttempt,
      maxAttempts,
      passingPercentage,
      remainingAttempts: Math.max(0, maxAttempts - progress.finalAssignmentAttempt),
      canRetake: progress.finalAssignmentScore < passingPercentage && progress.finalAssignmentAttempt < maxAttempts,
      finalAssignmentStatus: progress.finalAssignmentStatus,
      result: [],
      badgeAwarded: false,
      skillAwarded: false,
      duplicate: true,
    });
  }

  // Atomically reserve the next attempt slot — see employeeSubmitQuiz for why.
  const reservedProgress = await CourseProgress.findOneAndUpdate(
    {
      _id: progress._id,
      finalAssignmentAttempt: { $lt: maxAttempts },
      $or: [{ finalAssignmentScore: { $lt: passingPercentage } }, { finalAssignmentStatus: { $ne: "submitted" } }],
    },
    { $inc: { finalAssignmentAttempt: 1 } },
    { new: true },
  );
  if (!reservedProgress) {
    return res.status(409).json({ message: `Maximum attempts (${maxAttempts}) reached.` });
  }

  let score = 0;
  let correct = 0;
  let wrong = 0;
  let total = 0;
  let passed = false;
  const result = [];

  if (assessment.questions?.length) {
    total = assessment.questions.length;
    assessment.questions.forEach((question, index) => {
      const selected = answers?.[index];
      const isCorrect = Number(selected) === Number(question.correctOptionIndex);
      isCorrect ? correct++ : wrong++;
      result.push({ question: question.prompt, selected, correctAnswer: question.correctOptionIndex, isCorrect });
    });
    score = Math.round((correct / total) * 100);
    passed = score >= passingPercentage;
  }

  reservedProgress.finalAssignmentScore = score;
  reservedProgress.finalAssignmentCorrectAnswers = correct;
  reservedProgress.finalAssignmentWrongAnswers = wrong;
  reservedProgress.finalAssignmentAssessmentId = assessmentId;
  reservedProgress.finalAssignmentStatus = "submitted";
  reservedProgress.finalAssignmentSubmittedAnswers = answers;
  reservedProgress.finalAssignmentLastSubmission = { assessmentId, attemptNo: reservedProgress.finalAssignmentAttempt };

  const responseData = {
    message: passed ? "Final Assignment Passed" : "Final Assignment Submitted",
    passed,
    score,
    correct,
    wrong,
    total,
    attempts: reservedProgress.finalAssignmentAttempt,
    maxAttempts,
    passingPercentage,
    remainingAttempts: Math.max(0, maxAttempts - reservedProgress.finalAssignmentAttempt),
    canRetake: !passed && reservedProgress.finalAssignmentAttempt < maxAttempts,
    finalAssignmentStatus: reservedProgress.finalAssignmentStatus,
    result,
    badgeAwarded: false,
    skillAwarded: false,
  };

  if (passed && assessment.badge) {
    const badgeResult = await awardBadgeOnce({ employeeId, badgeId: assessment.badge, progress: reservedProgress, alreadyAwardedFlag: "finalAssignmentBadgeAwarded", assessmentType: "assignment" });
    responseData.badgeAwarded = badgeResult.badgeAwarded;
    responseData.badge = badgeResult.badge;
    if (badgeResult.badgeAwarded) reservedProgress.finalAssignmentBadgeAwarded = true;
  }
  if (passed && assessment.skill) {
    const skillResult = await awardSkillOnce({ employeeId, skillId: assessment.skill, progress: reservedProgress, alreadyAwardedFlag: "finalAssignmentSkillAwarded" });
    responseData.skillAwarded = skillResult.skillAwarded;
    responseData.skill = skillResult.skill;
    if (skillResult.skillAwarded) reservedProgress.finalAssignmentSkillAwarded = true;
  }

  reservedProgress.finalAssignmentAttemptsHistory.push({
    attemptNo: reservedProgress.finalAssignmentAttempt,
    assessmentId,
    submittedAt: new Date(),
    score,
    passed,
    correctAnswers: correct,
    wrongAnswers: wrong,
    maxAttempts,
    passingPercentage,
    totalQuestions: total,
    badgeAwarded: responseData.badgeAwarded,
    badgeId: responseData.badge?.id || assessment.badge || null,
    skillAwarded: responseData.skillAwarded,
    skillId: responseData.skill?.id || assessment.skill || null,
  });
  reservedProgress.activityHistory.push({ eventType: "assignment_submitted", detail: `attempt ${reservedProgress.finalAssignmentAttempt}, score ${score}`, at: new Date() });

  await reservedProgress.save();

  if (!passed && reservedProgress.finalAssignmentAttempt >= maxAttempts) {
    await notifyManagerOfExhaustedAttempts({ employeeId, courseId, assessmentType: "assignment", title: assessment.title, score, maxAttempts });
  }

  res.json(responseData);
};
