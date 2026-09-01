import { describe, it, expect } from "vitest";
import { renderTestPaperPdfBuffer } from "./lmsTestPaper.js";

const test = {
  title: "Node.js + React.js Assessment",
  description: "Sample",
  durationMinutes: 40,
  attemptSize: 40,
  maxAttempts: 3,
  passingPercentage: 50,
  sections: [
    { name: "Node.js", count: 20 },
    { name: "React.js", count: 20 },
  ],
  gradeBands: [
    { label: "Expert", minPercent: 90 },
    { label: "Needs Revision", minPercent: 0 },
  ],
  questionPool: [
    { type: "mcq", prompt: "What is Node.js?", section: "Node.js", options: [{ text: "A runtime" }, { text: "A DB" }], correctOptionIndex: 0, acceptableAnswers: [] },
    { type: "fill_blank", prompt: "npm stands for ___", section: "Node.js", options: [], correctOptionIndex: 0, acceptableAnswers: ["node package manager"] },
    { type: "mcq", prompt: "What is JSX?", section: "React.js", options: [{ text: "Syntax extension" }, { text: "A DB" }, { text: "CSS" }], correctOptionIndex: 0, acceptableAnswers: [] },
  ],
};

describe("renderTestPaperPdfBuffer", () => {
  it("produces a non-empty PDF buffer", async () => {
    const buf = await renderTestPaperPdfBuffer(test);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("does not throw on a bare test with no sections / bands / options", async () => {
    const buf = await renderTestPaperPdfBuffer({
      title: "Bare",
      durationMinutes: 10,
      attemptSize: 1,
      maxAttempts: 1,
      passingPercentage: 50,
      questionPool: [{ type: "mcq", prompt: "Q?", options: [{ text: "a" }, { text: "b" }], correctOptionIndex: 1 }],
    });
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
