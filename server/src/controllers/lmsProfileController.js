import EmployeeProfile from "../models/EmployeeProfile.js";
import { createReadUrl, uploadAttachment } from "../config/blobStorage.js";
import { getEmployeeProfileCompletionPercent } from "../utils/lmsAssignmentEligibility.js";

const isManager = (user) => user.isSuperAdmin || ["manager", "admin"].includes(user.roles.lms);

// New — not present in the source app's controllers (it read badges/skills
// off a combined userModel.enrolledCourses + profile fetch). Exposes
// EmployeeProfile for the "My Badges"/"My Skills"/"My Profile" employee views.

export const getMyLearningProfile = async (req, res) => {
  let profile = await EmployeeProfile.findOne({ employee: req.user._id })
    .populate("badges", "name description imageUrl color category")
    .populate("skills.skill", "name category");

  if (!profile) profile = await EmployeeProfile.create({ employee: req.user._id });

  const badges = (profile.badges || []).map((badge) => {
    const obj = badge.toObject ? badge.toObject() : badge;
    return { ...obj, imageUrl: obj.imageUrl && !obj.imageUrl.startsWith("http") ? createReadUrl(obj.imageUrl) : obj.imageUrl };
  });

  res.json({
    badges,
    skills: profile.skills || [],
    totalSkills: profile.totalSkills,
    totalCoursesCompleted: profile.totalCoursesCompleted,
    resume: profile.resume ? createReadUrl(profile.resume) : null,
    hasResume: Boolean(profile.resume),
    description: profile.description || "",
    experiences: profile.experiences || [],
    profileCompletionPercent: getEmployeeProfileCompletionPercent(profile),
  });
};

// Self-service editing — an employee builds their own profile (skills,
// resume, description, work experience) toward the 50%/100% completion
// thresholds that gate course assignment (see utils/lmsAssignmentEligibility.js).

export const updateMyProfile = async (req, res) => {
  const { description, experiences } = req.body;

  let profile = await EmployeeProfile.findOne({ employee: req.user._id });
  if (!profile) profile = await EmployeeProfile.create({ employee: req.user._id });

  if (description !== undefined) profile.description = String(description).trim();
  if (Array.isArray(experiences)) {
    profile.experiences = experiences.map((exp) => ({
      company: String(exp?.company || "").trim(),
      role: String(exp?.role || "").trim(),
      start: String(exp?.start || "").trim(),
      end: String(exp?.end || "").trim(),
      description: String(exp?.description || "").trim(),
    }));
  }

  await profile.save();
  res.json({
    description: profile.description,
    experiences: profile.experiences,
    profileCompletionPercent: getEmployeeProfileCompletionPercent(profile),
  });
};

export const uploadMyResume = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "A resume file is required" });

  let profile = await EmployeeProfile.findOne({ employee: req.user._id });
  if (!profile) profile = await EmployeeProfile.create({ employee: req.user._id });

  const uploaded = await uploadAttachment({
    buffer: req.file.buffer,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    scope: "lms-resume",
    parentId: req.user._id.toString(),
  });
  profile.resume = uploaded.blobName;
  await profile.save();

  res.json({
    resume: createReadUrl(profile.resume),
    profileCompletionPercent: getEmployeeProfileCompletionPercent(profile),
  });
};

export const upsertMySkill = async (req, res) => {
  const { skillId, level } = req.body;
  if (!skillId) return res.status(400).json({ message: "skillId is required" });

  let profile = await EmployeeProfile.findOne({ employee: req.user._id });
  if (!profile) profile = await EmployeeProfile.create({ employee: req.user._id });

  const existing = profile.skills.find((item) => String(item.skill) === String(skillId));
  if (existing) {
    if (level) existing.level = level;
  } else {
    profile.skills.push({ skill: skillId, level: level || "Beginner", status: "Learning", assignedAt: new Date() });
    profile.totalSkills = profile.skills.length;
  }

  await profile.save();
  await profile.populate("skills.skill", "name category");
  res.json({ skills: profile.skills, totalSkills: profile.totalSkills, profileCompletionPercent: getEmployeeProfileCompletionPercent(profile) });
};

export const removeMySkill = async (req, res) => {
  const profile = await EmployeeProfile.findOne({ employee: req.user._id });
  if (!profile) return res.status(404).json({ message: "Profile not found" });

  profile.skills = profile.skills.filter((item) => String(item.skill) !== String(req.params.skillId));
  profile.totalSkills = profile.skills.length;
  await profile.save();
  await profile.populate("skills.skill", "name category");
  res.json({ skills: profile.skills, totalSkills: profile.totalSkills, profileCompletionPercent: getEmployeeProfileCompletionPercent(profile) });
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
