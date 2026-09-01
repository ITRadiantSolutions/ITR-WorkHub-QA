
export const resolveGrade = (scorePercent, gradeBands) => {
  if (!Array.isArray(gradeBands) || !gradeBands.length) return "";
  const sorted = [...gradeBands].sort((a, b) => b.minPercent - a.minPercent);
  const hit = sorted.find((band) => scorePercent >= band.minPercent);
  return hit?.label || "";
};
