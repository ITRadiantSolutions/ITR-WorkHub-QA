import crypto from "crypto";
import xlsx from "xlsx";
import SkillTest, { DEFAULT_GRADE_BANDS } from "../models/SkillTest.js";
import SkillTestProgress from "../models/SkillTestProgress.js";
import SkillGroup from "../models/SkillGroup.js";
import Skill from "../models/Skill.js";
import User from "../models/User.js";
import { awardBadgeOnce, awardSkillOnce } from "../utils/lmsAwards.js";
import { sampleAttemptQuestions, sampleSectionedAttemptQuestions } from "../utils/lmsQuestionSampling.js";
import { resolveGrade } from "../utils/lmsGrading.js";
import { generateMcqQuestions } from "../utils/lmsQuestionGenerator.js";

const isManager = (user) => user.isSuperAdmin || ["manager", "admin"].includes(user.roles.lms);

export const validateQuestionPool = (questionPool) => {
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

// Returns { error } or { attemptSize } — the derived per-attempt size is the
// sum of the section counts, and each count must be satisfiable from the pool.
export const validateSections = (sections, questionPool) => {
  if (!Array.isArray(sections) || !sections.length) return { error: "sections must be a non-empty array" };
  const seen = new Set();
  let attemptSize = 0;
  for (const s of sections) {
    const name = String(s?.name ?? "").trim();
    const count = Number(s?.count);
    if (!name) return { error: "Every section needs a name" };
    if (seen.has(name.toLowerCase())) return { error: `Duplicate section: ${name}` };
    seen.add(name.toLowerCase());
    if (!Number.isInteger(count) || count < 1) return { error: `Section "${name}" needs a whole count of at least 1` };
    const available = (questionPool || []).filter((q) => (q.section || "").trim() === name).length;
    if (count > available) return { error: `Section "${name}" wants ${count} question(s) but the pool only has ${available}` };
    attemptSize += count;
  }
  return { attemptSize };
};

export const validateGradeBands = (gradeBands) => {
  if (!Array.isArray(gradeBands) || !gradeBands.length) return "gradeBands must be a non-empty array";
  let hasZero = false;
  for (const b of gradeBands) {
    if (!String(b?.label ?? "").trim()) return "Every grade band needs a label";
    const min = Number(b?.minPercent);
    if (!Number.isFinite(min) || min < 0 || min > 100) return "Every grade band needs a minPercent between 0 and 100";
    if (min === 0) hasZero = true;
  }
  if (!hasZero) return "One grade band must start at 0% so every score maps to a grade";
  return null;
};

// ── Question import (JSON / CSV / XLSX / plain text) ────────────────────────
//
// Stateless: parses an uploaded file into testQuestionSchema-shaped objects
// and hands them back for the builder to merge — it never touches the DB, so
// it works before a test has been saved. Accepted shapes:
//   JSON  — an array of { section, type, prompt, options:[...], correctOptionIndex,
//           acceptableAnswers:[...], explanation }
//   CSV / XLSX (tabular) — columns: section, type, prompt, optionA..optionD,
//           correct (A-D or 1-4), acceptableAnswers ("|"-separated), explanation
//   CSV / TXT (prose) — a flattened MCQ study guide: numbered "1. …" prompts,
//           "A. / B. / …" options, "Answer: X", "Explanation: …". Used when the
//           tabular parse finds no usable columns.
const LETTER_TO_INDEX = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };

// Lead-ins the study guide prepends to reworded duplicates of an earlier
// question. Stripping them makes those rows collapse against the originals
// under the builder's prompt-dedupe, so a 400-line guide imports as its ~100
// unique questions.
const REWORD_PREFIXES = [
  "In a production project, which statement about this concept is correct?",
  "Which statement best explains the practical importance of this concept?",
  "During code review, which answer would be considered correct?",
  "Which option should an experienced developer choose?",
];

const stripRewordPrefix = (text) => {
  let out = text.trim();
  for (const prefix of REWORD_PREFIXES) {
    if (out.toLowerCase().startsWith(prefix.toLowerCase())) {
      out = out.slice(prefix.length).trim();
      break;
    }
  }
  return out;
};

const NOISE_RE = /(Learning MCQ Guide|LEARNING QUESTIONS|^Page \d+$|^\d+ Questions|Quick Learning Score Guide|^Use the score|^Purpose:|^Recommended approach:)/i;
const SECTION_HEADER_RE = /^(Fundamentals|Modules and Core APIs|Async Programming|Express and APIs|Security and Production|Hooks and State|Rendering and Performance|Forms,? Routing and Data|Advanced React)$/i;

// Walks flattened study-guide lines and emits { prompt, options, correctLetter,
// explanation, section } blocks. Lines that aren't a number/option/Answer/
// Explanation marker continue whatever field is currently open (prompts and
// explanations wrap across lines in the source PDF).
export const parseQuestionBlocks = (lines) => {
  const blocks = [];
  let cur = null;
  let section = "";
  let field = null; // "prompt" | "explanation"

  const flush = () => {
    if (cur && cur.prompt && cur.options.length >= 2 && cur.correctLetter) blocks.push(cur);
    cur = null;
    field = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    if (/NODE\.?JS.*LEARNING QUESTIONS/i.test(line)) { section = "Node.js"; continue; }
    if (/REACT\.?JS.*LEARNING QUESTIONS/i.test(line)) { section = "React.js"; continue; }
    if (NOISE_RE.test(line) || SECTION_HEADER_RE.test(line)) continue;

    const numMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numMatch) {
      flush();
      cur = { prompt: stripRewordPrefix(numMatch[2]), options: [], correctLetter: "", explanation: "", section };
      field = "prompt";
      continue;
    }
    if (!cur) continue;

    const optMatch = line.match(/^([A-H])[.)]\s+(.*)$/);
    if (optMatch) {
      cur.options.push(optMatch[2].trim());
      field = null;
      continue;
    }
    const ansMatch = line.match(/^Answer:\s*([A-H])\b/i);
    if (ansMatch) {
      cur.correctLetter = ansMatch[1].toLowerCase();
      field = null;
      continue;
    }
    const explMatch = line.match(/^Explanation:?\s*(.*)$/i);
    if (explMatch) {
      cur.explanation = explMatch[1].trim();
      field = "explanation";
      continue;
    }
    // Continuation of the currently open field.
    if (field === "prompt") cur.prompt = stripRewordPrefix(`${cur.prompt} ${line}`);
    else if (field === "explanation") cur.explanation = `${cur.explanation} ${line}`.trim();
  }
  flush();
  return blocks;
};

const normalizeImportedQuestion = (raw, rowLabel) => {
  const prompt = String(raw.prompt ?? raw.Prompt ?? raw.question ?? raw.Question ?? "").trim();
  if (!prompt) return { error: `${rowLabel}: prompt is required` };

  const type = String(raw.type ?? raw.Type ?? "mcq").trim().toLowerCase() === "fill_blank" ? "fill_blank" : "mcq";
  const section = String(raw.section ?? raw.Section ?? "").trim();
  const explanation = String(raw.explanation ?? raw.Explanation ?? "").trim();

  if (type === "fill_blank") {
    const rawAnswers = Array.isArray(raw.acceptableAnswers)
      ? raw.acceptableAnswers
      : String(raw.acceptableAnswers ?? raw.AcceptableAnswers ?? "").split("|");
    const acceptableAnswers = rawAnswers.map((a) => String(a).trim()).filter(Boolean);
    if (!acceptableAnswers.length) return { error: `${rowLabel}: fill_blank needs at least one acceptableAnswers value` };
    return { question: { type, prompt, section, explanation, options: [], correctOptionIndex: 0, acceptableAnswers } };
  }

  let optionTexts;
  if (Array.isArray(raw.options)) {
    optionTexts = raw.options.map((o) => String(typeof o === "object" && o ? o.text ?? "" : o).trim());
  } else {
    optionTexts = ["A", "B", "C", "D", "E", "F"]
      .map((L) => raw[`option${L}`] ?? raw[`Option${L}`] ?? raw[`option_${L.toLowerCase()}`])
      .map((v) => String(v ?? "").trim());
  }
  optionTexts = optionTexts.filter(Boolean);
  if (optionTexts.length < 2) return { error: `${rowLabel}: MCQ needs at least 2 options` };

  let idx;
  if (raw.correctOptionIndex !== undefined && raw.correctOptionIndex !== "") {
    idx = Number(raw.correctOptionIndex);
  } else {
    const correct = String(raw.correct ?? raw.Correct ?? raw.answer ?? raw.Answer ?? "").trim().toLowerCase();
    idx = correct in LETTER_TO_INDEX ? LETTER_TO_INDEX[correct] : Number(correct) - 1;
  }
  if (!Number.isInteger(idx) || idx < 0 || idx >= optionTexts.length) {
    return { error: `${rowLabel}: correct answer must be one of A-${String.fromCharCode(64 + optionTexts.length)} (or 1-${optionTexts.length})` };
  }

  return {
    question: { type, prompt, section, explanation, options: optionTexts.map((text) => ({ text })), correctOptionIndex: idx, acceptableAnswers: [] },
  };
};

// Fallback for a flattened study-guide file — build questions from
// parseQuestionBlocks() output instead of tabular columns.
export const parseProseQuestions = (lines) => {
  const questions = [];
  const errors = [];
  parseQuestionBlocks(lines).forEach((b, i) => {
    const idx = LETTER_TO_INDEX[b.correctLetter];
    if (!Number.isInteger(idx) || idx >= b.options.length) {
      errors.push({ row: i + 1, message: `"${b.prompt.slice(0, 60)}…" has no usable Answer line` });
      return;
    }
    questions.push({
      type: "mcq",
      prompt: b.prompt,
      section: b.section || "",
      explanation: b.explanation || "",
      options: b.options.map((text) => ({ text })),
      correctOptionIndex: idx,
      acceptableAnswers: [],
    });
  });
  return { questions, errors };
};

export const adminParseQuestions = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  if (!req.file) return res.status(400).json({ message: "A .json, .csv, .xlsx or .txt file is required." });

  const name = (req.file.originalname || "").toLowerCase();
  const isJson = name.endsWith(".json") || req.file.mimetype === "application/json";
  const isText = name.endsWith(".txt") || req.file.mimetype === "text/plain";

  let rows; // tabular rows (JSON objects or sheet rows); null when text-only
  let lines; // flattened lines for the prose fallback
  try {
    if (isJson) {
      const parsed = JSON.parse(req.file.buffer.toString("utf-8"));
      rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : null;
      if (!rows) return res.status(400).json({ message: "JSON must be an array of questions (or { questions: [...] })." });
    } else if (isText) {
      lines = req.file.buffer.toString("utf-8").split(/\r?\n/);
    } else {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) return res.status(400).json({ message: "The spreadsheet has no sheets." });
      rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      lines = xlsx.utils
        .sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" })
        .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")).join(" ") : String(r ?? "")));
    }
  } catch (error) {
    return res.status(400).json({ message: `Could not parse the file: ${error.message}` });
  }

  let questions = [];
  let errors = [];

  if (rows?.length) {
    rows.forEach((raw, i) => {
      const result = normalizeImportedQuestion(raw, `Row ${i + 2}`);
      if (result.error) errors.push({ row: i + 2, message: result.error });
      else questions.push(result.question);
    });
  }

  // No usable columns (e.g. a flattened PDF export) — retry as prose.
  if (!questions.length && lines?.length) {
    const prose = parseProseQuestions(lines);
    questions = prose.questions;
    errors = prose.errors;
  }

  if (!questions.length && !errors.length) {
    return res.status(400).json({ message: "No questions found in the file." });
  }

  res.json({ questions, errors, counts: { parsed: questions.length, skipped: errors.length } });
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
  const { title, description, durationMinutes, questionPool, attemptSize, sections, gradeBands, maxAttempts, passingPercentage, skill, badge } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: "title is required" });
  if (!durationMinutes || durationMinutes < 1) return res.status(400).json({ message: "durationMinutes must be at least 1" });

  const poolError = validateQuestionPool(questionPool);
  if (poolError) return res.status(400).json({ message: poolError });

  // Sectioned test => attemptSize is derived from the per-section quotas;
  // otherwise it's a flat count bounded by the pool.
  let size;
  const useSections = Array.isArray(sections) && sections.length > 0;
  if (useSections) {
    const result = validateSections(sections, questionPool);
    if (result.error) return res.status(400).json({ message: result.error });
    size = result.attemptSize;
  } else {
    size = Number(attemptSize);
    if (!size || size < 1) return res.status(400).json({ message: "attemptSize must be at least 1" });
    if (size > (questionPool || []).length) return res.status(400).json({ message: "attemptSize cannot exceed the question pool size" });
  }

  const bands = gradeBands === undefined ? DEFAULT_GRADE_BANDS : gradeBands;
  const bandsError = validateGradeBands(bands);
  if (bandsError) return res.status(400).json({ message: bandsError });

  const test = await SkillTest.create({
    title: title.trim(),
    description: description || "",
    createdBy: req.user._id,
    durationMinutes,
    questionPool: questionPool || [],
    attemptSize: size,
    sections: useSections ? sections.map((s) => ({ name: String(s.name).trim(), count: Number(s.count) })) : [],
    gradeBands: [...bands].sort((a, b) => b.minPercent - a.minPercent),
    maxAttempts: maxAttempts || 3,
    passingPercentage: passingPercentage ?? 80,
    skill: skill || null,
    badge: badge || null,
  });
  res.status(201).json(test);
};

// Auto-generates a question pool for a skill via Claude and saves it as a
// new, unpublished SkillTest — the admin reviews/edits it in the regular
// builder (same as a manually-created test) before publishing.
export const adminGenerateSkillTest = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { skillId } = req.body;
  if (!skillId) return res.status(400).json({ message: "skillId is required" });

  const skill = await Skill.findById(skillId);
  if (!skill) return res.status(404).json({ message: "Skill not found" });

  const count = Math.min(100, Math.max(5, Number(req.body.count) || 50));

  let questionPool;
  try {
    questionPool = await generateMcqQuestions({
      skillName: skill.name,
      category: skill.category,
      description: skill.description,
      count,
    });
  } catch (error) {
    return res.status(502).json({ message: error.message || "Question generation failed" });
  }

  if (!questionPool.length) {
    return res.status(422).json({ message: "The AI didn't return any usable questions — try again." });
  }

  const test = await SkillTest.create({
    title: `${skill.name} — AI Generated`,
    description: "",
    createdBy: req.user._id,
    durationMinutes: 30,
    questionPool,
    attemptSize: Math.min(20, questionPool.length),
    maxAttempts: 3,
    passingPercentage: 80,
    skill: skill._id,
    isPublished: false,
  });
  res.status(201).json(test);
};

export const adminUpdateSkillTest = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const test = await SkillTest.findById(req.params.testId);
  if (!test) return res.status(404).json({ message: "Test not found" });

  const { title, description, durationMinutes, questionPool, attemptSize, sections, gradeBands, maxAttempts, passingPercentage, skill, badge, isPublished } = req.body;

  if (questionPool !== undefined) {
    const poolError = validateQuestionPool(questionPool);
    if (poolError) return res.status(400).json({ message: poolError });
  }
  const effectivePool = questionPool !== undefined ? questionPool : test.questionPool;
  const effectiveSections = sections !== undefined ? sections : test.sections;
  const useSections = Array.isArray(effectiveSections) && effectiveSections.length > 0;

  let effectiveSize;
  if (useSections) {
    const result = validateSections(effectiveSections, effectivePool);
    if (result.error) return res.status(400).json({ message: result.error });
    effectiveSize = result.attemptSize;
  } else {
    effectiveSize = attemptSize !== undefined ? Number(attemptSize) : test.attemptSize;
    if (effectiveSize > effectivePool.length) return res.status(400).json({ message: "attemptSize cannot exceed the question pool size" });
  }

  if (gradeBands !== undefined) {
    const bandsError = validateGradeBands(gradeBands);
    if (bandsError) return res.status(400).json({ message: bandsError });
  }

  if (title !== undefined) test.title = title.trim();
  if (description !== undefined) test.description = description;
  if (durationMinutes !== undefined) test.durationMinutes = durationMinutes;
  if (questionPool !== undefined) test.questionPool = questionPool;
  if (sections !== undefined) test.sections = useSections ? sections.map((s) => ({ name: String(s.name).trim(), count: Number(s.count) })) : [];
  test.attemptSize = effectiveSize;
  if (gradeBands !== undefined) test.gradeBands = [...gradeBands].sort((a, b) => b.minPercent - a.minPercent);
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

// Per-test results for managers/admins: every eligible employee (members of
// the test's skill groups) with their attempt status, best score, grade and
// section split — including those who have not started (no progress doc).
export const adminGetTestResults = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });

  const test = await SkillTest.findById(req.params.testId)
    .select("title skillGroups maxAttempts passingPercentage sections gradeBands isPublished")
    .populate("skillGroups", "name");
  if (!test) return res.status(404).json({ message: "Test not found" });

  const groups = await SkillGroup.find({ _id: { $in: test.skillGroups.map((g) => g._id) } }).select("members");
  const eligibleIds = [...new Set(groups.flatMap((g) => g.members.map(String)))];

  const [users, progresses] = await Promise.all([
    User.find({ _id: { $in: eligibleIds } }).select("name email department designation").sort({ name: 1 }),
    SkillTestProgress.find({ test: test._id, employee: { $in: eligibleIds } }),
  ]);
  const byEmp = new Map(progresses.map((p) => [String(p.employee), p]));

  const rows = users.map((u) => {
    const p = byEmp.get(String(u._id));
    const history = p?.attemptsHistory || [];
    const last = history[history.length - 1];
    const bestScore = history.length ? Math.max(...history.map((a) => a.score ?? 0)) : null;
    return {
      employeeId: u._id,
      name: u.name,
      email: u.email,
      department: u.department || "",
      designation: u.designation || "",
      status: p?.status || "not_started",
      attempts: p?.attemptCount || 0,
      bestScore,
      lastScore: last?.score ?? null,
      grade: last?.grade || "",
      passed: p?.status === "passed",
      sectionBreakdown: last?.sectionBreakdown || [],
      lastAttemptAt: last?.submittedAt || null,
    };
  });

  const attempted = rows.filter((r) => r.status !== "not_started");
  const scored = rows.filter((r) => r.bestScore != null).map((r) => r.bestScore);
  const gradeDistribution = {};
  for (const r of attempted) if (r.grade) gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;

  res.json({
    test: {
      id: test._id,
      title: test.title,
      isPublished: test.isPublished,
      maxAttempts: test.maxAttempts,
      passingPercentage: test.passingPercentage,
      sections: test.sections,
      gradeBands: test.gradeBands,
      groups: test.skillGroups.map((g) => g.name),
    },
    summary: {
      eligible: rows.length,
      attempted: attempted.length,
      notStarted: rows.length - attempted.length,
      inProgress: rows.filter((r) => r.status === "in_progress").length,
      passed: rows.filter((r) => r.passed).length,
      failed: rows.filter((r) => r.status === "failed").length,
      avgScore: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
      gradeDistribution,
    },
    rows,
  });
};

// ── Employee-facing ──────────────────────────────────────────────────────────

// Never includes correctOptionIndex/acceptableAnswers — this is the only
// path employees reach the question pool through.
const sanitizeQuestion = (q) => {
  const base = { _id: q._id, type: q.type, prompt: q.prompt };
  if (q.type === "mcq") base.options = q.options.map((o) => ({ text: o.text }));
  return base;
};

// Post-submission only: joins a stored attempt's per-question outcomes back
// against the pool so the learner sees their answer, the right answer and the
// explanation. Safe to expose the correct answer here — the attempt is over.
export const buildAttemptReview = (test, answerResults = []) =>
  answerResults
    .map((a) => {
      const q = test.questionPool.find((qq) => String(qq._id) === String(a.question));
      if (!q) return null;
      return {
        prompt: q.prompt,
        section: q.section || "",
        type: q.type,
        options: q.type === "mcq" ? q.options.map((o) => o.text) : [],
        yourAnswer: a.given ?? null,
        correctOptionIndex: q.type === "mcq" ? q.correctOptionIndex : null,
        acceptableAnswers: q.type === "fill_blank" ? q.acceptableAnswers : [],
        isCorrect: Boolean(a.correct),
        explanation: q.explanation || "",
      };
    })
    .filter(Boolean);

const isEligibleForTest = async (test, employeeId) => {
  if (!test.skillGroups.length) return false;
  return Boolean(await SkillGroup.exists({ _id: { $in: test.skillGroups }, members: employeeId }));
};

export const employeeListAvailableTests = async (req, res) => {
  const employeeId = req.user._id;
  const groupIds = (await SkillGroup.find({ members: employeeId }).select("_id")).map((g) => g._id);
  const tests = await SkillTest.find({ isPublished: true, skillGroups: { $in: groupIds } })
    .select("title description durationMinutes attemptSize sections maxAttempts passingPercentage skill badge")
    .populate("skill", "name")
    .populate("badge", "name imageUrl");

  const progresses = await SkillTestProgress.find({ test: { $in: tests.map((t) => t._id) }, employee: employeeId });
  const progressByTest = new Map(progresses.map((p) => [String(p.test), p]));

  res.json(
    tests.map((t) => {
      const p = progressByTest.get(String(t._id));
      const lastAttempt = p?.attemptsHistory?.[p.attemptsHistory.length - 1];
      return {
        ...t.toObject(),
        status: p?.status || "not_started",
        attemptCount: p?.attemptCount || 0,
        canAttempt: p?.status !== "passed" && (p?.attemptCount || 0) < t.maxAttempts,
        lastScore: lastAttempt?.score ?? null,
        lastGrade: lastAttempt?.grade || null,
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
  const questionIds = test.sections?.length
    ? sampleSectionedAttemptQuestions(test.questionPool, test.sections, previousQuestionIds)
    : sampleAttemptQuestions(test.questionPool, test.attemptSize, previousQuestionIds);
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
      grade: last?.grade || "",
      sectionBreakdown: last?.sectionBreakdown || [],
      review: buildAttemptReview(test, last?.answers),
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
  const bySection = new Map(); // section name -> { correct, total }
  const answerResults = []; // { question, given, correct } — stored for the review screen
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
    answerResults.push({ question: q._id, given: given ?? null, correct: isCorrect });
    if (q.section) {
      const bucket = bySection.get(q.section) || { correct: 0, total: 0 };
      bucket.total++;
      if (isCorrect) bucket.correct++;
      bySection.set(q.section, bucket);
    }
  }
  const total = questions.length;
  const wrong = total - correct;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = score >= test.passingPercentage;
  const grade = resolveGrade(score, test.gradeBands);
  // Ordered by the test's own section list so the UI reads left-to-right the
  // same way it was authored.
  const sectionBreakdown = (test.sections || [])
    .map((s) => ({ name: s.name, ...(bySection.get(s.name) || { correct: 0, total: 0 }) }))
    .filter((s) => s.total > 0);

  progress.status = passed ? "passed" : "failed";
  progress.currentAttempt = { attemptNo: 0, questionIds: [], startedAt: null };
  progress.lastSubmission = { attemptNo, answersHash };

  const responseData = {
    passed,
    score,
    grade,
    sectionBreakdown,
    review: buildAttemptReview(test, answerResults),
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
    grade,
    sectionBreakdown,
    answers: answerResults,
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

// The learner revisiting their most recent completed attempt: same
// right/wrong + explanation breakdown they saw right after submitting.
export const employeeGetLastReview = async (req, res) => {
  const test = await SkillTest.findById(req.params.testId).select("title questionPool passingPercentage");
  if (!test) return res.status(404).json({ message: "Test not found" });

  const progress = await SkillTestProgress.findOne({ test: test._id, employee: req.user._id });
  const last = progress?.attemptsHistory?.[progress.attemptsHistory.length - 1];
  if (!last?.answers?.length) return res.status(404).json({ message: "No completed attempt to review yet." });

  res.json({
    title: test.title,
    attemptNo: last.attemptNo,
    submittedAt: last.submittedAt,
    score: last.score,
    grade: last.grade || "",
    passed: last.passed,
    correct: last.correctCount,
    wrong: last.wrongCount,
    total: last.totalQuestions,
    sectionBreakdown: last.sectionBreakdown || [],
    review: buildAttemptReview(test, last.answers),
  });
};
