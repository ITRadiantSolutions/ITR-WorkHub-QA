import cron from "node-cron";
import { archiveOldNotifications } from "../controllers/notificationController.js";

export function startNotificationCleanupJob() {
  cron.schedule("0 * * * *", () => archiveOldNotifications(5).catch(console.error));
}
