// Maps a score percentage to a SkillTest grade-band label. Bands are
// {label, minPercent}; the highest band whose minPercent the score reaches
// wins. Independent of passingPercentage, which still gates badge/skill awards.

export const resolveGrade = (scorePercent, gradeBands) => {
  if (!Array.isArray(gradeBands) || !gradeBands.length) return "";
  const sorted = [...gradeBands].sort((a, b) => b.minPercent - a.minPercent);
  const hit = sorted.find((band) => scorePercent >= band.minPercent);
  return hit?.label || "";
};
