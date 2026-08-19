import EmployeeProfile from "../models/EmployeeProfile.js";
import { createReadUrl } from "../config/blobStorage.js";

const isManager = (user) => user.isSuperAdmin || ["manager", "admin"].includes(user.roles.lms);

// New — not present in the source app's controllers (it read badges/skills
// off a combined userModel.enrolledCourses + profile fetch). Exposes just
// enough of EmployeeProfile for the "My Badges"/"My Skills" employee views;
// full resume/experience editing is HRMS-adjacent scope, not ported here.

export const getMyLearningProfile = async (req, res) => {
  let profile = await EmployeeProfile.findOne({ employee: req.user._id })
    .populate("badges", "name description imageUrl color category")
    .populate("skills.skill", "name category");

  if (!profile) profile = await EmployeeProfile.create({ employee: req.user._id });

  const badges = (profile.badges || []).map((badge) => {
    const obj = badge.toObject ? badge.toObject() : badge;
    return { ...obj, imageUrl: obj.imageUrl && !obj.imageUrl.startsWith("http") ? createReadUrl(obj.imageUrl) : obj.imageUrl };
  });

  res.json({ badges, skills: profile.skills || [], totalSkills: profile.totalSkills, totalCoursesCompleted: profile.totalCoursesCompleted });
};

// Manual skill editing — admin/manager can add or correct an employee's
// skill set directly, independent of course/test completion.

export const adminGetEmployeeProfile = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });

  let profile = await EmployeeProfile.findOne({ employee: req.params.employeeId }).populate("skills.skill", "name category");
  if (!profile) profile = await EmployeeProfile.create({ employee: req.params.employeeId });

  res.json({ skills: profile.skills || [], totalSkills: profile.totalSkills });
};

export const adminUpsertEmployeeSkill = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { skillId, level, status } = req.body;
  if (!skillId) return res.status(400).json({ message: "skillId is required" });

  let profile = await EmployeeProfile.findOne({ employee: req.params.employeeId });
  if (!profile) profile = await EmployeeProfile.create({ employee: req.params.employeeId });

  const existing = profile.skills.find((item) => String(item.skill) === String(skillId));
  if (existing) {
    if (level) existing.level = level;
    if (status) {
      existing.status = status;
      if (status === "Verified" && !existing.verifiedAt) existing.verifiedAt = new Date();
    }
  } else {
    profile.skills.push({
      skill: skillId,
      level: level || "Beginner",
      status: status || "Learning",
      verifiedAt: status === "Verified" ? new Date() : undefined,
      assignedAt: new Date(),
    });
    profile.totalSkills = profile.skills.length;
  }

  await profile.save();
  await profile.populate("skills.skill", "name category");
  res.json({ skills: profile.skills, totalSkills: profile.totalSkills });
};

export const adminRemoveEmployeeSkill = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });

  const profile = await EmployeeProfile.findOne({ employee: req.params.employeeId });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  profile.skills = profile.skills.filter((item) => String(item.skill) !== String(req.params.skillId));
  profile.totalSkills = profile.skills.length;
  await profile.save();
  await profile.populate("skills.skill", "name category");
  res.json({ skills: profile.skills, totalSkills: profile.totalSkills });
};
