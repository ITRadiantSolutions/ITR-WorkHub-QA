const ACTIVITY_LABELS = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  status_change: "Status changed",
  assign: "Assigned",
  remove: "Removed",
  comment: "Commented",
  deadline: "Deadline changed",
};

const ACTIVITY_CLASSES = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  status_change: "bg-purple-100 text-purple-700",
  assign: "bg-indigo-100 text-indigo-700",
  remove: "bg-orange-100 text-orange-700",
  comment: "bg-teal-100 text-teal-700",
  deadline: "bg-yellow-100 text-yellow-700",
};

export function getActorName(notification) {
  return (
    notification?.performedBy?.name ||
    notification?.metadata?.performedByName ||
    notification?.metadata?.actorName ||
    notification?.metadata?.updater ||
    notification?.metadata?.updatedBy ||
    "System"
  );
}

function cleanActorText(text, actorName) {
  if (!text) return "";

  return String(text)
    .replace(/\bundefined\b/g, actorName)
    .replace(/^\s*Someone\b/i, actorName);
}

export function getActivityLabel(activityType) {
  return ACTIVITY_LABELS[activityType] || activityType || "Activity";
}

export function getActivityClass(activityType) {
  return ACTIVITY_CLASSES[activityType] || "bg-slate-100 text-slate-700";
}

export function getEntityLabel(notification) {
  const type = notification?.type || "";

  if (type.startsWith("project") || type.startsWith("team")) return "Project";
  if (type.startsWith("task")) return "Task";
  if (type.startsWith("sprint")) return "Sprint";
  if (type.startsWith("bug")) return "Bug";
  if (type.startsWith("user") || type.startsWith("approval")) return "User";

  return "System";
}

export function getProjectName(notification) {
  return notification?.projectId?.name || notification?.metadata?.projectName || "";
}

export function getEntityName(notification) {
  return (
    notification?.taskId?.title ||
    notification?.projectId?.name ||
    notification?.sprintId?.name ||
    notification?.bugId?.title ||
    notification?.metadata?.taskTitle ||
    notification?.metadata?.projectName ||
    notification?.metadata?.sprintName ||
    notification?.metadata?.bugTitle ||
    ""
  );
}

export function getNotificationSummary(notification) {
  const actor = getActorName(notification);
  const action = getActivityLabel(notification?.activityType).toLowerCase();
  const entity = getEntityLabel(notification).toLowerCase();
  const entityName = getEntityName(notification);
  const projectName = getProjectName(notification);

  const subject = entityName ? `${entity} "${entityName}"` : entity;
  const context = projectName && projectName !== entityName ? ` in "${projectName}"` : "";

  return `${actor} ${action} ${subject}${context}`;
}

export function getCompactNotificationText(notification) {
  const actor = getActorName(notification);
  const entity = getEntityLabel(notification).toLowerCase();
  const entityName = getEntityName(notification);
  const subject = entityName ? `${entity} ${entityName}` : entity;
  const type = notification?.type || "";
  const status = notification?.metadata?.newStatus;

  if (type === "taskStatusChanged") {
    const actions = {
      TODO: "moved",
      IN_PROGRESS: "started",
      ON_HOLD: "put on hold",
      QA_TESTING: "sent to QA",
      DONE: "completed",
    };
    const action = actions[status] || "changed";
    return action === "moved"
      ? `${actor} moved ${subject} to todo`
      : `${actor} ${action} ${subject}`;
  }
  if (type === "taskUpdated") return `${actor} updated ${subject}`;
  if (type === "taskCreated") return `${actor} created ${subject}`;
  if (type === "taskAssigned") return `${actor} assigned ${subject}`;
  if (type === "taskDeleted") return `${actor} deleted ${subject}`;
  if (type === "taskDeadlineUpdated") return `${actor} changed deadline for ${subject}`;
  if (type === "taskCommentAdded") return `${actor} commented on ${subject}`;

  const action = getActivityLabel(notification?.activityType).toLowerCase();
  return `${actor} ${action} ${subject}`;
}
export function getNotificationMessage(notification) {
  return cleanActorText(notification?.message, getActorName(notification));
}

export function formatTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (Number.isNaN(date.getTime())) return "";
  if (diffMins < 1) return "Just now";
  if (diffMins === 1) return "1 min ago";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}
