import { API } from "./api.js";
import { fileToBlobPayload } from "../utils/fileToBlobPayload.js";

  // Project-specific API calls
export const projectAPI = {
  // Get sprints for a specific project (for Timeline tab)
  getProjectSprints: async (projectId) => {
    const response = await API.get(`/sprints?projectId=${projectId}`);
    return response.data;
  },

  // Search projects with filters (name, team lead, status, priority)
  searchProjects: async (params = {}) => {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
      ),
    );
    const response = await API.get(`/projects/search?${query.toString()}`);
    return response.data;
  },


  // Get tasks for a specific project (for ProjectDetail Tasks tab)
  getProjectTasks: async (projectId, params = {}) => {
    const query = new URLSearchParams({
      projectId,
      ...Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined),
      ),
    });
    const response = await API.get(`/tasks?${query.toString()}`);
    return response.data;
  },

  // Get employees for a project (for task assignment)
  getProjectEmployees: async (projectId) => {
    const response = await API.get(`/projects/${projectId}/employees`);
    return response.data;
  },

  // Update project details
  updateProject: async (projectId, data) => {
    const response = await API.put(`/projects/${projectId}`, data);
    return response.data;
  },

  // Clone project
  cloneProject: async (projectId, data) => {
    const response = await API.post(`/projects/${projectId}/clone`, data);
    return response.data;
  },

  // Update team members
  updateTeamMember: async (projectId, { action, userId }) => {
    const response = await API.patch(`/projects/${projectId}/team-members`, {
      action,
      userId,
    });
    return response.data;
  },

  // Upload project attachments (ADMIN/PM)
  uploadProjectAttachments: async (projectId, files) => {
    const results = [];
    for (const file of files || []) {
      const payload = await fileToBlobPayload(file);
      const response = await API.post(`/projects/${projectId}/attachments`, {
        files: [payload],
      });
      results.push(response.data);
    }
    return results;
  },
};




