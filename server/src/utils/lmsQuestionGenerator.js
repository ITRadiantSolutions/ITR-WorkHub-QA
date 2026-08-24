import axios from "axios";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const BATCH_SIZE = 10;

// A malformed item from the model shouldn't sink the whole batch — drop it
// and keep whatever parsed cleanly. Mirrors the shape lmsSkillTestController's
// validateQuestionPool expects for a "mcq" question.
const normalizeQuestion = (raw) => {
  if (!raw || typeof raw.prompt !== "string" || !raw.prompt.trim()) return null;
  const options = Array.isArray(raw.options) ? raw.options.filter((o) => typeof o === "string" && o.trim()) : [];
  if (options.length !== 4) return null;
  const correctOptionIndex = Number(raw.correctOptionIndex);
  if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex > 3) return null;
  return {
    type: "mcq",
    prompt: raw.prompt.trim(),
    options: options.map((text) => ({ text: text.trim() })),
    correctOptionIndex,
  };
};

const buildPrompt = ({ skillName, category, description, batchCount }) => {
  const context = [category ? `Category: ${category}` : null, description ? `Notes: ${description}` : null].filter(Boolean).join("\n");
  return (
    `Write ${batchCount} multiple-choice questions for a technical assessment on "${skillName}".\n` +
    (context ? `${context}\n` : "") +
    `Mix easy, medium and hard difficulty. Each question must be practical, unambiguous, and have exactly one correct answer.\n` +
    `Respond with ONLY a JSON object of the shape ` +
    `{"questions":[{"prompt":"...","options":["...","...","...","..."],"correctOptionIndex":0}]}. ` +
    `Exactly 4 options per question, correctOptionIndex is the 0-based index of the right option. No markdown, no commentary.`
  );
};

async function requestBatch({ skillName, category, description, batchCount }) {
  const response = await axios.post(
    OPENAI_CHAT_URL,
    {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: buildPrompt({ skillName, category, description, batchCount }) }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    },
    {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      timeout: 60_000,
    },
  );

  const content = response.data?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  const list = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return list.map(normalizeQuestion).filter(Boolean);
}

// Generates up to `count` MCQ questions for a skill, in parallel batches of
// BATCH_SIZE (smaller completions are far more reliable than one huge JSON
// blob). Malformed items are dropped rather than failing their batch; only
// throws if every batch request itself failed (network/auth/rate-limit).
export async function generateMcqQuestions({ skillName, category, description, count }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured on the server");
  }

  const batchSizes = [];
  let remaining = count;
  while (remaining > 0) {
    const size = Math.min(BATCH_SIZE, remaining);
    batchSizes.push(size);
    remaining -= size;
  }

  const results = await Promise.allSettled(
    batchSizes.map((batchCount) => requestBatch({ skillName, category, description, batchCount })),
  );

  const allFailed = results.every((r) => r.status === "rejected");
  if (allFailed) {
    throw new Error(results[0].reason?.response?.data?.error?.message || results[0].reason?.message || "Question generation failed");
  }

  const seenPrompts = new Set();
  const questions = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const question of result.value) {
      const key = question.prompt.toLowerCase();
      if (seenPrompts.has(key)) continue;
      seenPrompts.add(key);
      questions.push(question);
    }
  }

  return questions.slice(0, count);
}
