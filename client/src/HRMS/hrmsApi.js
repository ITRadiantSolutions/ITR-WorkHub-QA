import { API } from "../services/api.js";

// Thin wrappers around server/src/routes/hrms/*.routes.js — mirrors how
// client/src/LMS/lmsApi.js centralizes fetch calls for its module.

export const dashboardApi = {
  stats: () => API.get("/hrms/dashboard/stats"),
};

export const employeesApi = {
  list: (params) => API.get("/hrms/employees", { params }),
  byId: (id) => API.get(`/hrms/employees/${id}`),
  updateHrFields: (id, data) => API.patch(`/hrms/employees/${id}`, data),
  myReports: () => API.get("/users/my-reports"),
  sync: () => API.post("/users/sync"),
  setRole: (id, role, module = "hrms") => API.patch(`/users/${id}/role`, { module, role }),
  setArchived: (id, archived, module = "hrms") => API.patch(`/users/${id}/archive`, { module, archived }),
  setManager: (id, managerId) => API.patch(`/users/${id}/manager`, { managerId }),
};

export const projectRolesApi = {
  forUser: (userId) => API.get("/hrms/project-roles", { params: { userId } }),
  upsert: (userId, projectId, role) => API.put("/hrms/project-roles", { userId, projectId, role }),
  remove: (id) => API.delete(`/hrms/project-roles/${id}`),
};

export const jobRequestsApi = {
  list: (params) => API.get("/hrms/job-requests", { params }),
  byId: (id) => API.get(`/hrms/job-requests/${id}`),
  create: (data) => API.post("/hrms/job-requests", data),
  update: (id, data) => API.put(`/hrms/job-requests/${id}`, data),
  review: (id, action, rejectionReason) => API.post(`/hrms/job-requests/${id}/review`, { action, rejectionReason }),
  askClarification: (id, question) => API.post(`/hrms/job-requests/${id}/clarification`, { question }),
  respondClarification: (id, response) => API.post(`/hrms/job-requests/${id}/clarification/respond`, { response }),
  publish: (id, applicationDeadline) => API.post(`/hrms/job-requests/${id}/publish`, { applicationDeadline }),
};

export const jobPostsApi = {
  list: (params) => API.get("/hrms/job-posts", { params }),
  byId: (id) => API.get(`/hrms/job-posts/${id}`),
  create: (data) => API.post("/hrms/job-posts", data),
  update: (id, data) => API.put(`/hrms/job-posts/${id}`, data),
  publish: (id) => API.patch(`/hrms/job-posts/${id}/publish`),
  close: (id) => API.patch(`/hrms/job-posts/${id}/close`),
  archive: (id) => API.patch(`/hrms/job-posts/${id}/archive`),
};

export const referralsApi = {
  mine: () => API.get("/hrms/referrals/mine"),
  all: (params) => API.get("/hrms/referrals", { params }),
  create: (formData) => API.post("/hrms/referrals", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  updateStatus: (id, data) => API.patch(`/hrms/referrals/${id}/status`, data),
  resumeUrl: (id) => API.get(`/hrms/referrals/${id}/resume-url`),
};
