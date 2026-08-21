import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { apiResponseCache } from "./middleware/apiResponseCache.js";
// Shared/cross-module infrastructure — not owned by any single product.
import authRoutes from "./routes/auth.routes.js";
import approvalRoutes from "./routes/approval.routes.js";
import userRoutes from "./routes/user.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import userIssueRoutes from "./routes/userIssue.routes.js";
import activityLogRoutes from "./routes/activityLog.routes.js";
import adminLogsRoutes from "./routes/adminLogs.routes.js";

// FlowTrack (project/task/sprint/story/bug tracker)
import projectRoutes from "./routes/flowtrack/project.routes.js";
import taskRoutes from "./routes/flowtrack/task.routes.js";
import sprintRoutes from "./routes/flowtrack/sprint.routes.js";
import storyRoutes from "./routes/flowtrack/story.routes.js";
import bugRoutes from "./routes/flowtrack/bug.routes.js";
import clientGroupRoutes from "./routes/flowtrack/clientGroup.routes.js";

// Timeflow (Timesheet)
import timesheetRoutes from "./routes/timeflow/timesheet.routes.js";
import companyHolidayRoutes from "./routes/timeflow/companyHoliday.routes.js";
import entriesRoutes from "./routes/timeflow/entries.routes.js";
import hrRoutes from "./routes/timeflow/hr.routes.js";
import timesheetFaqRoutes from "./routes/timeflow/timesheetFaq.routes.js";

// PMS (performance management)
import pmsCycleRoutes from "./routes/pms/cycle.routes.js";
import pmsKraRoutes from "./routes/pms/kra.routes.js";
import pmsSubmissionRoutes from "./routes/pms/submission.routes.js";
import pmsPipRoutes from "./routes/pms/pip.routes.js";
import pmsUsersGroupRoutes from "./routes/pms/usersGroup.routes.js";
import pmsReportRoutes from "./routes/pms/report.routes.js";

// VMS (Visitor Management System)
import vmsVisitorRoutes from "./routes/vms/visitor.routes.js";
import vmsAdminRoutes from "./routes/vms/admin.routes.js";

// LMS (Learning Management System)
import lmsCourseRoutes from "./routes/lms/course.routes.js";
import lmsProgressRoutes from "./routes/lms/progress.routes.js";
import lmsAssignmentRoutes from "./routes/lms/assignment.routes.js";
import lmsBadgeRoutes from "./routes/lms/badge.routes.js";
import lmsSkillRoutes from "./routes/lms/skill.routes.js";
import lmsReviewRoutes from "./routes/lms/review.routes.js";
import lmsReportsRoutes from "./routes/lms/reports.routes.js";
import lmsProfileRoutes from "./routes/lms/profile.routes.js";
import lmsSkillGroupRoutes from "./routes/lms/skillGroup.routes.js";
import lmsSkillTestRoutes from "./routes/lms/skillTest.routes.js";

// HRMS (Human Resource Management System)
import hrmsEmployeeRoutes from "./routes/hrms/employee.routes.js";
import hrmsAttendanceRoutes from "./routes/hrms/attendance.routes.js";
import hrmsProjectRoleRoutes from "./routes/hrms/projectRole.routes.js";
import hrmsJobRequestRoutes from "./routes/hrms/jobRequest.routes.js";
import hrmsJobPostRoutes from "./routes/hrms/jobPost.routes.js";
import hrmsReferralRoutes from "./routes/hrms/referral.routes.js";
import hrmsDashboardRoutes from "./routes/hrms/dashboard.routes.js";
import hrmsDepartmentRoutes from "./routes/hrms/department.routes.js";
import hrmsDesignationRoutes from "./routes/hrms/designation.routes.js";
import hrmsGradeRoutes from "./routes/hrms/grade.routes.js";
import hrmsLocationRoutes from "./routes/hrms/location.routes.js";
import hrmsLeaveTypeRoutes from "./routes/hrms/leaveType.routes.js";
import hrmsLeaveRequestRoutes from "./routes/hrms/leaveRequest.routes.js";
import hrmsHrRequestRoutes from "./routes/hrms/hrRequest.routes.js";
import hrmsSalaryStructureRoutes from "./routes/hrms/salaryStructure.routes.js";
import hrmsPayslipRoutes from "./routes/hrms/payslip.routes.js";
import hrmsExpenseRoutes from "./routes/hrms/expense.routes.js";
import hrmsAssetRoutes from "./routes/hrms/asset.routes.js";
import hrmsOnboardingRoutes from "./routes/hrms/onboarding.routes.js";
import hrmsOffboardingRoutes from "./routes/hrms/offboarding.routes.js";
import hrmsAnnouncementRoutes from "./routes/hrms/announcement.routes.js";
import hrmsDocumentRoutes from "./routes/hrms/document.routes.js";
import hrmsOrgChartRoutes from "./routes/hrms/orgChart.routes.js";
import hrmsHolidayRoutes from "./routes/hrms/holiday.routes.js";

// Express app only — no listen(), no DB connect, no cron jobs. Kept separate
// from server.js so tests (supertest) can import and exercise it directly
// without booting the whole process.
const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
// Default 100kb is too small for the VMS kiosk's base64 photoDataUrl
// (a full-res webcam capture easily exceeds it); everywhere else that
// uploads binary data goes through multer instead, so this only affects VMS.
app.use(express.json({ limit: "5mb" }));
app.use(apiResponseCache);

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/auth", approvalRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/timesheets", timesheetRoutes);
app.use("/api/company-holidays", companyHolidayRoutes);
app.use("/api/entries", entriesRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/timesheet-faqs", timesheetFaqRoutes);
app.use("/api/pms/cycles", pmsCycleRoutes);
app.use("/api/pms/kra", pmsKraRoutes);
app.use("/api/pms/submissions", pmsSubmissionRoutes);
app.use("/api/pms/pips", pmsPipRoutes);
app.use("/api/pms/users-groups", pmsUsersGroupRoutes);
app.use("/api/pms/reports", pmsReportRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/bugs", bugRoutes);
app.use("/api/client-groups", clientGroupRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/user-issues", userIssueRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/admin/logs", adminLogsRoutes);
app.use("/api/vms/visitors", vmsVisitorRoutes);
app.use("/api/vms/admin", vmsAdminRoutes);
app.use("/api/lms/courses", lmsCourseRoutes);
app.use("/api/lms/progress", lmsProgressRoutes);
app.use("/api/lms/assignments", lmsAssignmentRoutes);
app.use("/api/lms/badges", lmsBadgeRoutes);
app.use("/api/lms/skills", lmsSkillRoutes);
app.use("/api/lms/reviews", lmsReviewRoutes);
app.use("/api/lms/reports", lmsReportsRoutes);
app.use("/api/lms/profile", lmsProfileRoutes);
app.use("/api/lms/skill-groups", lmsSkillGroupRoutes);
app.use("/api/lms/skill-tests", lmsSkillTestRoutes);
app.use("/api/hrms/employees", hrmsEmployeeRoutes);
app.use("/api/hrms/attendance", hrmsAttendanceRoutes);
app.use("/api/hrms/project-roles", hrmsProjectRoleRoutes);
app.use("/api/hrms/job-requests", hrmsJobRequestRoutes);
app.use("/api/hrms/job-posts", hrmsJobPostRoutes);
app.use("/api/hrms/referrals", hrmsReferralRoutes);
app.use("/api/hrms/dashboard", hrmsDashboardRoutes);
app.use("/api/hrms/departments", hrmsDepartmentRoutes);
app.use("/api/hrms/designations", hrmsDesignationRoutes);
app.use("/api/hrms/grades", hrmsGradeRoutes);
app.use("/api/hrms/locations", hrmsLocationRoutes);
app.use("/api/hrms/leave-types", hrmsLeaveTypeRoutes);
app.use("/api/hrms/leave-requests", hrmsLeaveRequestRoutes);
app.use("/api/hrms/hr-requests", hrmsHrRequestRoutes);
app.use("/api/hrms/salary-structures", hrmsSalaryStructureRoutes);
app.use("/api/hrms/payslips", hrmsPayslipRoutes);
app.use("/api/hrms/expenses", hrmsExpenseRoutes);
app.use("/api/hrms/assets", hrmsAssetRoutes);
app.use("/api/hrms/onboarding", hrmsOnboardingRoutes);
app.use("/api/hrms/offboarding", hrmsOffboardingRoutes);
app.use("/api/hrms/announcements", hrmsAnnouncementRoutes);
app.use("/api/hrms/documents", hrmsDocumentRoutes);
app.use("/api/hrms/org-chart", hrmsOrgChartRoutes);
app.use("/api/hrms/holidays", hrmsHolidayRoutes);

// Serve the built React client, when present — the deploy workflow copies
// client/dist here so one App Service can host both API and frontend on
// the free tier. In local dev this directory doesn't exist (the client
// runs on its own Vite dev server instead), so this is a no-op then.
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
if (fs.existsSync(path.join(publicDir, "index.html"))) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

// Central JSON error handler — keeps thrown/rejected errors from any async
// route handler out of Express's default HTML error page.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

export default app;
