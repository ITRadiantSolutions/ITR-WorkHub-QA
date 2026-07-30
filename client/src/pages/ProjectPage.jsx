import { useState, useEffect } from "react";
import { API, DATA_MUTATED_EVENT } from "../services/api";
import { useAuth } from "../context/AuthContext";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import ProjectDetail from "./ProjectDetail";
import CloneProjectModal from "../components/CloneProjectModal.jsx";
import { useAppDispatch, useAppSelector } from "../store/hooks.js";
import {
  fetchProjects,
  fetchUsers,
  selectProjects,
  selectUsers,
} from "../store/sharedDataSlice.js";
import { projectAPI } from "../services/projectApi";

// ── SVG Icons ────────────────────────────────────────────────────────────────
const Icon = {
  Plus: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Folder: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Users: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  User: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Calendar: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Arrow: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  X: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Check: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Empty: () => (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, variant }) {
  const styles = {
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    planning: "bg-violet-50 text-violet-700 border border-violet-200",
    completed: "bg-slate-100 text-slate-600 border border-slate-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-green-50 text-green-700 border border-green-200",
    default: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded ${styles[variant] || styles.default}`}
    >
      {label}
    </span>
  );
}

function getStatusVariant(s) {
  const m = { Active: "active", Planning: "planning", Completed: "completed" };
  return m[s] || "default";
}
function getPriorityVariant(p) {
  const m = { High: "high", Medium: "medium", Low: "low" };
  return m[p] || "default";
}

function getUserName(value, users) {
  if (!value) return "";
  if (typeof value === "object") {
    return value.name || users.find((u) => u._id === value._id)?.name || "";
  }
  return users.find((u) => u._id === value)?.name || "";
}

function formatProjectDate(value) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
// ── Field ───────────────────────────────────────────────────────────────
function Field({ label, required = false, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <span>{label}</span>

          {required && (
            <span className="text-red-500 text-lg font-bold leading-none">
              *
            </span>
          )}
        </label>
      )}

      {children}

      {error && (
        <p className="mt-0.5 text-[10px] font-medium text-red-500">{error}</p>
      )}
    </div>
  );
}

const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";

// ─────────────────────────────────────────────────────────────────────────────
export default function ProjectsPage({
  onRefresh,
  searchRequest,
  createRequest,
  openProjectRequest,
  onProjectCreated,
}) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const projects = useAppSelector(selectProjects);
  const users = useAppSelector(selectUsers);
  const [filters, setFilters] = useState({
    name: "",
    status: "ALL",
    priority: "ALL",
  });
  const [selectedProject, setSelectedProject] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "Planning",
    priority: "Medium",
    startDate: "",
    endDate: "",
    projectLead: "",
    teamMembers: [],
    attachments: [],
  });
  const [errors, setErrors] = useState({});
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [selectedForClone, setSelectedForClone] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [mutationVersion, setMutationVersion] = useState(0);
  const canCreate = user?.role === "ADMIN" || user?.role === "PM";
  const canClone = canCreate;
  const refreshProjects = (force = false) => dispatch(fetchProjects({ force }));

  const [projectsOverride, setProjectsOverride] = useState(null);

  const refreshProjectsWithFilters = async () => {
    const hasAny =
      filters.name.trim() ||
      filters.status !== "ALL" ||
      filters.priority !== "ALL";

    console.log("Has Any:", hasAny);

    if (!hasAny) {
      console.log("Loading normal projects");
      setProjectsOverride(null);
      refreshProjects(true);
      return;
    }

    try {
      console.log("Calling Search API");

      const res = await projectAPI.searchProjects({
        q: filters.name,
        status: filters.status,
        priority: filters.priority,
      });

      console.log("API Response:", res);

      const list = res?.projects || res?.data || res || [];
      setProjectsOverride(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Search Error:", err);
      setProjectsOverride([]);
    }
  };
  const displayedProjects = projectsOverride ?? projects;

  useEffect(() => {
    if (!openProjectRequest?.projectId) return;
    setSelectedProject(openProjectRequest.projectId);
  }, [openProjectRequest?.projectId, openProjectRequest?.requestId]);

  useEffect(() => {
    if (!createRequest?.requestId) return;
    setSelectedProject(null);
    setShowForm(true);
    setErrors({});
  }, [createRequest?.requestId]);

  useEffect(() => {
    if (searchRequest?.type !== "project") return;
    setSelectedProject(null);
    setFilters({
      name: searchRequest.query || "",
      status: "ALL",
      priority: "ALL",
    });
  }, [searchRequest]);
  useEffect(() => {
    dispatch(fetchProjects({ force: mutationVersion > 0 }));
  }, [dispatch, mutationVersion]);

  useEffect(() => {
    // debounce-lite: only run after small delay
    const t = setTimeout(() => {
      refreshProjectsWithFilters();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (canCreate) {
      dispatch(fetchUsers({ force: mutationVersion > 0 }));
    }
  }, [canCreate, dispatch, mutationVersion]);

  useEffect(() => {
    const handleDataMutation = () =>
      setMutationVersion((version) => version + 1);

    window.addEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    return () =>
      window.removeEventListener(DATA_MUTATED_EVENT, handleDataMutation);
  }, []);

  const validate = () => {
    const e = {};

    if (!form.name.trim()) e.name = "Project name is required";

    if (!form.description.trim()) e.description = "Description is required";

    if (!form.startDate) e.startDate = "Start date is required";

    if (!form.endDate) e.endDate = "End date is required";

    // Validate start & end dates
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);

      if (end <= start) {
        e.endDate = "End date must be greater than the start date.";
      }
    }

    if (!form.projectLead) e.projectLead = "Please select a project lead.";

    if (form.teamMembers.length === 0)
      e.teamMembers = "Select at least one team member.";

    setErrors(e);

    return Object.keys(e).length === 0;
  };

  const createProject = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Project create is JSON; attachments are uploaded after we get projectId
      const { attachments, ...payload } = form;
      const created = await API.post("/projects", payload);

      const projectId = created?.data?.project?._id;

      if (projectId && Array.isArray(attachments) && attachments.length > 0) {
        await projectAPI.uploadProjectAttachments(projectId, attachments);
      }

      setSuccessMsg("Project created successfully!");
      setForm({
        name: "",
        description: "",
        status: "Planning",
        priority: "Medium",
        startDate: "",
        endDate: "",
        projectLead: "",
        teamMembers: [],
        attachments: [],
      });
      setErrors({});
      setShowForm(false);
      await refreshProjects(true);
      if (onRefresh) onRefresh();
      onProjectCreated?.(created?.data?.project);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error(err);
      setErrors({ submit: "Failed to create project. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedProject) {
    return (
      <ProtectedRoute allowedRoles={["PM", "ADMIN", "DEVELOPER", "QA"]}>
        <ProjectDetail
          initialProject={projects.find((p) => p._id === selectedProject)}
          onBack={() => setSelectedProject(null)}
          users={users}
        />
      </ProtectedRoute>
    );
  }

  return (
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6"
    >
      {/* Page header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">All Projects</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {displayedProjects.length} project
              {displayedProjects.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            {(user?.role === "ADMIN" || user?.role === "PM") && (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative w-full max-w-md flex-1">
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>

                  <input
                    type="text"
                    placeholder="Search project or team lead..."
                    value={filters.name}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        name: e.target.value,
                      }))
                    }
                    className="h-10 w-100 rounded-xl border border-slate-800 bg-white pl-10 pr-10 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
                  />

                  {filters.name && (
                    <button
                      type="button"
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          name: "",
                        }))
                      }
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 text-black items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Icon.X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Status */}
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      status: e.target.value,
                    }))
                  }
                  className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
                >
                  <option value="ALL">All Status</option>
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>

                {/* Priority */}
                <select
                  value={filters.priority}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      priority: e.target.value,
                    }))
                  }
                  className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100"
                >
                  <option value="ALL">All Priority</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                {/* Clear Filters */}
              </div>
            )}

            {/* New Project */}
            {canCreate && (
              <button
                onClick={() => {
                  setShowForm(true);
                  setErrors({});
                }}
                className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                <Icon.Plus className="h-4 w-4" />
                New Project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-xs font-medium">
          <Icon.Check />
          {successMsg}
        </div>
      )}

      {/* Create form (slide-in panel style) */}
      {showForm && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* ── Header ── */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Create New Project
              </h2>
              <p className="text-[11px] text-slate-400">
                Manage project details, lead & team members
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                setErrors({});
              }}
              aria-label="Close"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-95"
            >
              <span>Close</span>
              <Icon.X size={14} strokeWidth={2.4} />
            </button>
          </div>

          <div className="p-5">
            {/* ── Row 1 : Project Name + Status + Attachments ── */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {/* Project Name */}
              <Field label="Project Name" required error={errors.name}>
                <input
                  className={inputCls}
                  placeholder="e.g. Website Redesign"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>

              {/* Status */}
              <Field label="Status" required error={errors.status}>
                <select
                  className={inputCls}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option>Planning</option>
                  <option>Active</option>
                  <option>Completed</option>
                </select>
              </Field>

              {/* Attachments */}
              <Field
                label={
                  <div className="flex items-center gap-2">
                    <span>Project Attachments</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                      Optional
                    </span>
                  </div>
                }
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <input
                    type="file"
                    multiple
                    className="block w-full cursor-pointer text-[11px] text-slate-600
          file:mr-3
          file:rounded-lg
          file:border-0
          file:bg-slate-200
          file:px-3
          file:py-1.5
          file:text-[10px]
          file:font-semibold
          file:text-slate-700
          hover:file:bg-slate-300"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        attachments: Array.from(e.target.files || []),
                      })
                    }
                  />

                  <p className="mt-2 text-[10px] text-slate-400">
                    Images, PDF, Word, Excel • Maximum 10 MB per file
                  </p>

                  {form.attachments?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {form.attachments.slice(0, 5).map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700"
                        >
                          📎
                          <span className="max-w-[120px] truncate">
                            {file.name}
                          </span>
                        </div>
                      ))}

                      {form.attachments.length > 5 && (
                        <div className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                          +{form.attachments.length - 5} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Field>
            </div>

            {/* ── Row 2 : Priority + Start Date + End Date ── */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Field label="Priority">
                <select
                  className={inputCls}
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </Field>

              <Field label="Start Date" required error={errors.startDate}>
                <input
                  type="date"
                  className={inputCls}
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      startDate: e.target.value,
                      endDate:
                        form.endDate && form.endDate < e.target.value
                          ? ""
                          : form.endDate,
                    })
                  }
                />
              </Field>

              <Field label="End Date" required error={errors.endDate}>
                <input
                  type="date"
                  className={inputCls}
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      endDate: e.target.value,
                    })
                  }
                />
              </Field>
            </div>

            {/* ── Row 3 : Description ── */}
            <div className="mb-3">
              <Field label="Description" required error={errors.description}>
                <div className="relative">
                  <textarea
                    rows={3}
                    maxLength={2000}
                    placeholder="Write a short project description..."
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[12.5px] leading-5 text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                  />
                  <div className="absolute bottom-2.5 right-3 text-[10px] text-slate-400 tabular-nums">
                    {form.description.length}/2000
                  </div>
                </div>
              </Field>
            </div>

            {/* ── Row 5 : Project Lead (left) + Team Members (right) ── */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Project Lead */}
              <Field label="Project Lead" required error={errors.projectLead}>
                {(() => {
                  const leadUsers = users.filter(
                    (u) => u.role === "PM" || u.role === "ADMIN",
                  );

                  const filteredLeads = leadUsers.filter((u) => {
                    if (!leadSearch.trim()) return true;

                    const q = leadSearch.toLowerCase();

                    return (
                      u.name?.toLowerCase().includes(q) ||
                      u.email?.toLowerCase().includes(q)
                    );
                  });

                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      {/* Header */}
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-600">
                          Choose Project Lead
                        </span>

                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                          {form.projectLead ? "1 selected" : "None"}
                        </span>
                      </div>

                      {/* Search */}
                      <div className="relative mb-2">
                        <svg
                          className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>

                        <input
                          type="text"
                          placeholder="Search lead..."
                          value={leadSearch}
                          onChange={(e) => setLeadSearch(e.target.value)}
                          className="h-7 w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-3 text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        />
                      </div>

                      {/* Lead List */}
                      <div className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
                        {filteredLeads.length === 0 && (
                          <div className="py-6 text-center text-[11px] text-slate-400">
                            No project lead found.
                          </div>
                        )}

                        {filteredLeads.map((u) => {
                          const selected = form.projectLead === u._id;

                          return (
                            <button
                              key={u._id}
                              type="button"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  projectLead: u._id,
                                })
                              }
                              className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left transition ${
                                selected
                                  ? "border-blue-200 bg-blue-50"
                                  : "border-transparent hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                                    u.role === "ADMIN"
                                      ? "bg-emerald-600"
                                      : "bg-blue-600"
                                  }`}
                                >
                                  {u.name?.charAt(0)?.toUpperCase()}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold text-slate-700">
                                    {u.name}
                                  </p>

                                  <p className="truncate text-[9px] text-slate-400">
                                    {u.email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${
                                    u.role === "ADMIN"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-blue-50 text-blue-700"
                                  }`}
                                >
                                  {u.role}
                                </span>

                                <div className="flex items-center justify-center">
                                  <div
                                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all ${
                                      selected
                                        ? "border-blue-600"
                                        : "border-slate-300"
                                    }`}
                                  >
                                    {selected && (
                                      <div className="h-2 w-2 rounded-full bg-blue-600" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </Field>

              {/* Team Members */}
              <Field
                required
                label={`Team Members (${
                  users.filter(
                    (u) =>
                      u.role === "DEVELOPER" ||
                      u.role === "QA" ||
                      u.role === "PM",
                  ).length
                })`}
                error={errors.teamMembers}
              >
                {(() => {
                  const availableUsers = users.filter(
                    (u) =>
                      u.role === "DEVELOPER" ||
                      u.role === "QA" ||
                      u.role === "PM",
                  );
                  const allSelected =
                    availableUsers.length > 0 &&
                    form.teamMembers.length === availableUsers.length;

                  const toggleMember = (id) => {
                    const exists = form.teamMembers.includes(id);
                    setForm({
                      ...form,
                      teamMembers: exists
                        ? form.teamMembers.filter((m) => m !== id)
                        : [...form.teamMembers, id],
                    });
                  };

                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-2">
                      {/* Top bar */}
                      <div className="mb-2 flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                teamMembers: e.target.checked
                                  ? availableUsers.map((u) => u._id)
                                  : [],
                              })
                            }
                            className="h-3 w-3 accent-slate-700"
                          />
                          Select All
                        </label>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                          {form.teamMembers.length} selected
                        </span>
                      </div>

                      {/* Search */}
                      <div className="relative mb-2">
                        <svg
                          className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Search member..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          className="h-7 w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-3 text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
                        />
                      </div>

                      {/* Members */}
                      <div className="max-h-45 space-y-1 overflow-y-auto pr-0.5">
                        {availableUsers
                          .filter((u) => {
                            if (!memberSearch.trim()) return true;
                            const q = memberSearch.toLowerCase();
                            return (
                              u.name?.toLowerCase().includes(q) ||
                              u.email?.toLowerCase().includes(q) ||
                              u.role?.toLowerCase().includes(q)
                            );
                          })
                          .map((u) => {
                            const checked = form.teamMembers.includes(u._id);
                            return (
                              <label
                                key={u._id}
                                className={`flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5 transition hover:bg-slate-50 ${
                                  checked
                                    ? "border-slate-300 bg-slate-50"
                                    : "border-transparent"
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleMember(u._id)}
                                    className="h-3 w-3 accent-slate-700"
                                  />
                                  <div
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                                      u.role === "QA"
                                        ? "bg-purple-500"
                                        : u.role === "PM"
                                          ? "bg-blue-500"
                                          : "bg-slate-700"
                                    }`}
                                  >
                                    {u.name?.charAt(0)?.toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-semibold text-slate-700">
                                      {u.name}
                                    </p>
                                    <p className="truncate text-[9px] text-slate-400">
                                      {u.email}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`ml-1.5 shrink-0 rounded px-1.5 py-0.5 text-[8px] font-semibold ${
                                    u.role === "QA"
                                      ? "bg-purple-50 text-purple-700"
                                      : u.role === "PM"
                                        ? "bg-blue-50 text-blue-700"
                                        : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {u.role}
                                </span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  );
                })()}
              </Field>
            </div>

            {/* ── Submit Error ── */}
            {errors.submit && (
              <p className="mb-3 text-[11px] text-red-500">{errors.submit}</p>
            )}

            {/* ── Actions — right-aligned ── */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => {
                  setShowForm(false);
                  setErrors({});
                }}
                className="rounded-xl bg-slate-100 px-4 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                {submitting ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon.Check size={13} />
                )}
                {submitting ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/*  Updated Field component — supports `required` red dot      */}
      {/* ─────────────────────────────────────────────────────────── */}

      {/* Projects grid */}
      {displayedProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center shadow-sm">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Icon.Empty />
          </div>

          <p className="text-base font-bold text-slate-700">No projects yet</p>

          <p className="text-sm text-slate-400 mt-1 mb-5">
            Start managing work by creating your first project
          </p>

          {canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-2.5 rounded-xl text-sm font-semibold"
            >
              <Icon.Plus />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayedProjects.map((p) => {
            const leadName = getUserName(p.projectLead, users);
            const leadInitial = leadName?.charAt(0)?.toUpperCase() || "N";
            const startDate = formatProjectDate(p.startDate);
            const endDate = formatProjectDate(p.endDate);
            const createdDate = formatProjectDate(p.createdAt);

            return (
              <div key={p._id} className="relative">
                <div
                  onClick={() => setSelectedProject(p._id)}
                  className="bg-gray-100 rounded-2xl border border-slate-200 shadow-sm transition cursor-pointer overflow-hidden"
                >
                  {/* Clone Button */}
                  {canClone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedForClone(p);
                        setShowCloneModal(true);
                      }}
                      className="absolute top-3 right-3 px-3 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 rounded-xl border border-slate-200"
                    >
                      Clone
                    </button>
                  )}

                  {/* Content */}
                  <div className="p-4">
                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-800 pr-16 line-clamp-1">
                      {p.name}
                    </h3>

                    {/* Description */}
                    <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-5 min-h-[38px]">
                      {p.description || "No description available"}
                    </p>
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 mt-0">
                      <Badge
                        label={p.status}
                        variant={getStatusVariant(p.status)}
                      />

                      <Badge
                        label={p.priority}
                        variant={getPriorityVariant(p.priority)}
                      />
                    </div>
                    {/* Lead */}
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-600">
                        {leadInitial}
                      </div>

                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">
                          Lead
                        </p>
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {leadName || "Not Assigned"}
                        </p>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                          <Icon.Calendar />
                          Start
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                          {startDate}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                          <Icon.Calendar />
                          End
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                          {endDate}
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Icon.Calendar />
                        Created {createdDate}
                      </span>

                      <span className="text-[11px] font-semibold text-slate-700">
                        Open →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCloneModal && selectedForClone && (
        <CloneProjectModal
          isOpen={showCloneModal}
          onClose={() => {
            setShowCloneModal(false);
            setSelectedForClone(null);
          }}
          sourceProject={selectedForClone}
          onSuccess={() => refreshProjects(true)}
        />
      )}
    </div>
  );
}
