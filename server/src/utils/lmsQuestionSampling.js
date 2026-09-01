
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

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

export const sampleSectionedAttemptQuestions = (pool, sections, previousQuestionIds) => {
  const idsBySection = new Map();
  for (const q of pool) {
    const key = q.section || "";
    if (!idsBySection.has(key)) idsBySection.set(key, []);
    idsBySection.get(key).push(String(q._id));
  }

  const prev = (previousQuestionIds || []).map(String);
  const prevSet = new Set(prev);

  let picked = [];
  for (let i = 0; i < 20; i++) {
    picked = [];
    for (const { name, count } of sections) {
      const available = idsBySection.get(name) || [];
      picked.push(...shuffle(available).slice(0, count));
    }
    const sameAsPrev = prevSet.size === picked.length && picked.every((id) => prevSet.has(id));
    if (!sameAsPrev) break;
  }
  return picked;
};
