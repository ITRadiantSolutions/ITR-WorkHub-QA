import Course from "../models/Course.js";
import CourseAssessment from "../models/CourseAssessment.js";
import CourseAssignment from "../models/CourseAssignment.js";
import CourseProgress from "../models/CourseProgress.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { awardBadgeOnce, awardSkillOnce } from "../utils/lmsAwards.js";
import { getManagerOrAdminRecipientIds } from "../utils/lmsTeamScope.js";
import { sampleAttemptQuestions } from "../utils/lmsQuestionSampling.js";

// Ported from the standalone LMS project's courseProgressController.js.
// req.userId/req.role (raw JWT claims) become req.user._id/req.user.roles.lms
// (the full User doc protect() attaches). Logic is otherwise unchanged.

// Reattempts are capped at 3 within a rolling 30-day window (not a lifetime
// total) so an employee who fails gets a fresh set of attempts a month later.
// A failed attempt that still has retakes left in the window must be retaken
// within 14 days.
const ATTEMPT_ROLLING_WINDOW_DAYS = 30;
const MONTHLY_ATTEMPT_LIMIT = 3;
const RETAKE_DEADLINE_DAYS = 14;

const countRecentAttempts = (history = [], days = ATTEMPT_ROLLING_WINDOW_DAYS) => {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.filter((entry) => new Date(entry.submittedAt).getTime() >= cutoff).length;
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

// The manager who assigns a course can set a per-employee minimum passing %
// (CourseAssignment.passingPercentageByEmployee) that overrides the
// assessment's own default passingPercentage for that employee only.
const getRequiredPassingPercentage = async ({ courseId, employeeId, assessment }) => {
  const assignment = await CourseAssignment.findOne({ course: courseId, assignedTo: employeeId }).select("passingPercentageByEmployee");
  const override = assignment?.passingPercentageByEmployee?.get(String(employeeId));
  return typeof override === "number" ? override : assessment.passingPercentage || 80;
};

const getOrCreateProgress = async (courseId, employeeId) => {
  let progress = await CourseProgress.findOne({ course: courseId, employee: employeeId });
  if (!progress) progress = await CourseProgress.create({ course: courseId, employee: employeeId });
  return progress;
};

// Never includes correctOptionIndex — this is the only path employees reach
// the question pool through (mirrors lmsSkillTestController's sanitizeQuestion).
const sanitizeQuestion = (q) => ({
  _id: q._id,
  type: q.type,
  prompt: q.prompt,
  options: (q.options || []).map((o) => ({ text: o.text })),
});

// Resolves the exact ordered subset of assessment.questions this employee's
// CURRENT attempt is being served, sampling fresh (or resuming an in-flight
// sample) when assessment.sampleSize is set — e.g. a 100-question bank with
// sampleSize 10 gives each employee a different random 10 (see
// sampleAttemptQuestions). Without sampleSize, every question is used, in
// its natural order, exactly as before this feature existed. The same order
// is used at both "start" (render) and "submit" (grading) time via
// progress[quiz|finalAssignment]CurrentAttempt.questionIds, so scoring is
// always against exactly what the employee was shown. Mutates `progress` in
// place; the caller is responsible for saving it.
const resolveAttemptQuestions = ({ assessment, progress, field }) => {
  const key = field === "quiz" ? "quizCurrentAttempt" : "finalAssignmentCurrentAttempt";
  const sampleSize = assessment.sampleSize;

  if (!sampleSize || sampleSize >= assessment.questions.length) {
    progress[key] = { attemptNo: progress[key]?.attemptNo || 0, questionIds: [], startedAt: progress[key]?.startedAt || null };
    return assessment.questions;
  }

  const existingIds = progress[key]?.questionIds || [];
  const existingQuestions = existingIds.map((id) => assessment.questions.find((q) => String(q._id) === String(id))).filter(Boolean);
  if (existingQuestions.length === sampleSize) return existingQuestions;

  const history = field === "quiz" ? progress.quizAttemptsHistory : progress.finalAssignmentAttemptsHistory;
  const previousQuestionIds = history[history.length - 1]?.questionIds;
  const sampledIds = sampleAttemptQuestions(assessment.questions, sampleSize, previousQuestionIds);
  progress[key] = { attemptNo: progress[key]?.attemptNo || 0, questionIds: sampledIds, startedAt: new Date() };
  return sampledIds.map((id) => assessment.questions.find((q) => String(q._id) === String(id))).filter(Boolean);
};

// Closes the "employee fails, someone should assign them a course" loop: the
// LMS has no automated recommendation engine, so instead of silently leaving
// a maxed-out failure sitting in CourseProgress, the employee's manager (or,
// absent one, every LMS admin) gets notified so a human can assign remedial
// coursework. Fires once, on the attempt that exhausts the allowance.
const notifyManagerOfExhaustedAttempts = async ({ employeeId, courseId, assessmentType, title, score, maxAttempts }) => {
  const employee = await User.findById(employeeId).select("name managerId");
  if (!employee) return;

  const recipientIds = await getManagerOrAdminRecipientIds(employee);
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

  const quizPassingPercentage = hasQuiz
    ? await getRequiredPassingPercentage({ courseId, employeeId, assessment: quizFinal })
    : 80;
  const assignmentPassingPercentage = hasAssignment
    ? await getRequiredPassingPercentage({ courseId, employeeId, assessment: assignmentFinal })
    : 80;
  const quizAttemptsRemainingThisMonth = Math.max(
    0,
    Math.min(quizFinal?.maxAttempts || MONTHLY_ATTEMPT_LIMIT, MONTHLY_ATTEMPT_LIMIT) - countRecentAttempts(progress.quizAttemptsHistory),
  );
  const finalAssignmentAttemptsRemainingThisMonth = Math.max(
    0,
    Math.min(assignmentFinal?.maxAttempts || MONTHLY_ATTEMPT_LIMIT, MONTHLY_ATTEMPT_LIMIT) - countRecentAttempts(progress.finalAssignmentAttemptsHistory),
  );

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
      passingPercentage: quizPassingPercentage,
      attemptsRemainingThisMonth: quizAttemptsRemainingThisMonth,
      retakeDueBy: progress.quizRetakeDueBy || null,
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
      passingPercentage: assignmentPassingPercentage,
      attemptsRemainingThisMonth: finalAssignmentAttemptsRemainingThisMonth,
      retakeDueBy: progress.finalAssignmentRetakeDueBy || null,
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

// Fetches (sampling fresh, or resuming the in-flight sample) the question
// set an employee should be shown for this attempt — the entry point
// AssessmentPlayer calls before rendering, so a page refresh mid-attempt
// doesn't silently swap the paper. Doesn't consume an attempt; only
// submitting does (see employeeSubmitQuiz/employeeSubmitFinalAssignment).
export const employeeStartQuiz = async (req, res) => {
  const { courseId, assessmentId } = req.params;
  const employeeId = req.user._id;

  const assessment = await CourseAssessment.findOne({ _id: assessmentId, course: courseId });
  if (!assessment) return res.status(404).json({ message: "Assessment not found" });

  const progress = await getOrCreateProgress(courseId, employeeId);
  const questions = resolveAttemptQuestions({ assessment, progress, field: "quiz" });
  await progress.save();

  res.json({
    assessmentId: assessment._id,
    title: assessment.title,
    durationMinutes: assessment.durationMinutes,
    passingPercentage: await getRequiredPassingPercentage({ courseId, employeeId, assessment }),
    questions: questions.map(sanitizeQuestion),
  });
};

export const employeeStartFinalAssignment = async (req, res) => {
  const { courseId, assessmentId } = req.params;
  const employeeId = req.user._id;

  const assessment = await CourseAssessment.findOne({ _id: assessmentId, course: courseId });
  if (!assessment) return res.status(404).json({ message: "Assessment not found" });

  const progress = await getOrCreateProgress(courseId, employeeId);
  const questions = resolveAttemptQuestions({ assessment, progress, field: "finalAssignment" });
  await progress.save();

  res.json({
    assessmentId: assessment._id,
    title: assessment.title,
    durationMinutes: assessment.durationMinutes,
    passingPercentage: await getRequiredPassingPercentage({ courseId, employeeId, assessment }),
    questions: questions.map(sanitizeQuestion),
  });
};

export const employeeSubmitQuiz = async (req, res) => {
  const { courseId } = req.params;
  const employeeId = req.user._id;
  const { assessmentId, answers } = req.body;
  if (!assessmentId) return res.status(400).json({ message: "assessmentId required" });

  const assessment = await CourseAssessment.findById(assessmentId);
  if (!assessment) return res.status(404).json({ message: "Assessment not found" });

  const passingPercentage = await getRequiredPassingPercentage({ courseId, employeeId, assessment });
  const maxAttempts = Math.min(assessment.maxAttempts || MONTHLY_ATTEMPT_LIMIT, MONTHLY_ATTEMPT_LIMIT);
  const progress = await getOrCreateProgress(courseId, employeeId);

  if (progress.quizStatus === "passed") {
    return res.status(409).json({ message: "You have already passed this quiz." });
  }

  const recentAttempts = countRecentAttempts(progress.quizAttemptsHistory);
  if (recentAttempts >= maxAttempts) {
    return res.status(409).json({
      message: `Maximum attempts (${maxAttempts}) reached for this quiz this month. Try again after ${ATTEMPT_ROLLING_WINDOW_DAYS} days.`,
    });
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
      total: progress.quizCurrentAttempt?.questionIds?.length || assessment.questions.length,
      correct: progress.correctAnswers,
      wrong: progress.wrongAnswers,
      attempts: progress.quizAttempt,
      maxAttempts,
      passingPercentage,
      remainingAttempts: Math.max(0, maxAttempts - recentAttempts),
      canRetake: progress.quizStatus !== "passed" && recentAttempts < maxAttempts,
      retakeDueBy: progress.quizRetakeDueBy || null,
      badgeAwarded: false,
      skillAwarded: false,
      badge: null,
      skill: null,
      duplicate: true,
    });
  }

  // Atomically reserve the next attempt slot so two concurrent submissions
  // (e.g. a network retry racing the original request) can't both read the
  // same quizAttempt and both submit for it. The monthly-window cap itself
  // was already checked above (it can't be expressed as a simple atomic
  // comparison since it depends on filtering attempt-history timestamps);
  // the tiny remaining race between two truly simultaneous submissions is an
  // accepted trade-off, same as elsewhere in this codebase.
  const reservedProgress = await CourseProgress.findOneAndUpdate(
    { _id: progress._id, quizStatus: { $ne: "passed" } },
    { $inc: { quizAttempt: 1 } },
    { new: true },
  );
  if (!reservedProgress) {
    return res.status(409).json({ message: "You have already passed this quiz." });
  }

  // Grade against exactly the subset this attempt was served (the full pool
  // when the assessment has no sampleSize, or the sampled subset resolved by
  // the earlier /start call — see resolveAttemptQuestions).
  const gradedQuestions = resolveAttemptQuestions({ assessment, progress: reservedProgress, field: "quiz" });

  let correct = 0;
  let wrong = 0;
  const result = gradedQuestions.map((question, index) => {
    const selected = answers?.[index];
    const isCorrect = Number(selected) === Number(question.correctOptionIndex);
    isCorrect ? correct++ : wrong++;
    return { question: question.prompt, selected, correctAnswer: question.correctOptionIndex, isCorrect };
  });

  const total = gradedQuestions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = score >= passingPercentage;

  reservedProgress.quizStatus = passed ? "passed" : "failed";
  reservedProgress.quizScore = score;
  reservedProgress.correctAnswers = correct;
  reservedProgress.wrongAnswers = wrong;
  reservedProgress.quizAssessmentId = assessmentId;
  reservedProgress.submittedAnswers = answers;
  reservedProgress.quizLastSubmission = { assessmentId, attemptNo: reservedProgress.quizAttempt };

  const recentAttemptsAfter = recentAttempts + 1;
  const attemptsRemainingThisMonth = Math.max(0, maxAttempts - recentAttemptsAfter);
  if (passed) {
    reservedProgress.quizRetakeDueBy = null;
    reservedProgress.quizRetakeReminderSentAt = null;
  } else if (attemptsRemainingThisMonth > 0) {
    reservedProgress.quizRetakeDueBy = addDays(new Date(), RETAKE_DEADLINE_DAYS);
    reservedProgress.quizRetakeReminderSentAt = null;
  } else {
    reservedProgress.quizRetakeDueBy = null;
  }

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
    remainingAttempts: attemptsRemainingThisMonth,
    canRetake: !passed && attemptsRemainingThisMonth > 0,
    retakeDueBy: reservedProgress.quizRetakeDueBy,
    badgeAwarded: false,
    skillAwarded: false,
    badge: null,
    skill: null,
  };

  if (passed && assessment.badge) {
    const badgeResult = await awardBadgeOnce({ employeeId, badgeId: assessment.badge, courseId, progress: reservedProgress, alreadyAwardedFlag: "quizBadgeAwarded", assessmentType: "quiz" });
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
    questionIds: reservedProgress.quizCurrentAttempt?.questionIds || [],
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
  reservedProgress.quizCurrentAttempt = { attemptNo: 0, questionIds: [], startedAt: null };

  await reservedProgress.save();

  if (!passed && attemptsRemainingThisMonth === 0) {
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

  const passingPercentage = await getRequiredPassingPercentage({ courseId, employeeId, assessment });
  const maxAttempts = Math.min(assessment.maxAttempts || MONTHLY_ATTEMPT_LIMIT, MONTHLY_ATTEMPT_LIMIT);
  const progress = await getOrCreateProgress(courseId, employeeId);

  const alreadyPassed = progress.finalAssignmentScore >= passingPercentage && progress.finalAssignmentStatus === "submitted";
  if (alreadyPassed) {
    return res.status(409).json({ message: "You already passed this assignment." });
  }

  const recentAttempts = countRecentAttempts(progress.finalAssignmentAttemptsHistory);
  if (recentAttempts >= maxAttempts) {
    return res.status(409).json({
      message: `Maximum attempts (${maxAttempts}) reached this month. Try again after ${ATTEMPT_ROLLING_WINDOW_DAYS} days.`,
    });
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
      total: progress.finalAssignmentCurrentAttempt?.questionIds?.length || assessment.questions?.length || 0,
      attempts: progress.finalAssignmentAttempt,
      maxAttempts,
      passingPercentage,
      remainingAttempts: Math.max(0, maxAttempts - recentAttempts),
      canRetake: progress.finalAssignmentScore < passingPercentage && recentAttempts < maxAttempts,
      retakeDueBy: progress.finalAssignmentRetakeDueBy || null,
      finalAssignmentStatus: progress.finalAssignmentStatus,
      result: [],
      badgeAwarded: false,
      skillAwarded: false,
      duplicate: true,
    });
  }

  // Atomically reserve the next attempt slot — see employeeSubmitQuiz for why
  // the monthly-window cap is checked above rather than folded into this
  // query's filter.
  const reservedProgress = await CourseProgress.findOneAndUpdate(
    {
      _id: progress._id,
      $or: [{ finalAssignmentScore: { $lt: passingPercentage } }, { finalAssignmentStatus: { $ne: "submitted" } }],
    },
    { $inc: { finalAssignmentAttempt: 1 } },
    { new: true },
  );
  if (!reservedProgress) {
    return res.status(409).json({ message: "You already passed this assignment." });
  }

  // Grade against exactly the subset this attempt was served — see
  // employeeSubmitQuiz for why.
  const gradedQuestions = resolveAttemptQuestions({ assessment, progress: reservedProgress, field: "finalAssignment" });

  let score = 0;
  let correct = 0;
  let wrong = 0;
  let total = 0;
  let passed = false;
  const result = [];

  if (gradedQuestions.length) {
    total = gradedQuestions.length;
    gradedQuestions.forEach((question, index) => {
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

  const recentAttemptsAfter = recentAttempts + 1;
  const attemptsRemainingThisMonth = Math.max(0, maxAttempts - recentAttemptsAfter);
  if (passed) {
    reservedProgress.finalAssignmentRetakeDueBy = null;
    reservedProgress.finalAssignmentRetakeReminderSentAt = null;
  } else if (attemptsRemainingThisMonth > 0) {
    reservedProgress.finalAssignmentRetakeDueBy = addDays(new Date(), RETAKE_DEADLINE_DAYS);
    reservedProgress.finalAssignmentRetakeReminderSentAt = null;
  } else {
    reservedProgress.finalAssignmentRetakeDueBy = null;
  }

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
    remainingAttempts: attemptsRemainingThisMonth,
    canRetake: !passed && attemptsRemainingThisMonth > 0,
    retakeDueBy: reservedProgress.finalAssignmentRetakeDueBy,
    finalAssignmentStatus: reservedProgress.finalAssignmentStatus,
    result,
    badgeAwarded: false,
    skillAwarded: false,
  };

  if (passed && assessment.badge) {
    const badgeResult = await awardBadgeOnce({ employeeId, badgeId: assessment.badge, courseId, progress: reservedProgress, alreadyAwardedFlag: "finalAssignmentBadgeAwarded", assessmentType: "assignment" });
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
    questionIds: reservedProgress.finalAssignmentCurrentAttempt?.questionIds || [],
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
  reservedProgress.finalAssignmentCurrentAttempt = { attemptNo: 0, questionIds: [], startedAt: null };

  await reservedProgress.save();

  if (!passed && attemptsRemainingThisMonth === 0) {
    await notifyManagerOfExhaustedAttempts({ employeeId, courseId, assessmentType: "assignment", title: assessment.title, score, maxAttempts });
  }

  res.json(responseData);
};
