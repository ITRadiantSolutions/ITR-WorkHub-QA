import Anthropic from "@anthropic-ai/sdk";

const BATCH_SIZE = 10;
const DEFAULT_MODEL = "claude-haiku-4-5";

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

const extractJsonObject = (text) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
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

async function requestBatch(client, { skillName, category, description, batchCount }) {
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: 8192,
    system:
      "You are a technical assessment author. Reply with a single raw JSON object only — " +
      "no prose, no markdown, no code fences.",
    messages: [{ role: "user", content: buildPrompt({ skillName, category, description, batchCount }) }],
  });

  const content = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const parsed = JSON.parse(extractJsonObject(content));
  const list = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return list.map(normalizeQuestion).filter(Boolean);
}

export async function generateMcqQuestions({ skillName, category, description, count }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const batchSizes = [];
  let remaining = count;
  while (remaining > 0) {
    const size = Math.min(BATCH_SIZE, remaining);
    batchSizes.push(size);
    remaining -= size;
  }

  const results = await Promise.allSettled(
    batchSizes.map((batchCount) => requestBatch(client, { skillName, category, description, batchCount })),
  );

  const allFailed = results.every((r) => r.status === "rejected");
  if (allFailed) {
    const firstError = results.find((r) => r.status === "rejected")?.reason;
    throw new Error(firstError?.message || "Question generation failed");
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
