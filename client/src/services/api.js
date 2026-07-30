import axios from "axios";
export { projectAPI } from "./projectApi.js";

export const API = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
});

export const DATA_MUTATED_EVENT = "flowtrack:data-mutated";

const GET_CACHE_TTL = 15000;
const getCache = new Map();
const inFlightGets = new Map();

const stableStringify = (value) => {
  if (!value || typeof value !== "object") return String(value ?? "");
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${key}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const cloneData = (data) => {
  if (data === undefined || data === null) return data;
  if (typeof structuredClone === "function") return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
};

const cloneResponse = (response) => ({
  ...response,
  data: cloneData(response.data),
});

const getCacheKey = (url, config = {}) => {
  const token = localStorage.getItem("token") || "";
  return [
    token,
    config.baseURL || API.defaults.baseURL || "",
    url,
    stableStringify(config.params),
  ].join("|");
};

export const clearApiGetCache = () => {
  getCache.clear();
  inFlightGets.clear();
};

const notifyDataMutated = ({ method, url, source }) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(DATA_MUTATED_EVENT, {
      detail: { method, url, source, timestamp: Date.now() },
    }),
  );
};

const originalGet = API.get.bind(API);
API.get = (url, config = {}) => {
  const shouldCache = config.cache !== false && config.noCache !== true;

  if (!shouldCache) {
    return originalGet(url, config);
  }

  const key = getCacheKey(url, config);
  const cached = getCache.get(key);

  if (cached && Date.now() - cached.timestamp < GET_CACHE_TTL) {
    return Promise.resolve(cloneResponse(cached.response));
  }

  const inFlight = inFlightGets.get(key);
  if (inFlight) return inFlight.then(cloneResponse);

  const request = originalGet(url, config)
    .then((response) => {
      getCache.set(key, {
        timestamp: Date.now(),
        response: cloneResponse(response),
      });
      return response;
    })
    .finally(() => {
      inFlightGets.delete(key);
    });

  inFlightGets.set(key, request);
  return request.then(cloneResponse);
};

["post", "put", "patch", "delete"].forEach((method) => {
  const originalMethod = API[method].bind(API);
  API[method] = (...args) => {
    // last arg may be axios config; allow callers to pass
    // a flag to suppress global notifications for local-only updates
    const maybeConfig = args[args.length - 1];
    const hasConfig = maybeConfig && typeof maybeConfig === "object" && !Array.isArray(maybeConfig);
    const skipNotify = hasConfig && (maybeConfig.suppressNotify || maybeConfig.suppressEvent || maybeConfig.noNotify);

 return originalMethod(...args).then((response) => {
  // Clear all cached GET responses
  clearApiGetCache();

  // Dispatch the update event after a short delay
  // so the backend has finished creating notifications.
  if (!skipNotify) {
    setTimeout(() => {
      notifyDataMutated({
        method,
        url: args[0],
        source: maybeConfig?.mutationSource,
      });
    }, 150);
  }

  return response;
});
  };
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const unauthorizedPaths = ["/auth/login", "/auth/register", "/auth/azure"];
    const isAuthRoute = unauthorizedPaths.some((path) =>
      error.config?.url?.includes(path),
    );

    if (error.response?.status === 401) {
      // Session/token expired (or not authorized). Force logout + redirect.
      // Avoid rendering empty dashboards by coordinating state via a global event.
      try {
        localStorage.clear();
      } catch {
        // ignore
      }

      // Notify AuthContext to clear state and redirect
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("flowtrack:auth-invalid"));
      }
    }

    return Promise.reject(error);
  },
);

// Task API functions
export const getTask = (id) => API.get(`/tasks/${id}`);
export const addTaskComment = (id, text) =>
  API.post(`/tasks/${id}/comments`, { text });
export const importTasks = (data) => API.post("/tasks/import", data);

// Bug API functions
export const getBugs = () => API.get("/bugs");
export const deleteBug = (id) => API.delete(`/bugs/${id}`);

// Sprint API functions
export const getSprintComments = (id) => API.get(`/sprints/${id}/comments`);
export const addSprintComment = (id, text) =>
  API.post(`/sprints/${id}/comments`, { text });

// Story API functions
export const getStoriesBySprint = (sprintId) =>
  API.get(`/stories?sprintId=${sprintId}`);

export const createStory = (data) => API.post(`/stories`, data);

export const updateStory = (id, data) => API.put(`/stories/${id}`, data);

export const deleteStory = (id) => API.delete(`/stories/${id}`);

// Story comments
export const getStoryComments = (id) => API.get(`/stories/${id}/comments`);

export const addStoryComment = (id, text) => API.post(`/stories/${id}/comments`, { text });


// User Management API functions
export const getRejectedUsers = () => API.get("/auth/rejected-users");
export const getEditedUsers = () => API.get("/auth/edited-users");
export const reApproveUser = (id) => API.put(`/auth/${id}/re-approve`);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/users/${id}`);

// Microsoft Login Tracking APIs
export const getMicrosoftLoginLogs = () =>
  API.get("/auth/microsoft-login-logs");
export const getMicrosoftLoginErrors = () =>
  API.get("/auth/microsoft-login-errors");

// Notification API
export { notificationAPI } from "./notificationApi.js";

// User issues (Guide & FAQ submit)
// Submit user issue (backend expects { message })
// Accepts either a plain string or { title, description } for backward compatibility.
export const submitUserIssue = (payload) => {
  const body =
    typeof payload === "string"
      ? { message: payload }
      : {
          message:
            payload?.description || payload?.title
              ? `${payload?.title || ""}`.trim() && payload?.description
                ? `${payload.title.trim()}: ${payload.description.trim()}`
                : payload?.description?.trim() || payload?.title?.trim()
              : "",
        };

  // If both title & description are empty, backend will return 400.
  return API.post("/user-issues", body);
};


export const getUserIssuesForAdmin = () => API.get("/user-issues");

