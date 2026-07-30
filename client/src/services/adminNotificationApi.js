import { API } from "./api.js";

export const adminNotificationAPI = {
  // GET /api/notifications/admin
  getAdminNotifications: ({
    page = 1,
    limit = 20,
    employeeId,
    performedById,
    projectId,
    unreadOnly = false,
    readOnly = false,
    q,
  } = {}) =>
    API.get("/notifications/admin", {
      params: {
        page,
        limit,
        employeeId,
        performedById,
        projectId,
        unreadOnly: unreadOnly ? "true" : "false",
        readOnly: readOnly ? "true" : "false",
        q,
      },
    }),

  // GET /api/notifications/admin/unread-count
  getAdminUnreadCount: ({
    employeeId,
    performedById,
    projectId,
  } = {}) =>
    API.get("/notifications/admin/unread-count", {
      params: {
        employeeId,
        performedById,
        projectId,
      },
    }),

  // GET /api/notifications/admin/tabs-counts
getAdminSidebarTabsCounts: ({
  employeeId,
 performedById,
  projectId,
  noCache = false,
} = {}) =>
  API.get(
    "/notifications/admin/tabs-counts",
    {
      params: {
        employeeId,
        performedById,
        projectId,
      },
      cache: !noCache,
      noCache,
    }
  ),

  // POST /api/notifications/admin/mark-tab-read
  markAdminTabRead: ({ tab, employeeId, performedById, projectId } = {}) =>
    API.post(
      "/notifications/admin/mark-tab-read",
      {
        tab,
        employeeId,
        performedById,
        projectId,
      },
      // Reading a notification changes no project/task data. Do not make
      // dashboards reload their lists for this request.
      { suppressNotify: true },
    ),
};



