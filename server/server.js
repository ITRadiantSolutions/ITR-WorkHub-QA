import "dotenv/config";
import { createServer } from "node:http";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { initSocket } from "./src/realtime/socket.js";
import { startTimesheetReminderJobs } from "./src/jobs/timesheetReminders.js";
import { startPmsCronJobs } from "./src/jobs/pmsCycleJobs.js";
import { startNotificationCleanupJob } from "./src/jobs/notificationCleanup.js";

const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
initSocket(httpServer);

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => console.log(`itr-one-server listening on port ${PORT}`));
    // Timesheet reminder emails ran unconditionally in the reference app —
    // default them on here too; set ENABLE_REMINDER_JOBS=false to opt out
    // (e.g. in a dev/staging env you don't want emailing real users).
    if (process.env.ENABLE_REMINDER_JOBS !== "false") {
      startTimesheetReminderJobs();
    }
    if (process.env.ENABLE_REMINDER_JOBS === "true") {
      startPmsCronJobs();
    }
    startNotificationCleanupJob();
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB:", error.message);
    process.exit(1);
  });
