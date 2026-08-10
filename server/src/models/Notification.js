import mongoose from "mongoose";

// Merges the old Notification + NotificationHistory collections: `archivedAt`
// replaces moving a doc into a second "history" collection after 5 days.
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 500 },
    type: {
      type: String,
      enum: [
        "projectCreated", "projectUpdated", "projectDeleted", "projectAssigned",
        "sprintCreated", "sprintUpdated", "sprintDeleted",
        "storyCreated", "storyUpdated", "storyDeleted",
        "taskCreated", "taskUpdated", "taskDeleted", "taskAssigned", "taskStatusChanged",
        "taskDeadlineUpdated", "taskCommentAdded",
        "teamMemberAdded", "teamMemberRemoved",
        "bugCreated", "bugUpdated", "bugDeleted", "bugStatusChanged",
        "deadlineChanged", "approvalUpdated", "userRoleChanged", "userApproved", "adminAlert",
        // HRMS
        "jobRequestSubmitted", "jobRequestApproved", "jobRequestRejected",
        "jobRequestClarificationRequested", "jobRequestClarificationResponded",
        "referralSubmitted", "referralStatusChanged", "employeeRoleChanged", "projectRoleAssigned",
        // LMS
        "lmsAssessmentFailed",
      ],
      required: true,
    },
    roleTargets: [{ type: String, enum: ["ADMIN", "PM", "DEVELOPER", "QA", "BUSINESS_USER"], required: true }],

    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    sprintId: { type: mongoose.Schema.Types.ObjectId, ref: "Sprint" },
    bugId: { type: mongoose.Schema.Types.ObjectId, ref: "Bug" },

    activityType: {
      type: String,
      enum: ["create", "update", "delete", "status_change", "assign", "remove", "comment", "deadline"],
      required: true,
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    isRead: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, archivedAt: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
