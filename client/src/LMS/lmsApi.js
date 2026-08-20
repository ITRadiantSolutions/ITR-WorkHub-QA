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
  startQuiz: (courseId, assessmentId) => API.get(`/lms/progress/courses/${courseId}/quiz/${assessmentId}/start`),
  startAssignment: (courseId, assessmentId) => API.get(`/lms/progress/courses/${courseId}/assignment/${assessmentId}/start`),
  submitQuiz: (courseId, assessmentId, answers) => API.post(`/lms/progress/courses/${courseId}/quiz`, { assessmentId, answers }),
  submitAssignment: (courseId, assessmentId, answers) => API.post(`/lms/progress/courses/${courseId}/assignment`, { assessmentId, answers }),
};

export const assignmentsApi = {
  employees: (eligibleOnly) => API.get("/lms/assignments/employees", { params: eligibleOnly ? { eligibleOnly: "true" } : {} }),
  assign: (courseId, employeeIds, minPassingPercentage) => API.post("/lms/assignments", { courseId, employeeIds, minPassingPercentage }),
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
  update: (data) => API.put("/lms/profile/me", data),
  uploadResume: (formData) => API.post("/lms/profile/me/resume", formData),
  upsertSkill: (data) => API.put("/lms/profile/me/skills", data),
  removeSkill: (skillId) => API.delete(`/lms/profile/me/skills/${skillId}`),
};

export const skillGroupsApi = {
  all: () => API.get("/lms/skill-groups"),
  byId: (id) => API.get(`/lms/skill-groups/${id}`),
  create: (data) => API.post("/lms/skill-groups", data),
  update: (id, data) => API.put(`/lms/skill-groups/${id}`, data),
  remove: (id) => API.delete(`/lms/skill-groups/${id}`),
  addMembers: (id, employeeIds) => API.post(`/lms/skill-groups/${id}/members`, { employeeIds }),
  removeMember: (id, employeeId) => API.delete(`/lms/skill-groups/${id}/members/${employeeId}`),
};

export const employeeSkillsApi = {
  get: (employeeId) => API.get(`/lms/profile/admin/${employeeId}`),
  upsert: (employeeId, data) => API.put(`/lms/profile/admin/${employeeId}/skills`, data),
  remove: (employeeId, skillId) => API.delete(`/lms/profile/admin/${employeeId}/skills/${skillId}`),
};

export const skillTestsApi = {
  allAdmin: () => API.get("/lms/skill-tests/admin"),
  byIdAdmin: (testId) => API.get(`/lms/skill-tests/admin/${testId}`),
  create: (data) => API.post("/lms/skill-tests/admin", data),
  update: (testId, data) => API.put(`/lms/skill-tests/admin/${testId}`, data),
  remove: (testId) => API.delete(`/lms/skill-tests/admin/${testId}`),
  assignGroups: (testId, skillGroupIds) => API.post(`/lms/skill-tests/admin/${testId}/assign`, { skillGroupIds }),
  unassignGroup: (testId, groupId) => API.delete(`/lms/skill-tests/admin/${testId}/assign/${groupId}`),
  available: () => API.get("/lms/skill-tests/available"),
  start: (testId) => API.post(`/lms/skill-tests/${testId}/start`),
  submit: (testId, answers) => API.post(`/lms/skill-tests/${testId}/submit`, { answers }),
  progress: (testId) => API.get(`/lms/skill-tests/${testId}/progress`),
};
