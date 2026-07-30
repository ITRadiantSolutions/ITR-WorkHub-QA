import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { API } from "../services/api";

const STALE_AFTER_MS = 60000;

const emptyResource = {
  items: [],
  status: "idle",
  error: null,
  lastFetched: 0,
};

const normalizeArray = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.[key])) return payload[key];
  return [];
};

const shouldFetchResource = (resource, force) => {
  if (force) return true;
  if (resource.status === "loading") return false;
  if (!resource.lastFetched) return true;
  return Date.now() - resource.lastFetched > STALE_AFTER_MS;
};

export const fetchProjects = createAsyncThunk(
  "sharedData/fetchProjects",
  async () => {
    const response = await API.get("/projects");
    return {
      items: normalizeArray(response.data, "projects"),
    };
  },
  {
    condition: ({ force = false } = {}, { getState }) =>
      shouldFetchResource(getState().sharedData.projects, force),
  },
);

export const fetchUsers = createAsyncThunk(
  "sharedData/fetchUsers",
  async () => {
    const response = await API.get("/users");
    return {
      items: normalizeArray(response.data, "users"),
    };
  },
  {
    condition: ({ force = false } = {}, { getState }) =>
      shouldFetchResource(getState().sharedData.users, force),
  },
);

export const fetchSprints = createAsyncThunk(
  "sharedData/fetchSprints",
  async () => {
    const response = await API.get("/sprints");
    return {
      items: normalizeArray(response.data, "sprints"),
    };
  },
  {
    condition: ({ force = false } = {}, { getState }) =>
      shouldFetchResource(getState().sharedData.sprints, force),
  },
);

const sharedDataSlice = createSlice({
  name: "sharedData",
  initialState: {
    projects: { ...emptyResource },
    users: { ...emptyResource },
    sprints: { ...emptyResource },
  },
  reducers: {
    invalidateProjects(state) {
      state.projects.lastFetched = 0;
    },
    invalidateUsers(state) {
      state.users.lastFetched = 0;
    },
    invalidateSprints(state) {
      state.sprints.lastFetched = 0;
    },
    invalidateAllSharedData(state) {
      state.projects.lastFetched = 0;
      state.users.lastFetched = 0;
      state.sprints.lastFetched = 0;
    },
  },
  extraReducers: (builder) => {
    const bindResource = (thunk, key) => {
      builder
        .addCase(thunk.pending, (state) => {
          state[key].status = "loading";
          state[key].error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state[key].status = "succeeded";
          state[key].items = action.payload.items;
          state[key].lastFetched = Date.now();
        })
        .addCase(thunk.rejected, (state, action) => {
          state[key].status = "failed";
          state[key].error = action.error?.message || "Failed to load data";
        });
    };

    bindResource(fetchProjects, "projects");
    bindResource(fetchUsers, "users");
    bindResource(fetchSprints, "sprints");
  },
});

export const {
  invalidateAllSharedData,
  invalidateProjects,
  invalidateSprints,
  invalidateUsers,
} = sharedDataSlice.actions;

export const selectProjects = (state) => state.sharedData.projects.items;
export const selectUsers = (state) => state.sharedData.users.items;
export const selectSprints = (state) => state.sharedData.sprints.items;
export const selectProjectsStatus = (state) => state.sharedData.projects.status;
export const selectUsersStatus = (state) => state.sharedData.users.status;
export const selectSprintsStatus = (state) => state.sharedData.sprints.status;

export default sharedDataSlice.reducer;
