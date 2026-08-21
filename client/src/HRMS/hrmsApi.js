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
  setManageAccessGrant: (id, modules) => API.patch(`/users/${id}/manage-access-grant`, { modules }),
  setModuleAccess: (id, modules) => API.patch(`/users/${id}/module-access`, { modules }),
  create: (data) => API.post("/users", data),
  setSuperAdmin: (id, isSuperAdmin) => API.patch(`/users/${id}/super-admin`, { isSuperAdmin }),
  accessAuditLogs: (params) => API.get("/users/access-audit-logs", { params }),
};

export const orgChartApi = {
  list: () => API.get("/hrms/org-chart"),
};

export const holidaysApi = {
  list: (year) => API.get("/hrms/holidays", { params: { year } }),
  add: (data) => API.post("/hrms/holidays", data),
  remove: (date) => API.delete(`/hrms/holidays/${date}`),
};

export const attendanceApi = {
  mine: (params) => API.get("/hrms/attendance/mine", { params }),
  summary: (params) => API.get("/hrms/attendance/summary", { params }),
  list: (params) => API.get("/hrms/attendance", { params }),
  punchesFor: (employeeId, params) => API.get(`/hrms/attendance/${employeeId}/punches`, { params }),
  manualPunch: (data) => API.post("/hrms/attendance/manual", data),
  regularize: (id, data) => API.patch(`/hrms/attendance/${id}/regularize`, data),
  requestRegularization: (data) => API.post("/hrms/attendance/requests", data),
  myRequests: () => API.get("/hrms/attendance/requests/mine"),
  teamRequests: () => API.get("/hrms/attendance/requests/team"),
  allRequests: (params) => API.get("/hrms/attendance/requests", { params }),
  reviewRequest: (id, action, comment) => API.patch(`/hrms/attendance/requests/${id}/review`, { action, comment }),
};

export const departmentsApi = {
  list: (params) => API.get("/hrms/departments", { params }),
  create: (data) => API.post("/hrms/departments", data),
  update: (id, data) => API.put(`/hrms/departments/${id}`, data),
  setStatus: (id, isActive) => API.patch(`/hrms/departments/${id}/status`, { isActive }),
  importFromUsers: () => API.post("/hrms/departments/import-from-users"),
};

export const designationsApi = {
  list: (params) => API.get("/hrms/designations", { params }),
  create: (data) => API.post("/hrms/designations", data),
  update: (id, data) => API.put(`/hrms/designations/${id}`, data),
  setStatus: (id, isActive) => API.patch(`/hrms/designations/${id}/status`, { isActive }),
  importFromUsers: () => API.post("/hrms/designations/import-from-users"),
};

export const gradesApi = {
  list: (params) => API.get("/hrms/grades", { params }),
  create: (data) => API.post("/hrms/grades", data),
  update: (id, data) => API.put(`/hrms/grades/${id}`, data),
  setStatus: (id, isActive) => API.patch(`/hrms/grades/${id}/status`, { isActive }),
};

export const locationsApi = {
  list: (params) => API.get("/hrms/locations", { params }),
  create: (data) => API.post("/hrms/locations", data),
  update: (id, data) => API.put(`/hrms/locations/${id}`, data),
  setStatus: (id, isActive) => API.patch(`/hrms/locations/${id}/status`, { isActive }),
};

export const leaveTypesApi = {
  list: (params) => API.get("/hrms/leave-types", { params }),
  create: (data) => API.post("/hrms/leave-types", data),
  update: (id, data) => API.put(`/hrms/leave-types/${id}`, data),
  setStatus: (id, isActive) => API.patch(`/hrms/leave-types/${id}/status`, { isActive }),
};

export const leaveRequestsApi = {
  create: (formData) => API.post("/hrms/leave-requests", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  createForEmployee: (formData) => API.post("/hrms/leave-requests/for-employee", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  documentUrl: (id) => API.get(`/hrms/leave-requests/${id}/document-url`),
  grant: (data) => API.post("/hrms/leave-requests/grant", data),
  mine: (params) => API.get("/hrms/leave-requests/mine", { params }),
  team: (params) => API.get("/hrms/leave-requests/team", { params }),
  all: (params) => API.get("/hrms/leave-requests", { params }),
  balance: () => API.get("/hrms/leave-requests/my-balance"),
  balanceFor: (employeeId) => API.get(`/hrms/leave-requests/balance/${employeeId}`),
  calendar: (month, year) => API.get("/hrms/leave-requests/calendar", { params: { month, year } }),
  ledger: (leaveTypeId, params) => API.get(`/hrms/leave-requests/ledger/${leaveTypeId}`, { params }),
  review: (id, action, comment) => API.patch(`/hrms/leave-requests/${id}/review`, { action, comment }),
  cancel: (id) => API.patch(`/hrms/leave-requests/${id}/cancel`),
};

export const hrRequestsApi = {
  create: (data) => API.post("/hrms/hr-requests", data),
  mine: (params) => API.get("/hrms/hr-requests/mine", { params }),
  all: (params) => API.get("/hrms/hr-requests", { params }),
  assign: (id, assignedTo) => API.patch(`/hrms/hr-requests/${id}/assign`, { assignedTo }),
  resolve: (id, resolutionNote) => API.patch(`/hrms/hr-requests/${id}/resolve`, { resolutionNote }),
};

export const salaryStructuresApi = {
  get: (employeeId) => API.get(`/hrms/salary-structures/${employeeId}`),
  upsert: (data) => API.put("/hrms/salary-structures", data),
};

export const payslipsApi = {
  generate: (data) => API.post("/hrms/payslips", data),
  generateBulk: (data) => API.post("/hrms/payslips/generate-bulk", data),
  mine: () => API.get("/hrms/payslips/mine"),
  all: (params) => API.get("/hrms/payslips", { params }),
  markPaid: (id) => API.patch(`/hrms/payslips/${id}/mark-paid`),
  pdf: (id) => API.get(`/hrms/payslips/${id}/pdf`, { responseType: "blob" }),
};

export const expensesApi = {
  create: (formData) => API.post("/hrms/expenses", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  mine: (params) => API.get("/hrms/expenses/mine", { params }),
  team: (params) => API.get("/hrms/expenses/team", { params }),
  all: (params) => API.get("/hrms/expenses", { params }),
  review: (id, action, comment) => API.patch(`/hrms/expenses/${id}/review`, { action, comment }),
  reimburse: (id) => API.patch(`/hrms/expenses/${id}/reimburse`),
  billUrl: (id) => API.get(`/hrms/expenses/${id}/bill-url`),
};

export const assetsApi = {
  list: (params) => API.get("/hrms/assets", { params }),
  create: (data) => API.post("/hrms/assets", data),
  update: (id, data) => API.put(`/hrms/assets/${id}`, data),
  setStatus: (id, status) => API.patch(`/hrms/assets/${id}/status`, { status }),
  myAssignments: () => API.get("/hrms/assets/assignments/mine"),
  assignments: (params) => API.get("/hrms/assets/assignments", { params }),
  assign: (assetId, employeeId) => API.post("/hrms/assets/assignments", { assetId, employeeId }),
  return: (assignmentId, returnCondition, returnNotes) =>
    API.patch(`/hrms/assets/assignments/${assignmentId}/return`, { returnCondition, returnNotes }),
};

export const onboardingApi = {
  start: (employeeId) => API.post("/hrms/onboarding", { employeeId }),
  all: (params) => API.get("/hrms/onboarding", { params }),
  mine: () => API.get("/hrms/onboarding/mine"),
  setItem: (id, itemId, done) => API.patch(`/hrms/onboarding/${id}/items/${itemId}`, { done }),
};

export const offboardingApi = {
  initiate: (data) => API.post("/hrms/offboarding", data),
  all: (params) => API.get("/hrms/offboarding", { params }),
  mine: () => API.get("/hrms/offboarding/mine"),
  recordExitInterview: (id, notes) => API.patch(`/hrms/offboarding/${id}/exit-interview`, { notes }),
  processFinalSettlement: (id, notes) => API.patch(`/hrms/offboarding/${id}/final-settlement`, { notes }),
};

export const announcementsApi = {
  list: (params) => API.get("/hrms/announcements", { params }),
  create: (formData) => API.post("/hrms/announcements", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  update: (id, formData) => API.put(`/hrms/announcements/${id}`, formData, { headers: { "Content-Type": "multipart/form-data" } }),
  remove: (id) => API.delete(`/hrms/announcements/${id}`),
  acknowledge: (id) => API.post(`/hrms/announcements/${id}/acknowledge`),
  attachmentUrl: (id) => API.get(`/hrms/announcements/${id}/attachment-url`),
};

export const documentsApi = {
  upload: (formData) => API.post("/hrms/documents", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  forEmployee: (employeeId) => API.get(`/hrms/documents/employee/${employeeId}`),
  url: (id) => API.get(`/hrms/documents/${id}/url`),
  remove: (id) => API.delete(`/hrms/documents/${id}`),
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
