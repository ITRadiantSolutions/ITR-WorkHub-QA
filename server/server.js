import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { connectDB } from "./src/config/db.js";
import { initSocket } from "./src/realtime/socket.js";
import authRoutes from "./src/routes/auth.routes.js";
import approvalRoutes from "./src/routes/approval.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import projectRoutes from "./src/routes/project.routes.js";
import timesheetRoutes from "./src/routes/timesheet.routes.js";
import entriesRoutes from "./src/routes/entries.routes.js";
import hrRoutes from "./src/routes/hr.routes.js";
import pmsCycleRoutes from "./src/routes/pms/cycle.routes.js";
import pmsKraRoutes from "./src/routes/pms/kra.routes.js";
import pmsSubmissionRoutes from "./src/routes/pms/submission.routes.js";
import pmsPipRoutes from "./src/routes/pms/pip.routes.js";
import pmsUsersGroupRoutes from "./src/routes/pms/usersGroup.routes.js";
import pmsReportRoutes from "./src/routes/pms/report.routes.js";
import taskRoutes from "./src/routes/task.routes.js";
import sprintRoutes from "./src/routes/sprint.routes.js";
import storyRoutes from "./src/routes/story.routes.js";
import bugRoutes from "./src/routes/bug.routes.js";
import clientGroupRoutes from "./src/routes/clientGroup.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import userIssueRoutes from "./src/routes/userIssue.routes.js";
import activityLogRoutes from "./src/routes/activityLog.routes.js";
import adminLogsRoutes from "./src/routes/adminLogs.routes.js";
import legacyCycleRoutes from "./src/routes/legacyCycle.routes.js";
import legacyKraLibraryRoutes from "./src/routes/legacyKraLibrary.routes.js";
import legacyPmsMiscRoutes from "./src/routes/legacyPmsMisc.routes.js";
import legacyReportsRoutes from "./src/routes/legacyReports.routes.js";
import legacyUsersGroupRoutes from "./src/routes/legacyUsersGroup.routes.js";
import legacyKraMasterTemplateRoutes from "./src/routes/legacyKraMasterTemplate.routes.js";
import { startTimesheetReminderJobs } from "./src/jobs/timesheetReminders.js";
import { startPmsCronJobs } from "./src/jobs/pmsCycleJobs.js";
import { startNotificationCleanupJob } from "./src/jobs/notificationCleanup.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/auth", approvalRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/timesheets", timesheetRoutes);
app.use("/api/entries", entriesRoutes);
app.use("/api/hr", hrRoutes);
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
app.use("/api/cycles", legacyCycleRoutes);
app.use("/api/kra-library", legacyKraLibraryRoutes);
app.use("/api", legacyPmsMiscRoutes);
app.use("/api/reports", legacyReportsRoutes);
app.use("/api/usersgroup", legacyUsersGroupRoutes);
app.use("/api", legacyKraMasterTemplateRoutes);

// Central JSON error handler — keeps thrown/rejected errors from any async
// route handler out of Express's default HTML error page.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
initSocket(httpServer);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => console.log(`itr-one-server listening on port ${PORT}`));
    if (process.env.ENABLE_REMINDER_JOBS === "true") {
      startTimesheetReminderJobs();
      startPmsCronJobs();
    }
    startNotificationCleanupJob();
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  });
