import EmployeeProfile from "../models/EmployeeProfile.js";
import { createReadUrl } from "../config/blobStorage.js";

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
