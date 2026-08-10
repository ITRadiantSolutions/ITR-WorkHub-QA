// Ported as-is from the standalone LMS project's utils/assignmentEligibility.js.
// Pure functions — no model/auth dependencies to adapt.

export const getEmployeeProfileCompletionPercent = (profile) => {
  if (!profile) return 0;

  const hasResume = Boolean(String(profile.resume || "").trim());
  const hasDescription = Boolean(String(profile.description || "").trim());
  const hasExperience = Array.isArray(profile.experiences) && profile.experiences.length > 0;
  const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
  const completedCriteria = [hasResume, hasDescription, hasExperience, hasSkills].filter(Boolean).length;
  const percentage = Math.round((completedCriteria / 4) * 100);

  return hasResume ? Math.max(50, percentage) : percentage;
};

export const isEmployeeProfileComplete = (profile) => getEmployeeProfileCompletionPercent(profile) >= 50;

export const hasGeneratedEmployeeReport = (report) => Boolean(report?.generatedAt);

export const getEmployeeAssignmentEligibility = ({ profile, report }) => {
  const profileCompletionPercent = getEmployeeProfileCompletionPercent(profile);
  const hasCompletedProfile = profileCompletionPercent >= 50;
  const hasGeneratedReport = hasGeneratedEmployeeReport(report);

  return {
    hasCompletedProfile,
    hasGeneratedReport,
    profileCompletionPercent,
    profileCompletionLabel: hasCompletedProfile ? `${profileCompletionPercent}% complete` : "Employee profile is not complete",
    reportStatusLabel: hasGeneratedReport ? "Report ready" : "Report pending",
    // Employees become assignable once their profile reaches 50% completion.
    canAssign: hasCompletedProfile,
  };
};
