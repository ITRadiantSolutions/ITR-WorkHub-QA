import { describe, it, expect } from "vitest";
import { sampleSectionedAttemptQuestions } from "./lmsQuestionSampling.js";

const makePool = () => [
  ...Array.from({ length: 40 }, (_, i) => ({ _id: `n${i}`, section: "Node.js" })),
  ...Array.from({ length: 40 }, (_, i) => ({ _id: `r${i}`, section: "React.js" })),
];

const SECTIONS = [
  { name: "Node.js", count: 20 },
  { name: "React.js", count: 20 },
];

describe("sampleSectionedAttemptQuestions", () => {
  it("draws exactly the per-section quota", () => {
    const picked = sampleSectionedAttemptQuestions(makePool(), SECTIONS);
    expect(picked).toHaveLength(40);
    expect(picked.filter((id) => id.startsWith("n"))).toHaveLength(20);
    expect(picked.filter((id) => id.startsWith("r"))).toHaveLength(20);
  });

  it("only pulls ids from the matching section", () => {
    const picked = sampleSectionedAttemptQuestions(makePool(), [{ name: "Node.js", count: 10 }]);
    expect(picked).toHaveLength(10);
    expect(picked.every((id) => id.startsWith("n"))).toBe(true);
  });

  it("returns section-major order (all Node ids before React ids)", () => {
    const picked = sampleSectionedAttemptQuestions(makePool(), SECTIONS);
    const firstReactAt = picked.findIndex((id) => id.startsWith("r"));
    expect(picked.slice(0, firstReactAt).every((id) => id.startsWith("n"))).toBe(true);
  });

  it("re-rolls to differ from the previous attempt when the pool allows", () => {
    const pool = makePool();
    const prev = sampleSectionedAttemptQuestions(pool, SECTIONS);
    const next = sampleSectionedAttemptQuestions(pool, SECTIONS, prev);
    const sameSet = prev.length === next.length && new Set(prev).size === new Set([...prev, ...next]).size;
    expect(sameSet).toBe(false);
  });

  it("gives up gracefully when a section is smaller than its quota", () => {
    const pool = [
      { _id: "n0", section: "Node.js" },
      { _id: "n1", section: "Node.js" },
      { _id: "r0", section: "React.js" },
    ];
    const picked = sampleSectionedAttemptQuestions(pool, [
      { name: "Node.js", count: 5 },
      { name: "React.js", count: 5 },
    ]);
    expect(picked.sort()).toEqual(["n0", "n1", "r0"]);
  });
});
