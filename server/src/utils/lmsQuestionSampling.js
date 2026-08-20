// Shared by SkillTest (questionPool/attemptSize) and CourseAssessment
// (questions/sampleSize): draws a random subset of question ids from a pool
// so each attempt/employee sees a different slice of a large bank.

export const shuffle = (arr) => {
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
export const sampleAttemptQuestions = (pool, sampleSize, previousQuestionIds) => {
  const ids = pool.map((q) => String(q._id));
  const prevSet = new Set((previousQuestionIds || []).map(String));
  let picked = ids;
  for (let i = 0; i < 20; i++) {
    picked = shuffle(ids).slice(0, sampleSize);
    const sameAsPrev = prevSet.size === picked.length && picked.every((id) => prevSet.has(id));
    if (!sameAsPrev) break;
  }
  return picked;
};
