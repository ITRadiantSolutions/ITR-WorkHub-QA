import User from "../models/User.js";
import JobPost from "../models/JobPost.js";
import JobRequest from "../models/JobRequest.js";
import Referral from "../models/Referral.js";

const IN_PIPELINE = ["submitted", "under_review", "shortlisted", "interview_scheduled"];

export const getDashboardStats = async (req, res) => {
  const role = req.user.roles.hrms;

  if (role === "hr") {
    const [totalEmployees, activeEmployees, openJobPosts, pendingJobRequests, totalReferrals, pendingReferrals] =
      await Promise.all([
        User.countDocuments({ "archived.account": { $ne: true } }),
        User.countDocuments({ "archived.account": { $ne: true }, employmentStatus: "active" }),
        JobPost.countDocuments({ status: "published" }),
        JobRequest.countDocuments({ status: { $in: ["submitted", "under_review", "clarification_required"] } }),
        Referral.countDocuments({}),
        Referral.countDocuments({ status: { $in: IN_PIPELINE } }),
      ]);
    return res.json({
      role, totalEmployees, activeEmployees, openJobPosts, pendingJobRequests, totalReferrals, pendingReferrals,
    });
  }

  const [openJobs, myReferrals] = await Promise.all([
    JobPost.countDocuments({ status: "published" }),
    Referral.countDocuments({ referredBy: req.user._id }),
  ]);

  if (role === "manager") {
    const [pendingRequests, teamSize] = await Promise.all([
      JobRequest.countDocuments({ requestedBy: req.user._id, status: "clarification_required" }),
      User.countDocuments({ managerId: req.user._id }),
    ]);
    return res.json({ role, openJobs, myReferrals, pendingActions: pendingRequests, teamSize });
  }

  res.json({ role, openJobs, myReferrals, pendingActions: 0 });
};
