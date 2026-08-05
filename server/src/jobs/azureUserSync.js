import cron from "node-cron";
import { runAzureGroupSync } from "../controllers/userController.js";

export function startAzureUserSyncJob() {
  // Daily 10:00 IST — mirrors the manual "Sync" button on Assign Roles.
  cron.schedule(
    "0 10 * * *",
    async () => {
      const result = await runAzureGroupSync().catch((err) => {
        console.error("startAzureUserSyncJob: sync failed", err.response?.data || err.message);
        return null;
      });
      if (!result) return;
      console.log(`startAzureUserSyncJob: ${result.message}`);
    },
    { timezone: "Asia/Kolkata" },
  );
}
