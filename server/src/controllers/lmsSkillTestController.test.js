import { describe, it, expect } from "vitest";
import xlsx from "xlsx";
import { parseProseQuestions, parseQuestionBlocks, validateSections, validateGradeBands, buildAttemptReview } from "./lmsSkillTestController.js";

// A faithful slice of the flattened "Converted_Data_*.csv" the study-guide PDF
// produces: leading metadata, page-header noise, section switches, plain
// questions, and reworded-duplicate questions whose prompt + explanation wrap
// onto extra rows.
const FLATTENED_CSV = `,Node.js + React.js Learning-Purpose MCQ Guide,,
,400 Questions,,
Node.js + React.js Learning MCQ Guide, ,Page 1,
,NODE.JS - 200 LEARNING QUESTIONS,,
,Fundamentals,,
,1. What is Node.js?,,
,A. A JavaScript runtime environment,,
,B. A database,,
,C. A CSS framework,,
,D. A browser,,
,Answer: A,,
,Explanation:, ,"Node.js runs JavaScript outside the browser, commonly for servers, APIs, CLIs and tooling."
,2. Which JavaScript engine does Node.js use?,,
,A. V8,,
,B. SpiderMonkey,,
,C. JavaScriptCore,,
,D. Chakra,,
,Answer: A,,
,Explanation:, ,V8 executes JavaScript and is the engine used by Node.js.
,21. What is the event loop?,,
,A. A mechanism that coordinates asynchronous work,,
,B. A database loop,,
,C. A CSS renderer,,
,D. A compiler,,
,Answer: A,,
,Explanation:, ,The event loop allows Node.js to coordinate callbacks and asynchronous operations without blocking JavaScript
execution.,,,
Node.js + React.js Learning MCQ Guide, ,Page 8,
,"52. Which statement best explains the practical importance of this concept? Which JavaScript engine does",,
Node.js use?,,,
,A. V8,,
,B. SpiderMonkey,,
,C. JavaScriptCore,,
,D. Chakra,,
,Answer: A,,
,Explanation:, ,V8 executes JavaScript and is the engine used by Node.js.
,REACT.JS - 200 LEARNING QUESTIONS,,
,Fundamentals,,
,201. What is React?,,
,A. A JavaScript library for user interfaces,,
,B. A database,,
,C. A backend runtime,,
,D. A CSS preprocessor,,
,Answer: A,,
,Explanation:, ,React is used to build interactive user interfaces from reusable components.
,"253. During code review, which answer would be considered correct? Is JSX mandatory to use React?",,
,A. No,,
,B. Yes,,
,C. Only in production,,
,D. Only with TypeScript,,
,Answer: A,,
,Explanation:, ,"React can be used without JSX, although JSX is widely used because it makes UI code easier to express."
`;

const linesFromCsv = (csv) => {
  const sheet = xlsx.read(Buffer.from(csv), { type: "buffer" }).Sheets.Sheet1;
  return xlsx.utils
    .sheet_to_json(sheet, { header: 1, defval: "" })
    .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")).join(" ") : String(r ?? "")));
};

describe("parseProseQuestions (flattened study-guide CSV)", () => {
  const { questions } = parseProseQuestions(linesFromCsv(FLATTENED_CSV));

  it("extracts every numbered MCQ block", () => {
    expect(questions.map((q) => q.prompt)).toEqual([
      "What is Node.js?",
      "Which JavaScript engine does Node.js use?",
      "What is the event loop?",
      "Which JavaScript engine does Node.js use?", // Q52, prefix stripped + wrapped line joined
      "What is React?",
      "Is JSX mandatory to use React?", // Q253, prefix stripped
    ]);
  });

  it("strips reworded lead-ins so duplicates collapse under prompt-dedupe", () => {
    const byPrompt = questions.filter((q) => q.prompt === "Which JavaScript engine does Node.js use?");
    expect(byPrompt).toHaveLength(2);
    expect(new Set(questions.map((q) => q.prompt.toLowerCase())).size).toBe(5);
  });

  it("assigns sections from the NODE.JS / REACT.JS banners", () => {
    expect(questions.find((q) => q.prompt === "What is Node.js?").section).toBe("Node.js");
    expect(questions.find((q) => q.prompt === "What is React?").section).toBe("React.js");
  });

  it("keeps 4 options and the Answer: A -> index 0 mapping", () => {
    const q = questions[0];
    expect(q.options.map((o) => o.text)).toEqual(["A JavaScript runtime environment", "A database", "A CSS framework", "A browser"]);
    expect(q.correctOptionIndex).toBe(0);
  });

  it("joins explanations that wrap onto the next row", () => {
    expect(questions[2].explanation).toBe(
      "The event loop allows Node.js to coordinate callbacks and asynchronous operations without blocking JavaScript execution.",
    );
  });

  it("ignores page headers and section titles", () => {
    expect(questions.every((q) => !/Learning MCQ Guide|Page \d+|Fundamentals/i.test(q.prompt))).toBe(true);
  });
});

describe("parseQuestionBlocks", () => {
  it("drops a block with no Answer line", () => {
    const blocks = parseQuestionBlocks(["1. Broken?", "A. yes", "B. no", "2. Fine?", "A. a", "B. b", "Answer: B"]);
    expect(blocks.map((b) => b.prompt)).toEqual(["Fine?"]);
    expect(blocks[0].correctLetter).toBe("b");
  });
});

describe("validateSections", () => {
  const pool = [
    { section: "Node.js" },
    { section: "Node.js" },
    { section: "React.js" },
  ];
  it("derives attemptSize from the quotas", () => {
    expect(validateSections([{ name: "Node.js", count: 2 }, { name: "React.js", count: 1 }], pool)).toEqual({ attemptSize: 3 });
  });
  it("rejects a quota larger than the section pool", () => {
    expect(validateSections([{ name: "Node.js", count: 5 }], pool).error).toMatch(/only has 2/);
  });
  it("rejects duplicate section names", () => {
    expect(validateSections([{ name: "Node.js", count: 1 }, { name: "node.js", count: 1 }], pool).error).toMatch(/Duplicate/i);
  });
});

describe("validateGradeBands", () => {
  it("requires a band at 0%", () => {
    expect(validateGradeBands([{ label: "Pass", minPercent: 50 }])).toMatch(/0%/);
  });
  it("accepts a well-formed set", () => {
    expect(validateGradeBands([{ label: "Low", minPercent: 0 }, { label: "High", minPercent: 80 }])).toBeNull();
  });
});

describe("buildAttemptReview", () => {
  const test = {
    questionPool: [
      { _id: "q1", type: "mcq", prompt: "1+1?", section: "Math", options: [{ text: "1" }, { text: "2" }, { text: "3" }], correctOptionIndex: 1, explanation: "basic", acceptableAnswers: [] },
      { _id: "q2", type: "fill_blank", prompt: "capital of France?", section: "Geo", options: [], correctOptionIndex: 0, explanation: "", acceptableAnswers: ["Paris"] },
    ],
  };

  it("surfaces the learner's answer, the correct answer and the explanation", () => {
    const review = buildAttemptReview(test, [
      { question: "q1", given: 2, correct: false },
      { question: "q2", given: "Paris", correct: true },
    ]);
    expect(review[0]).toMatchObject({
      prompt: "1+1?",
      section: "Math",
      options: ["1", "2", "3"],
      yourAnswer: 2,
      correctOptionIndex: 1,
      isCorrect: false,
      explanation: "basic",
    });
    expect(review[1]).toMatchObject({ type: "fill_blank", yourAnswer: "Paris", acceptableAnswers: ["Paris"], isCorrect: true });
  });

  it("skips outcomes whose question is no longer in the pool", () => {
    const review = buildAttemptReview(test, [{ question: "gone", given: 0, correct: false }]);
    expect(review).toEqual([]);
  });
});
