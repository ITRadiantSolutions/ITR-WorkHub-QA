import { API } from "../services/api.js";

// Thin wrappers around server/src/routes/lms/*.routes.js — kept in one file
// so every LMS page imports from the same place, mirroring how the rest of
// the app centralizes fetch calls in services/api.js.

export const coursesApi = {
  published: () => API.get("/lms/courses/published"),
  allAdmin: () => API.get("/lms/courses/admin"),
  mine: () => API.get("/lms/courses/mine"),
  byId: (courseId) => API.get(`/lms/courses/${courseId}`),
  create: (formData) => API.post("/lms/courses", formData),
  update: (courseId, formData) => API.patch(`/lms/courses/${courseId}`, formData),
  remove: (courseId) => API.delete(`/lms/courses/${courseId}`),
  reviews: (courseId) => API.get(`/lms/courses/${courseId}/reviews`),
};

export const lecturesApi = {
  forCourse: (courseId) => API.get(`/lms/courses/${courseId}/lectures`),
  create: (courseId, formData) => API.post(`/lms/courses/${courseId}/lectures`, formData),
  update: (lectureId, formData) => API.patch(`/lms/courses/lectures/${lectureId}`, formData),
  remove: (lectureId) => API.delete(`/lms/courses/lectures/${lectureId}`),
};

export const assessmentsApi = {
  forCourse: (courseId) => API.get(`/lms/courses/${courseId}/assessments`),
  create: (courseId, data) => API.post(`/lms/courses/${courseId}/assessments`, data),
  update: (assessmentId, data) => API.put(`/lms/courses/assessments/${assessmentId}`, data),
  remove: (assessmentId) => API.delete(`/lms/courses/assessments/${assessmentId}`),
};

export const progressApi = {
  forCourse: (courseId) => API.get(`/lms/progress/courses/${courseId}`),
  forUserCourse: (userId, courseId) => API.get(`/lms/progress/users/${userId}/courses/${courseId}`),
  markMaterial: (courseId, lectureId, materialIndex, type) =>
    API.post(`/lms/progress/courses/${courseId}/materials/${lectureId}/${materialIndex}`, { type }),
  submitQuiz: (courseId, assessmentId, answers) => API.post(`/lms/progress/courses/${courseId}/quiz`, { assessmentId, answers }),
  submitAssignment: (courseId, assessmentId, answers) => API.post(`/lms/progress/courses/${courseId}/assignment`, { assessmentId, answers }),
};

export const assignmentsApi = {
  employees: (eligibleOnly) => API.get("/lms/assignments/employees", { params: eligibleOnly ? { eligibleOnly: "true" } : {} }),
  assign: (courseId, employeeIds) => API.post("/lms/assignments", { courseId, employeeIds }),
  info: (userId, courseId) => API.get("/lms/assignments/info", { params: { userId, courseId } }),
  forCourse: (courseId) => API.get(`/lms/assignments/courses/${courseId}`),
};

export const badgesApi = {
  all: () => API.get("/lms/badges"),
  allAdmin: () => API.get("/lms/badges/admin"),
  create: (formData) => API.post("/lms/badges/admin", formData),
  update: (badgeId, formData) => API.put(`/lms/badges/admin/${badgeId}`, formData),
  remove: (badgeId) => API.delete(`/lms/badges/admin/${badgeId}`),
};

export const skillsApi = {
  all: () => API.get("/lms/skills"),
  create: (data) => API.post("/lms/skills", data),
  update: (id, data) => API.put(`/lms/skills/${id}`, data),
  remove: (id) => API.delete(`/lms/skills/${id}`),
  toggleStatus: (id) => API.patch(`/lms/skills/${id}/status`),
  bulkImport: (formData) => API.post("/lms/skills/bulk-import", formData),
  categories: () => API.get("/lms/skills/categories"),
  createCategory: (name) => API.post("/lms/skills/categories", { name }),
  deleteCategory: (id) => API.delete(`/lms/skills/categories/${id}`),
};

export const reviewsApi = {
  add: (courseId, rating, comment) => API.post("/lms/reviews", { courseId, rating, comment }),
  all: () => API.get("/lms/reviews"),
};

export const reportsApi = {
  regenerate: () => API.post("/lms/reports/regenerate"),
  all: () => API.get("/lms/reports"),
};

export const profileApi = {
  me: () => API.get("/lms/profile/me"),
};
