import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { apiResponseCache } from "./middleware/apiResponseCache.js";
import authRoutes from "./routes/auth.routes.js";
import approvalRoutes from "./routes/approval.routes.js";
import userRoutes from "./routes/user.routes.js";
import projectRoutes from "./routes/project.routes.js";
import timesheetRoutes from "./routes/timesheet.routes.js";
import companyHolidayRoutes from "./routes/companyHoliday.routes.js";
import entriesRoutes from "./routes/entries.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import timesheetFaqRoutes from "./routes/timesheetFaq.routes.js";
import pmsCycleRoutes from "./routes/pms/cycle.routes.js";
import pmsKraRoutes from "./routes/pms/kra.routes.js";
import pmsSubmissionRoutes from "./routes/pms/submission.routes.js";
import pmsPipRoutes from "./routes/pms/pip.routes.js";
import pmsUsersGroupRoutes from "./routes/pms/usersGroup.routes.js";
import pmsReportRoutes from "./routes/pms/report.routes.js";
import taskRoutes from "./routes/task.routes.js";
import sprintRoutes from "./routes/sprint.routes.js";
import storyRoutes from "./routes/story.routes.js";
import bugRoutes from "./routes/bug.routes.js";
import clientGroupRoutes from "./routes/clientGroup.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import userIssueRoutes from "./routes/userIssue.routes.js";
import activityLogRoutes from "./routes/activityLog.routes.js";
import adminLogsRoutes from "./routes/adminLogs.routes.js";
import legacyCycleRoutes from "./routes/legacyCycle.routes.js";
import legacyKraLibraryRoutes from "./routes/legacyKraLibrary.routes.js";
import legacyPmsMiscRoutes from "./routes/legacyPmsMisc.routes.js";
import legacyReportsRoutes from "./routes/legacyReports.routes.js";
import legacyUsersGroupRoutes from "./routes/legacyUsersGroup.routes.js";
import legacyKraMasterTemplateRoutes from "./routes/legacyKraMasterTemplate.routes.js";

// Express app only — no listen(), no DB connect, no cron jobs. Kept separate
// from server.js so tests (supertest) can import and exercise it directly
// without booting the whole process.
const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
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
app.use("/api/cycles", legacyCycleRoutes);
app.use("/api/kra-library", legacyKraLibraryRoutes);
app.use("/api", legacyPmsMiscRoutes);
app.use("/api/reports", legacyReportsRoutes);
app.use("/api/usersgroup", legacyUsersGroupRoutes);
app.use("/api", legacyKraMasterTemplateRoutes);

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
