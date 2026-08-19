import crypto from "crypto";
import SkillTest from "../models/SkillTest.js";
import SkillTestProgress from "../models/SkillTestProgress.js";
import SkillGroup from "../models/SkillGroup.js";
import { awardBadgeOnce, awardSkillOnce } from "../utils/lmsAwards.js";

const isManager = (user) => user.isSuperAdmin || ["manager", "admin"].includes(user.roles.lms);

const validateQuestionPool = (questionPool) => {
  for (const q of questionPool || []) {
    if (!q.prompt?.trim()) return "Every question needs a prompt";
    if (q.type === "mcq") {
      if (!Array.isArray(q.options) || q.options.length < 2) return "Every MCQ question needs at least 2 options";
      if (q.correctOptionIndex == null || q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
        return "Every MCQ question needs a valid correct option";
      }
    } else if (q.type === "fill_blank") {
      if (!Array.isArray(q.acceptableAnswers) || !q.acceptableAnswers.filter((a) => a?.trim()).length) {
        return "Every fill-in-the-blank question needs at least one acceptable answer";
      }
    }
  }
  return null;
};

// ── Admin authoring ─────────────────────────────────────────────────────────

export const adminListSkillTests = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  res.json(
    await SkillTest.find()
      .populate("skill", "name")
      .populate("badge", "name imageUrl")
      .populate("skillGroups", "name")
      .sort({ createdAt: -1 }),
  );
};

export const adminGetSkillTestById = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const test = await SkillTest.findById(req.params.testId).populate("skillGroups", "name");
  if (!test) return res.status(404).json({ message: "Test not found" });
  res.json(test);
};

export const adminCreateSkillTest = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { title, description, durationMinutes, questionPool, attemptSize, maxAttempts, passingPercentage, skill, badge } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: "title is required" });
  if (!durationMinutes || durationMinutes < 1) return res.status(400).json({ message: "durationMinutes must be at least 1" });

  const poolError = validateQuestionPool(questionPool);
  if (poolError) return res.status(400).json({ message: poolError });

  const size = Number(attemptSize);
  if (!size || size < 1) return res.status(400).json({ message: "attemptSize must be at least 1" });
  if (size > (questionPool || []).length) return res.status(400).json({ message: "attemptSize cannot exceed the question pool size" });

  const test = await SkillTest.create({
    title: title.trim(),
    description: description || "",
    createdBy: req.user._id,
    durationMinutes,
    questionPool: questionPool || [],
    attemptSize: size,
    maxAttempts: maxAttempts || 3,
    passingPercentage: passingPercentage ?? 80,
    skill: skill || null,
    badge: badge || null,
  });
  res.status(201).json(test);
};

export const adminUpdateSkillTest = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const test = await SkillTest.findById(req.params.testId);
  if (!test) return res.status(404).json({ message: "Test not found" });

  const { title, description, durationMinutes, questionPool, attemptSize, maxAttempts, passingPercentage, skill, badge, isPublished } = req.body;

  if (questionPool !== undefined) {
    const poolError = validateQuestionPool(questionPool);
    if (poolError) return res.status(400).json({ message: poolError });
  }
  const effectivePool = questionPool !== undefined ? questionPool : test.questionPool;
  const effectiveSize = attemptSize !== undefined ? Number(attemptSize) : test.attemptSize;
  if (effectiveSize > effectivePool.length) return res.status(400).json({ message: "attemptSize cannot exceed the question pool size" });

  if (title !== undefined) test.title = title.trim();
  if (description !== undefined) test.description = description;
  if (durationMinutes !== undefined) test.durationMinutes = durationMinutes;
  if (questionPool !== undefined) test.questionPool = questionPool;
  if (attemptSize !== undefined) test.attemptSize = effectiveSize;
  if (maxAttempts !== undefined) test.maxAttempts = maxAttempts;
  if (passingPercentage !== undefined) test.passingPercentage = passingPercentage;
  if (skill !== undefined) test.skill = skill || null;
  if (badge !== undefined) test.badge = badge || null;
  if (isPublished !== undefined) test.isPublished = Boolean(isPublished);

  await test.save();
  res.json(test);
};

export const adminDeleteSkillTest = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const hasProgress = await SkillTestProgress.exists({ test: req.params.testId });
  if (hasProgress) return res.status(409).json({ message: "This test already has attempts recorded — unpublish it instead of deleting." });
  const test = await SkillTest.findByIdAndDelete(req.params.testId);
  if (!test) return res.status(404).json({ message: "Test not found" });
  res.status(204).send();
};

export const adminAssignToGroups = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { skillGroupIds } = req.body;
  if (!Array.isArray(skillGroupIds) || !skillGroupIds.length) return res.status(400).json({ message: "skillGroupIds must be a non-empty array" });
  const test = await SkillTest.findByIdAndUpdate(
    req.params.testId,
    { $addToSet: { skillGroups: { $each: skillGroupIds } } },
    { new: true },
  ).populate("skillGroups", "name");
  if (!test) return res.status(404).json({ message: "Test not found" });
  res.json(test);
};

export const adminUnassignGroup = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const test = await SkillTest.findByIdAndUpdate(
    req.params.testId,
    { $pull: { skillGroups: req.params.groupId } },
    { new: true },
  ).populate("skillGroups", "name");
  if (!test) return res.status(404).json({ message: "Test not found" });
  res.json(test);
};

// ── Employee-facing ──────────────────────────────────────────────────────────

// Never includes correctOptionIndex/acceptableAnswers — this is the only
// path employees reach the question pool through.
const sanitizeQuestion = (q) => {
  const base = { _id: q._id, type: q.type, prompt: q.prompt };
  if (q.type === "mcq") base.options = q.options.map((o) => ({ text: o.text }));
  return base;
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Random subset, re-rolled (up to 20 tries) if it exactly matches the
// immediately-previous attempt's set — gives up gracefully if the pool is
// too small to ever differ.
const sampleAttemptQuestions = (pool, attemptSize, previousQuestionIds) => {
  const ids = pool.map((q) => String(q._id));
  const prevSet = new Set((previousQuestionIds || []).map(String));
  let picked = ids;
  for (let i = 0; i < 20; i++) {
    picked = shuffle(ids).slice(0, attemptSize);
    const sameAsPrev = prevSet.size === picked.length && picked.every((id) => prevSet.has(id));
    if (!sameAsPrev) break;
  }
  return picked;
};

const isEligibleForTest = async (test, employeeId) => {
  if (!test.skillGroups.length) return false;
  return Boolean(await SkillGroup.exists({ _id: { $in: test.skillGroups }, members: employeeId }));
};

export const employeeListAvailableTests = async (req, res) => {
  const employeeId = req.user._id;
  const groupIds = (await SkillGroup.find({ members: employeeId }).select("_id")).map((g) => g._id);
  const tests = await SkillTest.find({ isPublished: true, skillGroups: { $in: groupIds } })
    .select("title description durationMinutes attemptSize maxAttempts passingPercentage skill badge")
    .populate("skill", "name")
    .populate("badge", "name imageUrl");

  const progresses = await SkillTestProgress.find({ test: { $in: tests.map((t) => t._id) }, employee: employeeId });
  const progressByTest = new Map(progresses.map((p) => [String(p.test), p]));

  res.json(
    tests.map((t) => {
      const p = progressByTest.get(String(t._id));
      return {
        ...t.toObject(),
        status: p?.status || "not_started",
        attemptCount: p?.attemptCount || 0,
        canAttempt: p?.status !== "passed" && (p?.attemptCount || 0) < t.maxAttempts,
      };
    }),
  );
};

export const employeeStartAttempt = async (req, res) => {
  const employeeId = req.user._id;
  const test = await SkillTest.findById(req.params.testId);
  if (!test || !test.isPublished) return res.status(404).json({ message: "Test not found" });
  if (!(await isEligibleForTest(test, employeeId))) return res.status(403).json({ message: "You're not eligible for this test" });

  let progress = await SkillTestProgress.findOne({ test: test._id, employee: employeeId });
  if (!progress) progress = await SkillTestProgress.create({ test: test._id, employee: employeeId });

  if (progress.status === "passed") return res.status(409).json({ message: "You have already passed this test." });
  if (progress.attemptCount >= test.maxAttempts) {
    return res.status(409).json({ message: `Maximum attempts (${test.maxAttempts}) reached for this test.` });
  }

  // Resume an in-progress attempt with the SAME questions — a page refresh
  // must not silently swap the paper mid-attempt.
  if (progress.status === "in_progress" && progress.currentAttempt?.questionIds?.length) {
    const ordered = progress.currentAttempt.questionIds
      .map((id) => test.questionPool.find((q) => String(q._id) === String(id)))
      .filter(Boolean);
    return res.json({
      testId: test._id,
      title: test.title,
      durationMinutes: test.durationMinutes,
      attemptNo: progress.currentAttempt.attemptNo,
      questions: ordered.map(sanitizeQuestion),
    });
  }

  // Atomically reserve the next attempt slot.
  const reserved = await SkillTestProgress.findOneAndUpdate(
    { _id: progress._id, status: { $ne: "passed" }, attemptCount: { $lt: test.maxAttempts } },
    { $inc: { attemptCount: 1 }, $set: { status: "in_progress" } },
    { new: true },
  );
  if (!reserved) return res.status(409).json({ message: `Maximum attempts (${test.maxAttempts}) reached for this test.` });

  const previousQuestionIds = progress.attemptsHistory[progress.attemptsHistory.length - 1]?.questionIds;
  const questionIds = sampleAttemptQuestions(test.questionPool, test.attemptSize, previousQuestionIds);
  reserved.currentAttempt = { attemptNo: reserved.attemptCount, questionIds, startedAt: new Date() };
  await reserved.save();

  const questions = questionIds.map((id) => test.questionPool.find((q) => String(q._id) === String(id))).filter(Boolean);
  res.json({
    testId: test._id,
    title: test.title,
    durationMinutes: test.durationMinutes,
    attemptNo: reserved.attemptCount,
    questions: questions.map(sanitizeQuestion),
  });
};

export const employeeSubmitAttempt = async (req, res) => {
  const employeeId = req.user._id;
  const { answers } = req.body; // { [questionId]: answerValue }

  const test = await SkillTest.findById(req.params.testId);
  if (!test) return res.status(404).json({ message: "Test not found" });

  const progress = await SkillTestProgress.findOne({ test: test._id, employee: employeeId });
  if (!progress || progress.status !== "in_progress" || !progress.currentAttempt?.questionIds?.length) {
    return res.status(409).json({ message: "No attempt in progress. Start the test first." });
  }

  // Duplicate-submit short-circuit (double-click, network retry) — mirrors
  // CourseProgress's quizLastSubmission idempotency check.
  const answersHash = crypto.createHash("sha1").update(JSON.stringify(answers || {})).digest("hex");
  const attemptNo = progress.currentAttempt.attemptNo;
  if (progress.lastSubmission?.attemptNo === attemptNo && progress.lastSubmission?.answersHash === answersHash) {
    const last = progress.attemptsHistory[progress.attemptsHistory.length - 1];
    return res.json({
      passed: last?.passed || false,
      score: last?.score || 0,
      correct: last?.correctCount || 0,
      wrong: last?.wrongCount || 0,
      total: last?.totalQuestions || 0,
      remainingAttempts: Math.max(0, test.maxAttempts - progress.attemptCount),
      canRetake: !last?.passed && progress.attemptCount < test.maxAttempts,
      badgeAwarded: false,
      skillAwarded: false,
      duplicate: true,
    });
  }

  // Grade only the question ids the server itself served for this attempt —
  // never a client-supplied list.
  const questionIds = progress.currentAttempt.questionIds;
  const questions = questionIds.map((id) => test.questionPool.find((q) => String(q._id) === String(id))).filter(Boolean);

  let correct = 0;
  for (const q of questions) {
    const given = answers?.[String(q._id)];
    let isCorrect = false;
    if (q.type === "mcq") {
      isCorrect = Number(given) === Number(q.correctOptionIndex);
    } else {
      const norm = String(given ?? "").trim().toLowerCase();
      isCorrect = norm.length > 0 && q.acceptableAnswers.some((a) => a.trim().toLowerCase() === norm);
    }
    if (isCorrect) correct++;
  }
  const total = questions.length;
  const wrong = total - correct;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = score >= test.passingPercentage;

  progress.status = passed ? "passed" : "failed";
  progress.currentAttempt = { attemptNo: 0, questionIds: [], startedAt: null };
  progress.lastSubmission = { attemptNo, answersHash };

  const responseData = {
    passed,
    score,
    total,
    correct,
    wrong,
    attempts: progress.attemptCount,
    maxAttempts: test.maxAttempts,
    passingPercentage: test.passingPercentage,
    remainingAttempts: Math.max(0, test.maxAttempts - progress.attemptCount),
    canRetake: !passed && progress.attemptCount < test.maxAttempts,
    badgeAwarded: false,
    skillAwarded: false,
    badge: null,
    skill: null,
  };

  if (passed && test.badge) {
    const badgeResult = await awardBadgeOnce({ employeeId, badgeId: test.badge, testId: test._id, progress, alreadyAwardedFlag: "badgeAwarded", assessmentType: "skill_test" });
    responseData.badgeAwarded = badgeResult.badgeAwarded;
    responseData.badge = badgeResult.badge;
    if (badgeResult.badgeAwarded) progress.badgeAwarded = true;
  }
  if (passed && test.skill) {
    const skillResult = await awardSkillOnce({ employeeId, skillId: test.skill, progress, alreadyAwardedFlag: "skillAwarded" });
    responseData.skillAwarded = skillResult.skillAwarded;
    responseData.skill = skillResult.skill;
    if (skillResult.skillAwarded) progress.skillAwarded = true;
  }

  progress.attemptsHistory.push({
    attemptNo,
    submittedAt: new Date(),
    questionIds,
    score,
    passed,
    correctCount: correct,
    wrongCount: wrong,
    totalQuestions: total,
    badgeAwarded: responseData.badgeAwarded,
    badgeId: responseData.badge?.id || test.badge || null,
    skillAwarded: responseData.skillAwarded,
    skillId: responseData.skill?.id || test.skill || null,
  });

  await progress.save();

  if (!passed) {
    responseData.message = "Review the courses already assigned to you, then retry.";
    responseData.reviewCoursesUrl = "/lms/courses?assigned=me";
  }

  res.json(responseData);
};

export const employeeGetProgress = async (req, res) => {
  const progress = await SkillTestProgress.findOne({ test: req.params.testId, employee: req.user._id });
  res.json(progress || { status: "not_started", attemptCount: 0, attemptsHistory: [] });
};
