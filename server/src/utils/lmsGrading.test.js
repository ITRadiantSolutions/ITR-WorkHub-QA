import { describe, it, expect } from "vitest";
import { resolveGrade } from "./lmsGrading.js";

const BANDS = [
  { label: "Expert", minPercent: 90 },
  { label: "Proficient", minPercent: 75 },
  { label: "Intermediate", minPercent: 50 },
  { label: "Beginner", minPercent: 25 },
  { label: "Needs Revision", minPercent: 0 },
];

describe("resolveGrade", () => {
  it.each([
    [0, "Needs Revision"],
    [24, "Needs Revision"],
    [25, "Beginner"],
    [49, "Beginner"],
    [50, "Intermediate"],
    [74, "Intermediate"],
    [75, "Proficient"],
    [89, "Proficient"],
    [90, "Expert"],
    [100, "Expert"],
  ])("maps %i%% to %s", (score, label) => {
    expect(resolveGrade(score, BANDS)).toBe(label);
  });

  it("works regardless of band order", () => {
    const shuffled = [BANDS[2], BANDS[0], BANDS[4], BANDS[3], BANDS[1]];
    expect(resolveGrade(80, shuffled)).toBe("Proficient");
  });

  it("returns '' when there are no bands", () => {
    expect(resolveGrade(50, [])).toBe("");
    expect(resolveGrade(50, undefined)).toBe("");
  });
});
