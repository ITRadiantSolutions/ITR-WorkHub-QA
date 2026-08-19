import EmployeeProfile from "../models/EmployeeProfile.js";
import Badge from "../models/Badge.js";
import Skill from "../models/Skill.js";

// Shared badge/skill-award logic — originally lived only in
// lmsProgressController.js (course quiz/assignment path), extracted so the
// new skill-test path (lmsSkillTestController.js) writes to the exact same
// EmployeeProfile.skills[]/badges[]/badgeAwards[] instead of forking it, so a
// skill/badge shows up the same way regardless of how it was earned.

export const awardBadgeToEmployee = async ({ employeeId, badgeId, courseId, testId, assessmentType }) => {
  if (!badgeId || (!courseId && !testId) || !assessmentType) return false;

  let profile = await EmployeeProfile.findOne({ employee: employeeId });
  if (!profile) profile = await EmployeeProfile.create({ employee: employeeId });

  const hasBadge = profile.badges.some((id) => String(id) === String(badgeId));
  if (!hasBadge) profile.badges.push(badgeId);

  const hasAward = (profile.badgeAwards || []).some(
    (award) =>
      String(award.badge) === String(badgeId) &&
      award.assessmentType === assessmentType &&
      (courseId ? String(award.course) === String(courseId) : String(award.test) === String(testId)),
  );
  if (hasAward) return false;

  profile.badgeAwards.push({
    badge: badgeId,
    course: courseId || null,
    test: testId || null,
    assessmentType,
    earnedAt: new Date(),
  });
  await profile.save();
  return true;
};

export const awardSkillToEmployee = async (employeeId, skillId) => {
  if (!skillId) return false;

  let profile = await EmployeeProfile.findOne({ employee: employeeId });
  if (!profile) profile = await EmployeeProfile.create({ employee: employeeId });

  const skillIndex = profile.skills.findIndex((item) => String(item.skill) === String(skillId));
  if (skillIndex !== -1) {
    if (profile.skills[skillIndex].status !== "Verified") {
      profile.skills[skillIndex].status = "Verified";
      profile.skills[skillIndex].verifiedAt = new Date();
    }
  } else {
    profile.skills.push({ skill: skillId, level: "Beginner", status: "Verified", verifiedAt: new Date(), assignedAt: new Date() });
    profile.totalSkills = profile.skills.length;
  }

  await profile.save();
  return true;
};

export const loadBadgeOrSkill = async (Model, id) => {
  if (!id) return null;
  const doc = await Model.findById(id);
  if (!doc) return null;
  return { id: doc._id, name: doc.name, description: doc.description || doc.category || "", imageUrl: doc.imageUrl || "" };
};

export const awardBadgeOnce = async ({ employeeId, badgeId, courseId, testId, progress, alreadyAwardedFlag, assessmentType }) => {
  if (!badgeId || progress[alreadyAwardedFlag]) return { badgeAwarded: false, badge: null };
  const ok = await awardBadgeToEmployee({ employeeId, badgeId, courseId, testId, assessmentType });
  if (!ok) return { badgeAwarded: false, badge: null };
  return { badgeAwarded: true, badge: await loadBadgeOrSkill(Badge, badgeId) };
};

export const awardSkillOnce = async ({ employeeId, skillId, progress, alreadyAwardedFlag }) => {
  if (!skillId || progress[alreadyAwardedFlag]) return { skillAwarded: false, skill: null };
  const ok = await awardSkillToEmployee(employeeId, skillId);
  if (!ok) return { skillAwarded: false, skill: null };
  return { skillAwarded: true, skill: await loadBadgeOrSkill(Skill, skillId) };
};
