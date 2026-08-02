import Notification from "../models/Notification.js";

const scopedToUser = (userId) => ({ userId });

export const getNotifications = async (req, res) => {
  const { page = 1, limit = 20, unreadOnly = "false", readOnly = "false" } = req.query;
  const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
  const limitNumber = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  const skip = (pageNumber - 1) * limitNumber;

  const filter = { ...scopedToUser(req.user._id), archivedAt: null };
  if (unreadOnly === "true") filter.isRead = false;
  else if (readOnly === "true") filter.isRead = true;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .populate("performedBy", "name email")
      .populate("taskId", "title status assignees projectId")
      .populate("projectId", "name status")
      .populate("sprintId", "name status")
      .populate("bugId", "title status")
      .sort({ createdAt: -1 })
      .limit(limitNumber)
      .skip(skip)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...scopedToUser(req.user._id), archivedAt: null, isRead: false }),
  ]);

  res.json({ success: true, data: notifications, unreadCount, pagination: { page: pageNumber, limit: limitNumber, total } });
};

export const markAsRead = async (req, res) => {
  const { notificationId, all = "false" } = req.body;
  const filter = scopedToUser(req.user._id);

  if (all === "true" || all === true) {
    await Notification.updateMany({ ...filter, isRead: false }, { isRead: true });
    return res.json({ success: true, message: "All notifications marked as read" });
  }

  if (!notificationId) return res.status(400).json({ error: "notificationId required" });

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, ...filter },
    { isRead: true },
    { new: true },
  );
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ success: true, message: "Notification marked as read", data: notification });
};

// "Clear" removes unread notifications outright (distinct from the background
// archive job, which only stamps archivedAt on old read/unread notifications).
export const clearAll = async (req, res) => {
  const result = await Notification.deleteMany({ ...scopedToUser(req.user._id), isRead: false });
  res.json({ success: true, message: `Cleared ${result.deletedCount} notifications` });
};

export const getUnreadCount = async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    ...scopedToUser(req.user._id),
    archivedAt: null,
    isRead: false,
  });
  res.json({ success: true, unreadCount });
};

// Was the old "move to NotificationHistory after 5 days" cleanup job — now
// just stamps archivedAt in place instead of migrating to a second collection.
export const archiveOldNotifications = async (olderThanDays = 5) => {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await Notification.updateMany(
    { createdAt: { $lt: cutoff }, archivedAt: null },
    { $set: { archivedAt: new Date() } },
  );
  return { archived: result.modifiedCount };
};
