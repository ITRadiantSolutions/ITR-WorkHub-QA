import { API } from "./api.js";

export const notificationAPI = {
  // Get paginated notifications
  getNotifications: ({
    page = 1,
    limit = 10,
    unreadOnly = false,
    readOnly = false,
  } = {}) =>
    API.get("/notifications", {
      params: {
        page,
        limit,
        unreadOnly: unreadOnly ? "true" : "false",
        readOnly: readOnly ? "true" : "false",
      },
    }),

  // Get unread count for badge
  getUnreadCount: () => API.get("/notifications/unread-count"),

  // Mark single notification or all as read
  markAsRead: ({ notificationId, all = false }) =>
    API.post("/notifications/read", {
      notificationId,
      all: all ? "true" : "false",
    }),

  // Clear all unread notifications
  clearNotifications: () => API.delete("/notifications/clear"),
};

export default notificationAPI;
