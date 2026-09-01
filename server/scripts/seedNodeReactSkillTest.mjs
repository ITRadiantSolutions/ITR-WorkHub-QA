// Seeds (or refreshes) the "Node.js + React.js Assessment" SkillTest from
// src/assets/lms/nodejs-reactjs-question-bank.json — a convenience wrapper
// around what an admin can also do in the builder via "Import questions".
//
// Each attempt draws 20 Node.js + 20 React.js questions at random, so no two
// employees get the same paper. Score maps to the default grade bands
// (Needs Revision / Beginner / Intermediate / Proficient / Expert).
//
// Dry-run by default — prints what it would do, writes nothing. Pass --commit
// to apply. Re-running with --commit refreshes the question pool in place
// (matched by title) without touching recorded attempts.
//
//   node scripts/seedNodeReactSkillTest.mjs                 # preview
//   node scripts/seedNodeReactSkillTest.mjs --commit
//   node scripts/seedNodeReactSkillTest.mjs --commit --group="Full Stack Engineers"
//   node scripts/seedNodeReactSkillTest.mjs --commit --publish

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mongoose from "mongoose";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes("--commit");
const PUBLISH = process.argv.includes("--publish");
const GROUP_NAME = (process.argv.find((a) => a.startsWith("--group=")) || "").split("=").slice(1).join("=").trim();

const TITLE = "Node.js + React.js Assessment";
const SECTIONS = [
  { name: "Node.js", count: 20 },
  { name: "React.js", count: 20 },
];

const skillTestModule = await import("../src/models/SkillTest.js");
const SkillTest = skillTestModule.default;
const { DEFAULT_GRADE_BANDS } = skillTestModule;
const User = (await import("../src/models/User.js")).default;
const SkillGroup = (await import("../src/models/SkillGroup.js")).default;

await mongoose.connect(process.env.MONGO_URI);

try {
  const raw = JSON.parse(await readFile(path.join(__dirname, "../src/assets/lms/nodejs-reactjs-question-bank.json"), "utf-8"));
  const questionPool = raw.map((q) => ({
    type: q.type || "mcq",
    prompt: q.prompt,
    section: q.section || "",
    explanation: q.explanation || "",
    options: (q.options || []).map((o) => ({ text: typeof o === "string" ? o : o.text })),
    correctOptionIndex: Number(q.correctOptionIndex) || 0,
    acceptableAnswers: q.acceptableAnswers || [],
  }));

  const counts = SECTIONS.map((s) => `${s.name}: ${questionPool.filter((q) => q.section === s.name).length} in pool, ${s.count} per attempt`);
  console.log(`Loaded ${questionPool.length} questions —\n  ${counts.join("\n  ")}`);
  for (const s of SECTIONS) {
    const have = questionPool.filter((q) => q.section === s.name).length;
    if (have < s.count) throw new Error(`Not enough "${s.name}" questions: need ${s.count}, have ${have}`);
  }

  const author = await User.findOne({ $or: [{ isSuperAdmin: true }, { "roles.lms": "admin" }, { "roles.lms": "manager" }] }).select("_id name email");
  if (!author) throw new Error("No LMS admin/manager user found to own the test");
  console.log(`Author: ${author.name} <${author.email}>`);

  let group = null;
  if (GROUP_NAME) {
    group = await SkillGroup.findOne({ name: GROUP_NAME }).select("_id name members");
    if (!group) throw new Error(`Skill group "${GROUP_NAME}" not found — create it first under LMS → Skill Groups`);
    console.log(`Skill group: ${group.name} (${group.members.length} member(s))`);
  }

  const existing = await SkillTest.findOne({ title: TITLE });
  const doc = {
    title: TITLE,
    description: "20 Node.js + 20 React.js multiple-choice questions, drawn at random per attempt.",
    createdBy: author._id,
    durationMinutes: 40,
    questionPool,
    attemptSize: SECTIONS.reduce((sum, s) => sum + s.count, 0),
    sections: SECTIONS,
    gradeBands: DEFAULT_GRADE_BANDS,
    maxAttempts: 3,
    passingPercentage: 50,
    isPublished: PUBLISH,
  };

  if (!COMMIT) {
    console.log(`\n[dry run] would ${existing ? "update" : "create"} "${TITLE}" (published: ${PUBLISH}).`);
    console.log("Re-run with --commit to apply.");
  } else if (existing) {
    Object.assign(existing, { ...doc, isPublished: existing.isPublished || PUBLISH });
    if (group && !existing.skillGroups.some((g) => String(g) === String(group._id))) existing.skillGroups.push(group._id);
    await existing.save();
    console.log(`\nUpdated "${TITLE}" (${existing._id}).`);
  } else {
    const created = await SkillTest.create({ ...doc, skillGroups: group ? [group._id] : [] });
    console.log(`\nCreated "${TITLE}" (${created._id}).`);
  }
} finally {
  await mongoose.disconnect();
}
