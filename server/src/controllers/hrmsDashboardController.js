import User from "../models/User.js";
import JobPost from "../models/JobPost.js";
import JobRequest from "../models/JobRequest.js";
import Referral from "../models/Referral.js";
import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import Expense from "../models/Expense.js";
import HrRequest from "../models/HrRequest.js";
import AttendanceDay from "../models/AttendanceDay.js";
import AttendanceRegularization from "../models/AttendanceRegularization.js";
import Payslip from "../models/Payslip.js";
import SalaryStructure from "../models/SalaryStructure.js";
import CompanyHoliday from "../models/CompanyHoliday.js";
import AssetAssignment from "../models/AssetAssignment.js";
import EmployeeDocument from "../models/EmployeeDocument.js";

const IN_PIPELINE = ["submitted", "under_review", "shortlisted", "interview_scheduled"];
const PENDING_LEAVE_STATUSES = ["pending_manager", "pending_skip_level"];

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const todayAttendanceCounts = async (employeeFilter) => {
  const date = toISODate(new Date());
  const match = { date };
  if (employeeFilter) match.employee = employeeFilter;
  const rows = await AttendanceDay.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
};

// Employees whose birthday (month/day, ignoring year) falls within the next
// `days` days, including today — handles the December-into-January wrap.
const upcomingBirthdays = async (days = 7) => {
  const employees = await User.find({
    "archived.account": { $ne: true }, "archived.hrms": { $ne: true }, dateOfBirth: { $ne: null },
  }).select("name dateOfBirth");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inRange = [];
  for (const emp of employees) {
    const dob = new Date(emp.dateOfBirth);
    const nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
    const daysAway = Math.round((nextBirthday - today) / 86400000);
    if (daysAway >= 0 && daysAway <= days) inRange.push({ name: emp.name, date: nextBirthday, daysAway });
  }
  return inRange.sort((a, b) => a.daysAway - b.daysAway);
};

const upcomingHolidays = async (days = 30) => {
  const today = toISODate(new Date());
  const future = toISODate(new Date(Date.now() + days * 86400000));
  const withinWindow = await CompanyHoliday.find({ date: { $gte: today, $lte: future } }).select("date label isFloater").sort({ date: 1 });
  if (withinWindow.length > 0) return withinWindow;

  // Nothing in the next `days` — a stretch of the year with no holidays
  // shouldn't leave the card empty; fall back to whatever the single next
  // one is, however far out.
  const next = await CompanyHoliday.findOne({ date: { $gte: today } }).select("date label isFloater").sort({ date: 1 });
  return next ? [next] : [];
};

// Same window/wrap-around logic as upcomingBirthdays, keyed off joiningDate
// instead of dateOfBirth. `years` is the anniversary number being reached
// (skips anyone who joined within the last year — a 0th "anniversary" isn't
// one).
const upcomingWorkAnniversaries = async (days = 7) => {
  const employees = await User.find({
    "archived.account": { $ne: true }, "archived.hrms": { $ne: true }, joiningDate: { $ne: null },
  }).select("name joiningDate");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inRange = [];
  for (const emp of employees) {
    const joined = new Date(emp.joiningDate);
    const anniversary = new Date(today.getFullYear(), joined.getMonth(), joined.getDate());
    if (anniversary < today) anniversary.setFullYear(today.getFullYear() + 1);
    const daysAway = Math.round((anniversary - today) / 86400000);
    const years = anniversary.getFullYear() - joined.getFullYear();
    if (daysAway >= 0 && daysAway <= days && years > 0) inRange.push({ name: emp.name, date: anniversary, daysAway, years });
  }
  return inRange.sort((a, b) => a.daysAway - b.daysAway);
};

// Personal-only widgets for the employee dashboard — what's currently
// assigned to them and the documents on their own file, not org-wide data.
const myAssetsFeed = async (employeeId) => {
  const assignments = await AssetAssignment.find({ employee: employeeId, status: "active" })
    .populate("asset", "name assetTag category")
    .sort({ assignedAt: -1 });
  return assignments.map((a) => ({
    id: a._id,
    name: a.asset?.name || "Asset",
    assetTag: a.asset?.assetTag || "",
    category: a.asset?.category || "other",
  }));
};

const myDocumentsFeed = async (employeeId) =>
  EmployeeDocument.find({ employee: employeeId }).select("title category createdAt").sort({ createdAt: -1 });

const currentMonthPayrollStatus = async () => {
  const now = new Date();
  const [totalStructures, generated] = await Promise.all([
    SalaryStructure.countDocuments({}),
    Payslip.countDocuments({ month: now.getMonth() + 1, year: now.getFullYear() }),
  ]);
  return { totalStructures, generated };
};

export const getDashboardStats = async (req, res) => {
  const role = req.user.roles.hrms;

  if (role === "hr") {
    const [
      totalEmployees, activeEmployees, openJobPosts, pendingJobRequests, totalReferrals, pendingReferrals,
      pendingLeaveApprovals, pendingExpenseApprovals, openHrRequests, pendingRegularizations,
      attendanceToday, payrollStatus, birthdays, holidays, workAnniversaries,
    ] = await Promise.all([
      User.countDocuments({ "archived.account": { $ne: true } }),
      User.countDocuments({ "archived.account": { $ne: true }, employmentStatus: "active" }),
      JobPost.countDocuments({ status: "published" }),
      JobRequest.countDocuments({ status: { $in: ["submitted", "under_review", "clarification_required"] } }),
      Referral.countDocuments({}),
      Referral.countDocuments({ status: { $in: IN_PIPELINE } }),
      LeaveRequest.countDocuments({ status: { $in: PENDING_LEAVE_STATUSES } }),
      Expense.countDocuments({ status: "submitted" }),
      HrRequest.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      AttendanceRegularization.countDocuments({ status: "pending" }),
      todayAttendanceCounts(),
      currentMonthPayrollStatus(),
      upcomingBirthdays(),
      upcomingHolidays(),
      upcomingWorkAnniversaries(),
    ]);
    return res.json({
      role, totalEmployees, activeEmployees, openJobPosts, pendingJobRequests, totalReferrals, pendingReferrals,
      pendingLeaveApprovals, pendingExpenseApprovals, openHrRequests, pendingRegularizations,
      attendanceToday, payrollStatus, birthdays, holidays, workAnniversaries,
    });
  }

  const [openJobs, myReferrals] = await Promise.all([
    JobPost.countDocuments({ status: "published" }),
    Referral.countDocuments({ referredBy: req.user._id }),
  ]);

  if (role === "manager") {
    const directReports = await User.find({ managerId: req.user._id }).select("_id");
    const directReportIds = directReports.map((r) => r._id);
    const skipLevelReports = await User.find({ managerId: { $in: directReportIds } }).select("_id");
    const allReportIds = [...directReportIds, ...skipLevelReports.map((r) => r._id)];

    const [
      pendingRequests, teamSize, pendingLeaveApprovals, pendingExpenseApprovals, attendanceToday, birthdays, workAnniversaries,
    ] = await Promise.all([
      JobRequest.countDocuments({ requestedBy: req.user._id, status: "clarification_required" }),
      User.countDocuments({ managerId: req.user._id }),
      LeaveRequest.countDocuments({ employee: { $in: allReportIds }, status: { $in: PENDING_LEAVE_STATUSES } }),
      Expense.countDocuments({ employee: { $in: directReportIds }, status: "submitted" }),
      todayAttendanceCounts({ $in: directReportIds }),
      upcomingBirthdays(),
      upcomingWorkAnniversaries(),
    ]);
    return res.json({
      role, openJobs, myReferrals, pendingActions: pendingRequests, teamSize,
      pendingLeaveApprovals, pendingExpenseApprovals, attendanceToday, birthdays, workAnniversaries,
    });
  }

  const [
    myLeaveTypes, myPendingLeave, myPendingExpense, myPendingHrRequests, holidays, birthdays, workAnniversaries,
    myAssets, myDocuments,
  ] = await Promise.all([
    LeaveType.find({ isActive: true }).select("_id"),
    LeaveRequest.countDocuments({ employee: req.user._id, status: { $in: PENDING_LEAVE_STATUSES } }),
    Expense.countDocuments({ employee: req.user._id, status: "submitted" }),
    HrRequest.countDocuments({ requestedBy: req.user._id, status: { $in: ["open", "in_progress"] } }),
    upcomingHolidays(),
    upcomingBirthdays(),
    upcomingWorkAnniversaries(),
    myAssetsFeed(req.user._id),
    myDocumentsFeed(req.user._id),
  ]);
  res.json({
    role, openJobs, myReferrals, pendingActions: 0,
    myPendingRequests: myPendingLeave + myPendingExpense + myPendingHrRequests,
    leaveTypeCount: myLeaveTypes.length,
    holidays, birthdays, workAnniversaries, myAssets, myDocuments,
  });
};
