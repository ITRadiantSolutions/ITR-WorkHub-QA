import { useState, useEffect, useRef } from "react";
import {
  API,
  getTask,
  addTaskComment,
  clearApiGetCache,
  DATA_MUTATED_EVENT,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import TaskViewModal from "../components/TaskViewModal";
import ImportTasksModal from "../components/ImportTasksModal";
import Icons from "../components/Icons";
import QaAssignModal from "../components/QaAssignModal";

// ── SVG Icons ────────────────────────────────────────────────────────────────

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, variant }) {
  const styles = {
    done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    progress: "bg-blue-50 text-blue-700 border border-blue-200",
    todo: "bg-slate-50 text-slate-600 border border-slate-200",
    qa: "bg-purple-50 text-purple-700 border border-purple-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-green-50 text-green-700 border border-green-200",
    default: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${styles[variant] || styles.default}`}
    >
      {label}
    </span>
  );
}

function getPriorityVariant(p) {
  return { High: "high", Medium: "medium", Low: "low" }[p] || "default";
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-slate-700">
        <span>{label}</span>

        {required && (
          <span className="text-red-500 text-lg font-bold leading-none">*</span>
        )}
      </label>

      {children}
    </div>
  );
}

const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";

function useDebouncedValue(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

const TASK_STATUS_OPTIONS = [
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "QA_TESTING", label: "QA Testing" },
  { value: "DONE", label: "Done" },
];

function MultiStatusFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const toggle = (status) =>
    onChange(
      value.includes(status)
        ? value.filter((item) => item !== status)
        : [...value, status],
    );
  const label =
    value.length === 0
      ? "All Status"
      : value.length === 1
        ? TASK_STATUS_OPTIONS.find((option) => option.value === value[0])?.label
        : `${value.length} Statuses`;
  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 min-w-28 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <span
          className={`text-[10px] text-slate-400 transition ${open ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-50"
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded border ${value.length === 0 ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}
            >
              {value.length === 0 ? "✓" : ""}
            </span>
            All Status
          </button>
          {TASK_STATUS_OPTIONS.map((option) => {
            const checked = value.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
function StatusSelect({ value, onChange, task, user }) {
  const options = [
    {
      value: "TODO",
      label: "Todo",
      cls: "bg-slate-50 text-slate-600 border-slate-200",
      dot: "bg-slate-400",
    },
    {
      value: "IN_PROGRESS",
      label: "In Progress",
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
      dot: "bg-indigo-600",
    },
    {
      value: "ON_HOLD",
      label: "On Hold",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    },
    {
      value: "QA_TESTING",
      label: "QA Testing",
      cls: "bg-purple-50 text-purple-700 border-purple-200",
      dot: "bg-purple-500",
    },
    {
      value: "DONE",
      label: "Done",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
    },
  ];

  const creatorRole = task?.createdBy?.role;
  const projectLeadId =
    task?.projectId?.projectLead?._id || task?.projectId?.projectLead;
  const projectCreatorId =
    task?.projectId?.createdBy?._id || task?.projectId?.createdBy;
  const projectMemberIds = (task?.projectId?.teamMembers || []).map(
    (member) => member?._id || member,
  );
  const currentUserId = user?._id || user?.id;
  const isSameProjectPm =
    user?.role === "PM" &&
    [projectLeadId, projectCreatorId, ...projectMemberIds].some(
      (memberId) => memberId?.toString() === currentUserId?.toString(),
    );
  const canCloseAdminPmTask = user?.role === "ADMIN" || isSameProjectPm;
  const visibleOptions =
    task &&
    ["ADMIN", "PM"].includes(creatorRole) &&
    !canCloseAdminPmTask &&
    value !== "DONE"
      ? options.filter((option) => option.value !== "DONE")
      : options;

  const active =
    visibleOptions.find((o) => o.value === value) || visibleOptions[0];

  return (
    <div className="relative w-full">
      {/* Status dot */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div className={`w-2 h-2 rounded-full ${active.dot}`} />
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full border rounded-xl pl-7 pr-7 py-2.5 text-xs font-bold
          cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400
          focus:border-transparent appearance-none transition-all
          hover:brightness-95
          ${active.cls}
        `}
        style={{ backgroundImage: "none" }}
      >
        {visibleOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Chevron */}
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
function SearchableProjectSelect({ projects, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const selectedProject = projects.find(
    (project) => String(project._id) === String(value),
  );
  const filteredProjects = projects.filter((project) =>
    (project.name || "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-800 transition-all hover:border-slate-300 hover:bg-white focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
      >
        <span
          className={selectedProject ? "truncate" : "truncate text-slate-400"}
        >
          {selectedProject?.name || "Select project..."}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <div role="listbox" className="max-h-52 overflow-y-auto p-1.5">
            {filteredProjects.length ? (
              filteredProjects.map((project) => {
                const selected = String(project._id) === String(value);
                return (
                  <button
                    key={project._id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(project._id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${selected ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span className="truncate">{project.name}</span>
                    {selected && <span className="ml-2 text-blue-600">✓</span>}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-5 text-center text-xs text-slate-400">
                No projects found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth();
  const skippedInitialFilterFetch = useRef(false);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [pages, setPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalTasks, setTotalTasks] = useState(0);

  const [allUsers, setAllUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projectEmployees, setProjectEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [hasNewTaskData, setHasNewTaskData] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterCreated, setFilterCreated] = useState("ALL");
  const [taskSearchInput, setTaskSearchInput] = useState("");
  // const searchQuery = useDebouncedValue(taskSearchInput, 350);
  const searchQuery = useDebouncedValue(taskSearchInput, 400);
  useEffect(() => {
    if (taskSearchInput !== searchQuery) setSearchLoading(true);
  }, [taskSearchInput, searchQuery]);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showTaskSearchSuggestions, setShowTaskSearchSuggestions] =
    useState(false);

  const [showEmployeeList, setShowEmployeeList] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    projectId: "",
    assignees: [],
    priority: "Medium",
    dueDate: "",
    status: "TODO",
  });
  const [selectedProject, setSelectedProject] = useState(null);
  const [dueDateError, setDueDateError] = useState("");
  // Start date is not used for task create/import; keeping edit-only form logic guarded.
  const [startDateError, setStartDateError] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const canCreate = user?.role === "ADMIN" || user?.role === "PM";

  const exportTasksExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatuses.length > 0)
        params.set("status", filterStatuses.join(","));
      if (filterPriority !== "ALL") params.set("priority", filterPriority);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const url = `/tasks/export?${params.toString()}`;

      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api${url}`, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const fileName = `tasks_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export Excel failed:", err);
      toast.error(err?.message || "Failed to export tasks");
    }
  };

  // Fetch project-specific employees when project changes.
  // Important: this runs for BOTH create form and edit modal.
  // For edit modal, it ensures assignees & dueDateError are recalculated
  // after ADMIN changes task project.
  useEffect(() => {
    const currentProjectId = formData.projectId;

    if (!currentProjectId) {
      setProjectEmployees([]);
      setSelectedProject(null);
      setDueDateError("");
      // Only clear assignees when we are actually on create form.
      // For edit modal, keep assignees until a real project is selected.
      if (showForm) {
        setFormData((prev) => ({ ...prev, assignees: [] }));
      }
      return;
    }

    const fetchProjectData = async () => {
      try {
        setEmployeesLoading(true);

        const projectRes = await API.get(`/projects/${currentProjectId}`);
        const projectData = projectRes.data.data || projectRes.data;
        setSelectedProject(projectData);

        const employeesRes = await API.get(
          `/projects/${currentProjectId}/employees`,
        );
        const nextProjectEmployees = employeesRes.data.data || [];
        setProjectEmployees(nextProjectEmployees);

        // If current selected assignees are not in new project's employee list, clear them.
        setFormData((prev) => {
          const prevAssignees = Array.isArray(prev.assignees)
            ? prev.assignees
            : [];
          const validIds = new Set(nextProjectEmployees.map((e) => e._id));
          const filteredAssignees = prevAssignees.filter((id) =>
            validIds.has(id),
          );
          return { ...prev, assignees: filteredAssignees };
        });

        // Validate due date against project start date
        if (formData.dueDate && projectData.startDate) {
          // Use local midnight comparisons
          const due = new Date(formData.dueDate);
          const start = new Date(projectData.startDate);
          if (due < start) {
            setDueDateError(
              `Due date cannot be before project start date (${start.toLocaleDateString()})`,
            );
          } else {
            setDueDateError("");
          }
        } else {
          setDueDateError("");
        }
      } catch (error) {
        console.error("Error fetching project data:", error);
        setProjectEmployees([]);
        setSelectedProject(null);
        setDueDateError("");
      } finally {
        setEmployeesLoading(false);
      }
    };

    fetchProjectData();
  }, [formData.projectId, formData.dueDate, showForm]);

  useEffect(() => {
    fetchData();
  }, []);

  const pendingSocketRefreshRef = useRef(false);
  const lastSocketEventAtRef = useRef(0);
  const inFlightRefreshRef = useRef(null);
  const lastDedupKeyRef = useRef("");

  const refreshFromRealtimeEvent = async (evt) => {
    const now = Date.now();
    if (now - lastSocketEventAtRef.current < 400) return;
    lastSocketEventAtRef.current = now;

    // Idempotency / dedupe: ignore repeated identical events arriving quickly.
    const key = `${evt?.action || ""}:${evt?.taskId || ""}:${evt?.newStatus || ""}:${Math.floor(
      (evt?.occurredAt || now) / 1000,
    )}`;

    if (lastDedupKeyRef.current === key) return;
    lastDedupKeyRef.current = key;

    if (pendingSocketRefreshRef.current) return;
    pendingSocketRefreshRef.current = true;

    // Ensure only one refresh request runs at a time.
    if (inFlightRefreshRef.current) return;

    inFlightRefreshRef.current = (async () => {
      try {
        if (user?.role === "ADMIN" || user?.role === "PM") {
          await fetchGlobalSearchTasks({ reset: true });
        } else {
          await fetchPaginatedTasks({ reset: true });
        }
      } catch (e) {
        console.error("Realtime refresh failed", e);
      } finally {
        pendingSocketRefreshRef.current = false;
        inFlightRefreshRef.current = null;
      }
    })();

    return inFlightRefreshRef.current;
  };

  useEffect(() => {
    const handleRealtimeMutation = (event) => {
      const detail = event?.detail || {};
      const currentUserId = user?._id || user?.id;
      const isLocalStatusUpdate = detail.source === "task-status-local";
      const isOwnSocketUpdate =
        detail.source === "socket" &&
        currentUserId &&
        detail.performedBy &&
        String(currentUserId) === String(detail.performedBy);

      // The changed row is updated optimistically below. Ignore only the
      // local API event and its socket echo so the whole table does not reload.
      if (isLocalStatusUpdate || isOwnSocketUpdate) return;

      clearApiGetCache();
      refreshFromRealtimeEvent(detail);
    };

    window.addEventListener(DATA_MUTATED_EVENT, handleRealtimeMutation);
    return () =>
      window.removeEventListener(DATA_MUTATED_EVENT, handleRealtimeMutation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?._id,
    user?.id,
    filterStatuses,
    filterPriority,
    filterCreated,
    searchQuery,
    showOverdueOnly,
  ]);
  useEffect(() => {
    const handleGlobalTyping = (e) => {
      const tag = document.activeElement?.tagName;

      // Ignore if already typing in input/textarea/select
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      // Ignore shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Only letters/numbers
      if (e.key.length === 1) {
        searchInputRef.current?.focus();

        setTaskSearchInput((prev) => prev + e.key);
      }
    };

    window.addEventListener("keydown", handleGlobalTyping);

    return () => {
      window.removeEventListener("keydown", handleGlobalTyping);
    };
  }, []);
  useEffect(() => {
    if (!skippedInitialFilterFetch.current) {
      skippedInitialFilterFetch.current = true;
      return;
    }

    // On filter/search change, refetch tasks.
    // - For ADMIN/PM: use global paginated search API so results are still limited by page.
    // - For others: keep existing paginated listing.
    const shouldUseGlobal = user?.role === "ADMIN" || user?.role === "PM";

    if (shouldUseGlobal) {
      fetchGlobalSearchTasks({ reset: true });
    } else {
      setGlobalSearchResults([]);
      fetchPaginatedTasks({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterStatuses,
    filterPriority,
    filterCreated,
    searchQuery,
    showOverdueOnly,
  ]);

  const fetchInitialMeta = async () => {
    const [projectsRes, employeesRes] = await Promise.all([
      API.get("/projects"),
      API.get("/users"),
    ]);

    const userList = employeesRes?.data?.data || employeesRes?.data || [];

    setProjects(projectsRes.data?.data || projectsRes.data || []);
    setAllUsers(Array.isArray(userList) ? userList : []);
    setEmployees(
      (Array.isArray(userList) ? userList : []).filter(
        (u) => u.role === "EMPLOYEE",
      ),
    );
    setProjectEmployees([]);
  };

  const latestRequestIdRef = useRef(0);
  const searchInputRef = useRef(null);

  // reset: jump back to page 1 (filters/search changed). pageOverride: go to
  // a specific page (pagination bar). Every call replaces the page's worth of
  // tasks — this is numbered pagination, not infinite accumulation.
  const fetchPaginatedTasks = async ({ reset, pageOverride } = {}) => {
    ++latestRequestIdRef.current;

    if (reset && !searchQuery.trim()) {
      setLoading(true);
    } else if (!reset) {
      setLoadingMore(true);
    }

    if (reset) {
      setPage(1);
      setPages(1);
    }

    const currentPage = reset ? 1 : pageOverride || page;

    try {
      const params = {
        page: String(currentPage),
        limit: String(limit),
      };

      if (filterStatuses.length > 0) params.status = filterStatuses.join(",");
      if (filterPriority !== "ALL") params.priority = filterPriority;
      if (filterCreated !== "ALL") params.createdAtRange = filterCreated;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const tasksRes = await API.get("/tasks", { params });

      const payload = tasksRes.data;
      const newTasks = payload?.data || payload || [];
      const pg = payload?.pagination;

      setTasks(newTasks);
      setPage(currentPage);
      setPages(pg?.pages ?? 1);
      setTotalTasks(pg?.total ?? 0);
    } catch (err) {
      console.error("Error fetching paginated tasks:", err);
      if (reset) {
        setTasks([]);
        setPages(1);
        setTotalTasks(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchGlobalSearchTasks = async ({ reset, pageOverride } = {}) => {
    // Prevent stale request overwrite
    ++latestRequestIdRef.current;

    const requestId = latestRequestIdRef.current;

    // Smooth loading UX
    // setLoading(true);
    // Smooth loading UX
    if (reset && !searchQuery.trim()) {
      setLoading(true);
    } else {
      setSearchLoading(true);
    }

    if (reset) {
      setPage(1);
      setPages(1);

      // IMPORTANT:
      // instantly clear old search result
      setGlobalSearchResults([]);
    }

    const currentPage = reset ? 1 : pageOverride || page;

    try {
      const params = {
        page: String(currentPage),
        limit: String(limit),
      };

      if (filterStatuses.length > 0) {
        params.status = filterStatuses.join(",");
      }

      if (filterPriority !== "ALL") {
        params.priority = filterPriority;
      }

      if (filterCreated !== "ALL") {
        params.createdAtRange = filterCreated;
      }

      if (searchQuery.trim().length >= 2) {
        params.q = searchQuery.trim();
      }

      if (showOverdueOnly) {
        params.overdue = "true";
      }

      if (selectedProject?.projectId) {
        params.projectId = selectedProject.projectId;
      }

      const tasksRes = await API.get("/tasks/search/global", {
        params,
      });

      const payload = tasksRes.data;

      // Safe array handling
      const newTasks = Array.isArray(payload?.data) ? payload.data : [];

      const pg = payload?.pagination || {};
      if (payload?.summary) setCounts(payload.summary);

      // Ignore old responses
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      setGlobalSearchResults(newTasks);

      setPages(pg?.pages ?? 1);

      setTotalTasks(pg?.total ?? 0);

      setPage(currentPage);
    } catch (err) {
      console.error("Global search failed:", err);

      // Only clear latest request
      if (reset && requestId === latestRequestIdRef.current) {
        setGlobalSearchResults([]);

        setPages(1);

        setTotalTasks(0);
      }
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
        setSearchLoading(false);
      }
    }
  };
  const goToPage = (targetPage) => {
    if (targetPage < 1 || targetPage > pages || targetPage === page || loadingMore) return;
    if (user?.role === "ADMIN" || user?.role === "PM") {
      fetchGlobalSearchTasks({ pageOverride: targetPage });
    } else {
      fetchPaginatedTasks({ pageOverride: targetPage });
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      await fetchInitialMeta();
      if (user?.role === "ADMIN" || user?.role === "PM") {
        await fetchGlobalSearchTasks({ reset: true });
      } else {
        await fetchPaginatedTasks({ reset: true });
      }
      setHasNewTaskData(false);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    // Validate due date vs project start date (startDate removed)
    if (selectedProject?.startDate && formData.dueDate) {
      const due = new Date(formData.dueDate + "T23:59:59"); // End of day
      const projectStart = new Date(selectedProject.startDate);
      if (due < projectStart) {
        toast.error(
          `Due date must be on or after project start date: ${projectStart.toLocaleDateString()}`,
        );
        return;
      }
    }

    if (!formData.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    if (!formData.projectId) {
      toast.error("Project is required");
      return;
    }

    if (!formData.assignees.length) {
      toast.error("Please select at least one assignee");
      return;
    }

    if (!formData.dueDate) {
      toast.error("Due date is required");
      return;
    }

    if (dueDateError || startDateError) {
      toast.error("Please fix date validation errors");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description || "",
        projectId: formData.projectId,
        assignees: formData.assignees,
        priority: formData.priority,
        startDate: formData.startDate || null,
        dueDate: formData.dueDate,
      };
      const res = await API.post("/tasks", payload);

      const newTask = res.data?.data || res.data;

      setTasks((prev) => [...prev, newTask]);
      setHasNewTaskData(false);

      setFormData({
        title: "",
        description: "",
        projectId: "",
        assignees: [],
        priority: "Medium",
        dueDate: "",
        status: "TODO",
      });

      setSelectedProject(null);
      setDueDateError("");

      setShowForm(false);
      toast.success("Task created successfully!");
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to create task",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const handleStatusChange = async (taskId, newStatus, task) => {
    // QA Flow
    if (newStatus === "QA_TESTING") {
      setQaAssignTask(task);
      setShowQaAssignModal(true);
      return;
    }

    await handleUpdateStatus(taskId, newStatus);
  };
  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await API.put(
        `/tasks/${taskId}`,
        { status: newStatus },
        { mutationSource: "task-status-local" },
      );

      // Always update paginated list
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
      );

      // Also update global-search list (Admin/PM uses this for table rendering)
      setGlobalSearchResults((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
      );

      await refreshTaskSummaryCounts();
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  const fetchTaskDetails = async (taskId) => {
    try {
      setTaskLoading(true);
      const response = await getTask(taskId);
      const task = response.data.data || response.data;
      setTaskDetails(task);
      setComments(task.comments || []);
    } catch (error) {
      console.error("Error fetching task details:", error);
      alert("Failed to load task comments. Please try again.");
    } finally {
      setTaskLoading(false);
    }
  };

  const handleViewTask = async (task) => {
    setSelectedTask(task);
    await fetchTaskDetails(task._id);
    setShowViewModal(true);
  };

  const filteredEmployees = projectEmployees.filter(
    (emp) =>
      emp.name?.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      emp.email?.toLowerCase().includes(employeeSearch.toLowerCase()),
  );

  const canShowUserSearchSuggestions =
    user?.role === "ADMIN" || user?.role === "PM";
  const normalizedTaskSearch = taskSearchInput.trim().toLowerCase();
  const safeAllUsers = Array.isArray(allUsers) ? allUsers : [];

  const taskSearchSuggestions =
    canShowUserSearchSuggestions && normalizedTaskSearch
      ? safeAllUsers
          .filter((u) => {
            const name = u.name?.toLowerCase() || "";
            const email = u.email?.toLowerCase() || "";
            return (
              name.includes(normalizedTaskSearch) ||
              email.includes(normalizedTaskSearch)
            );
          })
          .slice(0, 6)
      : [];

  const currentUserId = user?._id || user?.id;

  // Include current user (Admin/PM) in assignee list if they are creating a personal task
  const currentUserAssignee = currentUserId
    ? {
        _id: currentUserId,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    : null;
  const assigneeList =
    canCreate && currentUserAssignee
      ? [
          currentUserAssignee,
          ...filteredEmployees.filter((emp) => emp._id !== currentUserId),
        ]
      : filteredEmployees;
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setCommentLoading(true);
      const response = await addTaskComment(
        selectedTask._id,
        newComment.trim(),
      );
      setComments(response.data.data);
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment");
    } finally {
      setCommentLoading(false);
    }
  };

  const handleEditTask = async (task) => {
    setSelectedTask(task);
    const initialFormData = {
      title: task.title,
      description: task.description || "",
      projectId:
        typeof task.projectId === "object"
          ? task.projectId._id
          : task.projectId,
      assignees:
        task.assignees?.map((a) => (typeof a === "object" ? a._id : a)) || [],
      priority: task.priority || "Medium",
      startDate: task.startDate ? task.startDate.split("T")[0] : "",
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
      status: task.status,
    };
    setFormData(initialFormData);
    setShowEditModal(true);
    setEditing(false);

    // Trigger project loading for edit modal
    if (initialFormData.projectId) {
      try {
        const projectRes = await API.get(
          `/projects/${initialFormData.projectId}`,
        );
        const projectData = projectRes.data.data || projectRes.data;
        setSelectedProject(projectData);

        const response = await API.get(
          `/projects/${initialFormData.projectId}/employees`,
        );
        setProjectEmployees(response.data.data || []);
      } catch (error) {
        console.error("Error loading edit data:", error);
      }
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();

    // Validate start date vs project start date
    if (selectedProject?.startDate && formData.startDate) {
      const taskStart = new Date(formData.startDate);
      const projectStart = new Date(selectedProject.startDate);
      if (taskStart < projectStart) {
        toast.error(
          `Start date must be on or after project start date: ${projectStart.toLocaleDateString()}`,
        );
        return;
      }
    }

    // Validate due date vs task start date
    if (formData.dueDate && formData.startDate) {
      const due = new Date(formData.dueDate + "T23:59:59");
      const taskStart = new Date(formData.startDate);
      if (due < taskStart) {
        toast.error("Due date must be on or after task start date");
        return;
      }
    }

    // Validate due date vs project start date for update
    if (selectedProject?.startDate && formData.dueDate) {
      const due = new Date(formData.dueDate + "T23:59:59");
      const projectStart = new Date(selectedProject.startDate);
      if (due < projectStart) {
        toast.error(
          `Due date must be on or after project start date: ${projectStart.toLocaleDateString()}`,
        );
        return;
      }
    }
    if (!formData.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    if (!formData.projectId) {
      toast.error("Project is required");
      return;
    }

    if (!formData.assignees.length) {
      toast.error("Please select at least one assignee");
      return;
    }

    if (!formData.dueDate) {
      toast.error("Due date is required");
      return;
    }

    if (dueDateError || startDateError) {
      toast.error("Please fix date validation errors");
      return;
    }
    setEditing(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description || "",
        projectId: formData.projectId,
        assignees: formData.assignees,
        priority: formData.priority,
        startDate: formData.startDate || null,
        dueDate: formData.dueDate,

        // Prevent normal edit API from sending QA_TESTING
        status:
          formData.status === "QA_TESTING"
            ? selectedTask?.status || "TODO"
            : formData.status,
      };
      const res = await API.put(`/tasks/${selectedTask._id}`, payload);
      const updatedTask = res.data?.data || res.data;

      setTasks((prev) =>
        prev.map((t) => (t._id === selectedTask._id ? updatedTask : t)),
      );

      setShowEditModal(false);
      setFormData({
        title: "",
        description: "",
        projectId: "",
        assignees: [],
        priority: "Medium",
        startDate: "",
        dueDate: "",
        status: "TODO",
      });
      setSelectedProject(null);
      setDueDateError("");
      setStartDateError("");
      toast.success("Task updated successfully!");
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to update task",
      );
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (taskId) => {
    toast.custom((t) => (
      <div className="w-[360px] rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Icons.Alert />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-800">Delete Task</h3>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Are you sure you want to delete this task?
            </p>

            <p className="mt-1 text-[11px] text-red-500 font-medium">
              This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => toast.dismiss(t)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>

          <button
            onClick={async () => {
              toast.dismiss(t);

              try {
                await API.delete(`/tasks/${taskId}`);

                setTasks((prev) => prev.filter((task) => task._id !== taskId));
                setGlobalSearchResults((prev) =>
                  prev.filter((task) => task._id !== taskId),
                );
                setTotalTasks((prev) => Math.max(0, prev - 1));
                await refreshTaskSummaryCounts();
                setHasNewTaskData(false);

                toast.success("Task deleted successfully");
              } catch (err) {
                console.error("Error deleting task:", err);

                toast.error("Failed to delete task");
              }
            }}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  const getAssigneesPreview = (assignees) => {
    if (!assignees || assignees.length === 0) return "Unassigned";
    if (assignees.length === 1) return getAssigneeName(assignees[0]);
    return (
      assignees.slice(0, 2).map(getAssigneeName).join(", ") +
      (assignees.length > 2 ? ` +${assignees.length - 2}` : "")
    );
  };

  const getAssigneeName = (a) => {
    if (typeof a === "object" && a?.name) return a.name;
    const matchedAssignee =
      projectEmployees.find((e) => e._id === a) ||
      assigneeList.find((e) => e._id === a);
    if (matchedAssignee?.name) return matchedAssignee.name;
    return employees.find((e) => e._id === a)?.name || "—";
  };
  const getProjectName = (p) => {
    if (typeof p === "object" && p?.name) return p.name;
    return projects.find((pr) => pr._id === p)?.name || "—";
  };

  /* eslint-disable-next-line no-unused-vars */
  const getAssigneeRole = (a) => {
    if (typeof a === "object" && a?.role) return a.role;
    const matchedAssignee =
      projectEmployees.find((e) => e._id === a) ||
      assigneeList.find((e) => e._id === a);
    if (matchedAssignee?.role) return matchedAssignee.role;
    return employees.find((e) => e._id === a)?.role || "EMPLOYEE";
  };

  const toDay = (d) => {
    // dueDate is stored as YYYY-MM-DD (date-only). Normalize to local midnight.
    const x = new Date(d);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  };

  const today = toDay(new Date());

  const toDayOf = (d) => toDay(d);

  const isCreatedInRange = (createdAt) => {
    if (!createdAt) return false;

    const created = toDayOf(createdAt);
    const now = today;

    if (filterCreated === "ALL") return true;
    if (filterCreated === "TODAY") {
      return created.getTime() === now.getTime();
    }

    if (filterCreated === "LAST_7_DAYS") {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return created >= from && created <= now;
    }

    if (filterCreated === "LAST_30_DAYS") {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return created >= from && created <= now;
    }

    if (filterCreated === "THIS_MONTH") {
      return (
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth()
      );
    }

    return true;
  };

  const hasGlobalSearch = user?.role === "ADMIN" || user?.role === "PM";

  const baseTasks = hasGlobalSearch ? globalSearchResults : tasks;
  const hasActiveTaskFilters =
    filterStatuses.length > 0 ||
    filterPriority !== "ALL" ||
    filterCreated !== "ALL" ||
    Boolean(taskSearchInput.trim()) ||
    showOverdueOnly;

  const filtered = showOverdueOnly
    ? [...baseTasks]
        .filter((t) => isCreatedInRange(t.createdAt))
        .sort((a, b) => {
          if (!a?.dueDate && !b?.dueDate) return 0;
          if (!a?.dueDate) return 1;
          if (!b?.dueDate) return -1;
          // Latest due date first (most recently due/overdue)
          return new Date(b.dueDate) - new Date(a.dueDate);
        })
    : baseTasks.filter((t) => isCreatedInRange(t.createdAt));
  const [showQaAssignModal, setShowQaAssignModal] = useState(false);
  const [qaAssignTask, setQaAssignTask] = useState(null);
  const [counts, setCounts] = useState({
    total: 0,
    todo: 0,
    progress: 0,
    onHold: 0,
    qaTesting: 0,
    done: 0,
    overdue: 0,
  });

  const getSummaryParams = () => {
    const params = {};
    if (filterStatuses.length > 0) params.status = filterStatuses.join(",");
    if (filterPriority !== "ALL") params.priority = filterPriority;
    if (filterCreated !== "ALL") params.createdAtRange = filterCreated;
    if (searchQuery.trim().length >= 2) {
      params.q = searchQuery.trim();
    }
    return params;
  };

  const refreshTaskSummaryCounts = async () => {
    try {
      const res = await API.get("/tasks/summary", {
        params: getSummaryParams(),
        cache: false,
      });
      const payload = res.data?.data || res.data;
      if (payload) setCounts(payload);
    } catch (err) {
      console.error("Error fetching task summary counts:", err);
    }
  };

  return (
    // <div
    //   style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
    //   className="max-w-6xl"
    // >
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="w-full max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6"
    >
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            Task Management
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {showOverdueOnly ? (
              <>
                Showing {filtered.length} overdue
                {filtered.length !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                {counts.total} total task
                {counts.total !== 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap w-full lg:w-auto items-center gap-2">
            {/* Refresh */}
            <button
              onClick={() => fetchData()}
              className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                hasNewTaskData
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title={
                hasNewTaskData
                  ? "New task data is available. Click to refresh."
                  : "Refresh tasks"
              }
            >
              <span className={loading ? "animate-spin" : ""}>
                <Icons.Refresh />
              </span>
              {hasNewTaskData ? "Refresh New" : "Refresh"}
            </button>

            {/* Export */}
            <button
              onClick={exportTasksExcel}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
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
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M10 14l2 2 4-4" />
                <path d="M20 14v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10" />
              </svg>
              Export Excel
            </button>

            {/* Import */}
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700  hover:bg-slate-50"
            >
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Import Tasks
            </button>

            {/* Create */}
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white  hover:bg-indigo-700"
            >
              <Icons.Plus />
              Create Task
            </button>
          </div>
        )}
      </div>

      {/* Summary strip */}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6 xl:grid-cols-6">
        {[
          {
            label: "Total ",
            val: counts.total,
            color: "text-indigo-700",
            bg: "bg-indigo-50",
            icon: <Icons.Tasks />,
          },

          {
            label: "Todo",
            val: counts.todo,
            color: "text-slate-500",
            bg: "bg-slate-100",
            icon: <Icons.Alert />,
          },

          {
            label: "Progress",
            val: counts.progress,
            color: "text-blue-600",
            bg: "bg-blue-50",
            icon: <Icons.InProgess />,
          },

          {
            label: "On Hold",
            val: counts.onHold,
            color: "text-amber-600",
            bg: "bg-amber-50",
            icon: <Icons.OnHold />,
          },
          {
            label: "QA",
            val: counts.qaTesting,
            color: "text-purple-600",
            bg: "bg-purple-50",
            icon: <Icons.QATesting />,
          },

          {
            label: "Done",
            val: counts.done,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            icon: <Icons.Check />,
          },
        ].map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]"
          >
            {/* Left */}
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {s.label}
              </p>

              <p className="mt-1 text-lg font-extrabold leading-none tracking-tight text-slate-900">
                {s.val}
              </p>
            </div>

            {/* Icon */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${s.bg} ${s.color}`}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Create Task Form */}

      {showForm && (
        <div
          className="mb-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                {/* task icon */}
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
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">New Task</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Fill in the details below to create a task
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition"
            >
              <Icons.X />
            </button>
          </div>

          {/* ── Form ────────────────────────────────────────────────────── */}
          <form onSubmit={handleCreate} className="p-5 space-y-4">
            {/* Row 1 — Title + Project */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-slate-700">
                  <span>Task Title</span>
                  <span className="text-lg font-bold leading-none text-red-500">
                    *
                  </span>
                </label>
                <input
                  className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent placeholder-slate-400 transition-all hover:border-slate-300 hover:bg-white"
                  placeholder="e.g. Design login page"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-700">
                  <span>Project</span>
                  <span className="text-xl font-bold leading-none text-red-500">
                    *
                  </span>
                </label>
                <SearchableProjectSelect
                  projects={projects}
                  value={formData.projectId}
                  onChange={(projectId) =>
                    setFormData({
                      ...formData,
                      projectId,
                      assignees: [],
                    })
                  }
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Add task details, acceptance criteria, or notes…"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent placeholder-slate-400 resize-none transition-all hover:border-slate-300 hover:bg-white leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 mt-1 text-right">
                {formData.description?.length || 0} chars
              </p>
            </div>

            {/* Row 3 — Priority + Status + Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {/* Priority */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Priority
                </label>
                <div className="relative">
                  <select
                    className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent appearance-none transition-all hover:border-slate-300 hover:bg-white pr-8"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                  {/* Priority dot */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        formData.priority === "High"
                          ? "bg-red-500"
                          : formData.priority === "Medium"
                            ? "bg-amber-500"
                            : "bg-green-500"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Status
                </label>
                <div className="border border-slate-200 bg-slate-50 rounded-xl px-1 py-1 hover:border-slate-300 transition">
                  <StatusSelect
                    value={formData.status}
                    onChange={(val) =>
                      setFormData({ ...formData, status: val })
                    }
                    task={selectedTask}
                    user={user}
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="mb-2 flex items-center gap-1 text-sm font-semibold text-slate-700">
                  <span>Due Date</span>
                  <span className="text-xl font-bold leading-none text-red-500">
                    *
                  </span>
                </label>
                <div className="relative">
                  {/* Native date input (invisible, handles picker) */}
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                    min={selectedProject?.startDate || undefined}
                    required
                    className="absolute inset-0 z-20 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                  />
                  {/* Styled display */}
                  <div className="flex items-center gap-2.5 border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl hover:border-slate-300 hover:bg-white transition">
                    <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
                      <Icons.Calendar />
                    </div>
                    <span
                      className={`text-sm flex-1 ${formData.dueDate ? "text-slate-800 font-medium" : "text-slate-400"}`}
                    >
                      {formData.dueDate
                        ? new Date(formData.dueDate).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "Pick a date"}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-slate-400"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
                {dueDateError && (
                  <p className="text-[11px] text-red-500 mt-1">
                    {dueDateError}
                  </p>
                )}
              </div>
            </div>

            {/* ── Assignees ─────────────────────────────────────────────── */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Assign Members <span className="text-red-400">*</span>
              </label>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Assignee toolbar */}
                <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 bg-slate-50">
                  {/* Search */}
                  <div className="relative flex-1">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Icons.Search />
                    </div>
                    <input
                      type="text"
                      placeholder="Search member…"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="w-full border border-slate-200 bg-white pl-8 pr-3 py-1.5 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                    />
                  </div>

                  {/* Select all */}
                  {assigneeList.length > 0 && (
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded accent-slate-900"
                        checked={
                          assigneeList.length > 0 &&
                          assigneeList.every((e) =>
                            formData.assignees.includes(e._id),
                          )
                        }
                        onChange={(ev) =>
                          setFormData({
                            ...formData,
                            assignees: ev.target.checked
                              ? assigneeList.map((e) => e._id)
                              : [],
                          })
                        }
                      />
                      All
                    </label>
                  )}

                  {/* Count pill */}
                  <span
                    className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      formData.assignees.length > 0
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {formData.assignees.length} selected
                  </span>
                </div>

                {/* Employee grid */}
                <div className="max-h-[220px] overflow-y-auto p-2.5">
                  {!formData.projectId ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-400">
                        Select a project first to see team members
                      </p>
                    </div>
                  ) : employeesLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                      <p className="text-xs text-slate-400">Loading members…</p>
                    </div>
                  ) : assigneeList.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs text-slate-400">
                        No team members found for this project
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
                      {assigneeList.map((employee) => {
                        const checked = formData.assignees.includes(
                          employee._id,
                        );
                        return (
                          <label
                            key={employee._id}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                              checked
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={(ev) => {
                                setFormData({
                                  ...formData,
                                  assignees: ev.target.checked
                                    ? [...formData.assignees, employee._id]
                                    : formData.assignees.filter(
                                        (id) => id !== employee._id,
                                      ),
                                });
                              }}
                            />

                            {/* Avatar */}
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                checked
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {employee.name?.charAt(0)?.toUpperCase()}
                            </div>

                            {/* Name + email */}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs font-semibold truncate ${checked ? "text-white" : "text-slate-800"}`}
                              >
                                {employee.name}
                              </p>
                              <p
                                className={`text-[10px] truncate ${checked ? "text-white/60" : "text-slate-400"}`}
                              >
                                {employee.email}
                              </p>
                            </div>

                            {/* Check indicator */}
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                checked
                                  ? "bg-white border-white"
                                  : "border-slate-300"
                              }`}
                            >
                              {checked && (
                                <svg
                                  width="8"
                                  height="8"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#0f172a"
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected chips */}
              {formData.assignees.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formData.assignees.map((id) => {
                    const emp = assigneeList.find((e) => e._id === id);
                    if (!emp) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold">
                          {emp.name?.charAt(0)?.toUpperCase()}
                        </div>
                        {emp.name}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              assignees: formData.assignees.filter(
                                (x) => x !== id,
                              ),
                            })
                          }
                          className="text-slate-400 hover:text-red-500 transition ml-0.5 leading-none font-bold text-sm"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition shadow-sm hover:shadow-md disabled:opacity-60 active:scale-[0.98]"
              >
                {submitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icons.Check />
                )}
                {submitting ? "Creating…" : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      {!loading &&
        (baseTasks.length > 0 ||
          filterStatuses.length > 0 ||
          filterPriority !== "ALL" ||
          filterCreated !== "ALL" ||
          taskSearchInput ||
          showOverdueOnly) && (
          <div className="mb-2">
            <div className="flex flex-col lg:flex-row lg:items-center gap-2">
              {/* Search */}
              <div className="relative w-full lg:flex-1 min-w-0">
                <input
                  ref={searchInputRef}
                  autoFocus
                  placeholder="Search task, project, assignee..."
                  className="
      h-9 w-full rounded-xl border border-slate-200 bg-white
      pl-9 pr-9 text-[13px] text-slate-700
      placeholder:text-slate-400
      focus:outline-none focus:ring-2 focus:ring-slate-200
      focus:border-slate-300
      transition-all
    "
                  value={taskSearchInput}
                  onFocus={() => setShowTaskSearchSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowTaskSearchSuggestions(false), 150)
                  }
                  onChange={(e) => {
                    const value = e.target.value;

                    setTaskSearchInput(value);

                    setShowTaskSearchSuggestions(true);

                    if (value.trim().length >= 2) {
                      setSearchLoading(true);
                    }
                  }}
                />

                {/* Search Icon */}
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

                {/* Clear X Button */}
                {taskSearchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskSearchInput("");
                      setShowTaskSearchSuggestions(false);

                      if (searchInputRef?.current) {
                        searchInputRef.current.focus();
                      }
                    }}
                    className="
        absolute right-2 top-1/2
        flex h-5 w-5 -translate-y-1/2
        items-center justify-center
        rounded-full
        text-slate-400
        transition-all
        hover:bg-slate-100
        hover:text-slate-700
      "
                  >
                    <Icons.X />
                  </button>
                )}

                {/* Suggestions */}
                {showTaskSearchSuggestions &&
                  taskSearchSuggestions.length > 0 && (
                    <div
                      className="
          absolute left-0 right-0 top-10 z-30
          overflow-hidden rounded-lg
          border border-slate-200 bg-white
          shadow-md
        "
                    >
                      {taskSearchSuggestions.map((suggestedUser) => {
                        const label =
                          suggestedUser.name || suggestedUser.email || "";

                        return (
                          <button
                            key={suggestedUser._id || suggestedUser.email}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setTaskSearchInput(label);

                              setShowTaskSearchSuggestions(false);
                            }}
                            className="
                flex w-full items-center gap-2
                px-2.5 py-2 text-left
                transition hover:bg-slate-50
              "
                          >
                            {/* Avatar */}
                            <span
                              className="
                  flex h-6 w-6 shrink-0
                  items-center justify-center
                  rounded-full bg-indigo-600
                  text-[10px] font-bold text-white
                "
                            >
                              {label.charAt(0).toUpperCase()}
                            </span>

                            {/* Name */}
                            <span
                              className="
                  truncate text-[11px]
                  font-medium text-slate-700
                "
                            >
                              {suggestedUser.name || "Unnamed"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>

              {/* Status */}
              <MultiStatusFilter
                value={filterStatuses}
                onChange={setFilterStatuses}
              />

              {/* Priority */}
              <select
                className="
          h-9 rounded-xl border border-slate-200 bg-white
          px-3 text-[12px] font-medium text-slate-700
          focus:outline-none focus:ring-2 focus:ring-slate-200
          focus:border-slate-300
          transition-all
        "
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="ALL">All Priority</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              {/* Created date */}
              <select
                className="
          h-9 rounded-xl border border-slate-200 bg-white
          px-3 text-[12px] font-medium text-slate-700
          focus:outline-none focus:ring-2 focus:ring-slate-200
          focus:border-slate-300
          transition-all
        "
                value={filterCreated}
                onChange={(e) => setFilterCreated(e.target.value)}
                title="Filter by task created date"
              >
                <option value="ALL">All Created</option>
                <option value="TODAY">Created Today</option>
                <option value="LAST_7_DAYS">Last 7 Days</option>
                <option value="LAST_30_DAYS">Last 30 Days</option>
                <option value="THIS_MONTH">This Month</option>
              </select>

              {/* Overdue */}
              <button
                onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                className={`
          h-9 rounded-xl border px-3
          text-[12px] font-semibold
          transition-all
          flex items-center gap-1.5
          ${
            showOverdueOnly
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }
        `}
              >
                <span>Overdue</span>

                {counts.overdue > 0 && !showOverdueOnly && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                    {counts.overdue}
                  </span>
                )}
              </button>

              {/* Clear */}
              {(filterStatuses.length > 0 ||
                filterPriority !== "ALL" ||
                filterCreated !== "ALL" ||
                taskSearchInput ||
                showOverdueOnly) && (
                <button
                  onClick={() => {
                    setFilterStatuses([]);
                    setFilterPriority("ALL");
                    setFilterCreated("ALL");
                    setTaskSearchInput("");
                    setShowOverdueOnly(false);
                  }}
                  className="
            h-8 rounded-lg border border-slate-200
            bg-red-500 px-3
            text-[12px] font-bold text-white
            transition-all hover:bg-red-600
          "
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      {/* Overdue banner */}
      {/* {counts.overdue > 0 && ( */}
      {counts.overdue > 0 && !showOverdueOnly && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-red-700">
          <Icons.Alert />
          <span className="font-bold">{counts.overdue}</span>
          <span>
            task{counts.overdue > 1 ? "s are" : " is"} past due date and not yet
            completed.
          </span>
        </div>
      )}

      {/* Tasks table */}
      {loading || (searchLoading && baseTasks.length === 0) ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="animate-pulse">
            <div className="bg-slate-50 border-b border-slate-200">
              <table className="w-full table-fixed">
                <thead>
                  <tr>
                    <th className="w-[18%] px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Task
                    </th>
                    <th className="w-[14%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Project
                    </th>
                    <th className="w-[14%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Assignee
                    </th>
                    <th className="w-[10%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Priority
                    </th>
                    <th className="w-[10%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Created
                    </th>
                    <th className="w-[10%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Due
                    </th>
                    <th className="w-[14%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="w-[10%] px-2 py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
              </table>
            </div>

            <table className="w-full table-fixed">
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="cursor-default">
                    {/* TASK */}
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1 shrink-0 bg-slate-200" />
                        <div className="flex flex-col gap-1.5">
                          <div className="h-3.5 w-36 bg-slate-200 rounded-md" />
                          <div className="h-2.5 w-24 bg-slate-200 rounded-md" />
                        </div>
                      </div>
                    </td>

                    {/* PROJECT */}
                    <td className="px-2 py-2">
                      <div className="h-3 w-24 bg-slate-200 rounded-md" />
                      <div className="h-2.5 mt-1.5 w-16 bg-slate-200 rounded-md" />
                    </td>

                    {/* ASSIGNEE */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-200" />
                        <div className="flex flex-col gap-1.5">
                          <div className="h-3 w-24 bg-slate-200 rounded-md" />
                          <div className="h-2.5 w-16 bg-slate-200 rounded-md" />
                        </div>
                      </div>
                    </td>

                    {/* PRIORITY */}
                    <td className="px-2 py-2">
                      <div className="h-6 w-20 rounded-full bg-slate-200" />
                    </td>

                    {/* CREATED */}
                    <td className="px-2 py-2">
                      <div className="h-3 w-20 bg-slate-200 rounded-md" />
                    </td>

                    {/* DUE */}
                    <td className="px-2 py-2">
                      <div className="h-3 w-20 bg-slate-200 rounded-md" />
                      <div className="h-2.5 mt-1.5 w-14 bg-slate-200 rounded-md" />
                    </td>

                    {/* STATUS */}
                    <td className="px-2 py-2">
                      <div className="h-9 w-28 rounded-xl bg-slate-200" />
                    </td>

                    {/* ACTIONS */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-slate-200" />
                        <div className="w-7 h-7 rounded-md bg-slate-200" />
                        <div className="w-7 h-7 rounded-md bg-slate-200" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-white">
            <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
              <div className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
              {searchLoading || hasActiveTaskFilters
                ? "Filtering tasks..."
                : "Loading tasks..."}
            </div>
          </div>
        </div>
      ) : baseTasks.length === 0 && !hasActiveTaskFilters ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
            <Icons.Tasks />
          </div>

          <p className="text-sm font-semibold text-slate-700">No tasks yet</p>

          <p className="text-xs text-slate-400 mt-1 mb-4">
            Get started by creating your first task
          </p>

          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition"
          >
            <Icons.Plus />
            Create Task
          </button>
        </div>
      ) : filtered.length === 0 && !searchLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-600">
            No tasks match your filters
          </p>

          <button
            onClick={() => {
              setFilterStatuses([]);
              setFilterPriority("ALL");
              setFilterCreated("ALL");
              setTaskSearchInput("");
            }}
            className="mt-2 text-xs text-slate-400 hover:text-slate-700 transition"
          >
            Clear filters
          </button>
        </div>
      ) : (
        // <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {searchLoading && (
            // <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />

                <span className="text-xs font-semibold text-slate-700">
                  Searching tasks...
                </span>
              </div>
            </div>
          )}

          <table className="w-full table-fixed">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="w-[18%] px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Task
                </th>
                <th className="w-[14%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Project
                </th>
                <th className="w-[14%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Assignee
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Priority
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Created
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Due
                </th>
                <th className="w-[14%] px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="w-[10%] px-2 py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtered.map((task) => {
                const isOverdue = (() => {
                  if (!task.dueDate) return false;
                  const dueDay = toDay(task.dueDate);
                  return (
                    dueDay < today &&
                    task.status !== "DONE" &&
                    task.status !== "IN_PROGRESS"
                  );
                })();
                return (
                  <tr
                    key={task._id}
                    onClick={() => handleViewTask(task)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    {/* TASK */}
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                            task.status === "DONE"
                              ? "bg-emerald-500"
                              : task.status === "IN_PROGRESS"
                                ? "bg-indigo-600"
                                : task.status === "QA_TESTING"
                                  ? "bg-purple-500"
                                  : "bg-slate-300"
                          }`}
                        />
                        <p className="text-[12px] font-medium text-slate-900 leading-4 break-words">
                          {task.title}
                        </p>
                      </div>
                    </td>

                    {/* PROJECT */}
                    <td className="px-2 py-2">
                      <p className="text-[10px] font-semibold text-slate-600 truncate">
                        {getProjectName(task.projectId || task.project)}
                      </p>
                    </td>

                    {/* ASSIGNEE */}
                    <td className="px-2 py-2">
                      {task.assignees?.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-semibold text-slate-700 shrink-0">
                            {getAssigneeName(task.assignees[0])
                              ?.charAt(0)
                              ?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] text-slate-700 truncate">
                              {getAssigneeName(task.assignees[0])}
                            </p>
                            {task.assignees.length > 1 && (
                              <p className="text-[9px] text-slate-400 font-medium">
                                +{task.assignees.length - 1}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* PRIORITY */}
                    <td className="px-2 py-2 text-[10px] whitespace-nowrap">
                      <Badge
                        label={task.priority}
                        variant={getPriorityVariant(task.priority)}
                      />
                    </td>

                    {/* CREATED */}
                    <td className="px-2 py-2 text-[10px] text-slate-500 whitespace-nowrap">
                      {task.createdAt
                        ? new Date(task.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "-"}
                    </td>

                    {/* DUE */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <p
                        className={`text-[10px] ${
                          isOverdue
                            ? "text-red-600 font-semibold"
                            : "text-slate-600"
                        }`}
                      >
                        {new Date(task.dueDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      {isOverdue && (
                        <p className="text-[9px] text-red-400">Overdue </p>
                      )}
                    </td>

                    {/* STATUS */}
                    <td
                      className="px-2 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="scale-[0.9] origin-left">
                        <StatusSelect
                          value={task.status}
                          onChange={(value) =>
                            handleStatusChange(task._id, value, task)
                          }
                          task={task}
                          user={user}
                        />
                      </div>
                      {task.status === "DONE" &&
                        ["ADMIN", "PM"].includes(task.createdBy?.role) &&
                        task.closedBy?.name && (
                          <p className="mt-0.5 text-[9px] text-slate-400">
                            Task done by {task.closedBy.name}
                          </p>
                        )}
                    </td>

                    {/* ACTIONS */}
                    <td
                      className="px-2 py-2 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewTask(task)}
                          className="p-1 text-slate-500 hover:bg-slate-100 rounded-md transition"
                        >
                          <Icons.Eye />
                        </button>

                        {["ADMIN", "PM"].includes(user?.role || "") && (
                          <>
                            <button
                              onClick={() => handleEditTask(task)}
                              className="p-1 text-blue-500 hover:bg-blue-50 rounded-md transition"
                            >
                              <Icons.Edit />
                            </button>
                            <button
                              onClick={() => handleDelete(task._id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-md transition"
                            >
                              <Icons.Trash />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
              <p className="text-[11px] font-medium text-slate-500">
                Showing{" "}
                <span className="font-semibold text-slate-700">{(page - 1) * limit + 1}</span>–
                <span className="font-semibold text-slate-700">{Math.min(page * limit, totalTasks)}</span> of{" "}
                <span className="font-semibold text-slate-700">{totalTasks}</span> tasks
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1 || loadingMore}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <Icons.Back />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
                  .reduce((acc, n) => {
                    const prev = acc[acc.length - 1];
                    if (prev !== undefined && n - prev > 1) acc.push("…");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-[11px] text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => goToPage(n)}
                        disabled={loadingMore}
                        className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed ${
                          n === page
                            ? "bg-indigo-600 text-white shadow-sm shadow-blue-200"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    ),
                  )}
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page === pages || loadingMore}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <Icons.Arrow />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <TaskViewModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        selectedTask={selectedTask || taskDetails}
        projects={projects}
        employees={employees}
        comments={comments}
        onAddComment={handleAddComment}
        newComment={newComment}
        onNewCommentChange={(val) => setNewComment(val)}
        isLoading={taskLoading || commentLoading}
        getProjectName={getProjectName}
        getAssigneeName={getAssigneeName}
        getAssigneesPreview={getAssigneesPreview}
      />
      {/* Edit Modal */}
      {showEditModal && selectedTask && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            // className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200"

            className="
    bg-white rounded-2xl
    w-full max-w-4xl
    h-[92vh]
    shadow-2xl border border-slate-200
    flex flex-col overflow-hidden
  "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Edit Task
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Update task details and assign team members
                  </p>
                </div>

                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                >
                  <Icons.X />
                </button>
              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={handleUpdateTask}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              <div className="grid md:grid-cols-2 gap-4">
                {/* Title */}
                <Field label="Task Title" required>
                  <input
                    className={inputCls}
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        title: e.target.value,
                      })
                    }
                    required
                  />
                </Field>

                {/* Description */}
                <Field label="Description">
                  <textarea
                    className={inputCls}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                  />
                </Field>

                {/* Project */}
                <Field label="Project" required>
                  <select
                    className={inputCls}
                    value={formData.projectId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        projectId: e.target.value,
                        assignees: [],
                      })
                    }
                    required
                  >
                    <option value="">Select project</option>

                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Priority */}
                <Field label="Priority">
                  <select
                    className={inputCls}
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value,
                      })
                    }
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </Field>

                {/* Start Date */}
                {/* <Field label="Start Date">
                  <input
                    type="date"
                    className={inputCls}
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startDate: e.target.value,
                      })
                    }
                  />
                  {startDateError && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {startDateError}
                    </p>
                  )}
                </Field> */}

                {/* Due Date */}
                <Field label="Due Date" required>
                  <input
                    type="date"
                    className={inputCls}
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dueDate: e.target.value,
                      })
                    }
                    required
                  />
                  {dueDateError && (
                    <p className="mt-1 text-[11px] text-red-500">
                      {dueDateError}
                    </p>
                  )}
                </Field>

                {/* Status */}
                <Field label="Status">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      {/* <span className="text-sm font-semibold text-slate-700">
                        Task Status
                      </span> */}

                      <span
                        className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${
                          formData.status === "DONE"
                            ? "bg-emerald-50 text-emerald-700"
                            : formData.status === "IN_PROGRESS"
                              ? "bg-blue-50 text-blue-700"
                              : formData.status === "QA_TESTING"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formData.status === "TODO" && "To Do"}
                        {formData.status === "IN_PROGRESS" && "In Progress"}
                        {formData.status === "ON_HOLD" && "On Hold"}
                        {formData.status === "QA_TESTING" && "QA Testing"}
                        {formData.status === "DONE" && "Completed"}
                      </span>
                    </div>

                    <StatusSelect
                      value={formData.status}
                      onChange={(val) =>
                        setFormData({
                          ...formData,
                          status: val,
                        })
                      }
                      task={selectedTask}
                      user={user}
                    />
                  </div>
                </Field>
              </div>

              {/* Assignees */}
              <div>
                {/* Header */}
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    Assign Employees
                  </label>

                  <span
                    className={`
        rounded-full px-2 py-1 text-[10px] font-bold
        ${
          formData.assignees.length > 0
            ? "bg-indigo-600 text-white"
            : "bg-slate-100 text-slate-500"
        }
      `}
                  >
                    {formData.assignees.length} Selected
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {/* Top Bar */}
                  <div className="border-b border-slate-100 bg-slate-50 p-3">
                    {/* Search */}
                    <div className="relative">
                      {/* Search Icon */}
                      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>
                        {searchLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-800 animate-spin" />
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Search employee..."
                        value={employeeSearch}
                        onFocus={() => setShowEmployeeList(true)}
                        onBlur={() => {
                          setTimeout(() => {
                            if (!employeeSearch.trim()) {
                              setShowEmployeeList(false);
                            }
                          }, 150);
                        }}
                        onChange={(e) => {
                          setEmployeeSearch(e.target.value);

                          if (e.target.value.trim()) {
                            setShowEmployeeList(true);
                          }
                        }}
                        className="
            h-8 w-full rounded-xl border border-slate-200
            bg-white pl-7 pr-1 text-[12px]
            text-slate-700 placeholder:text-slate-400
            focus:outline-none focus:ring-2
            focus:ring-slate-900/10
            transition-all
          "
                      />
                    </div>

                    {/* Select All */}
                    {showEmployeeList && filteredEmployees.length > 0 && (
                      <div className="mt-3 flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={
                              filteredEmployees.length > 0 &&
                              filteredEmployees.every((emp) =>
                                formData.assignees.includes(emp._id),
                              )
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  assignees: [
                                    ...new Set([
                                      ...formData.assignees,
                                      ...filteredEmployees.map(
                                        (emp) => emp._id,
                                      ),
                                    ]),
                                  ],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  assignees: formData.assignees.filter(
                                    (id) =>
                                      !filteredEmployees.some(
                                        (emp) => emp._id === id,
                                      ),
                                  ),
                                });
                              }
                            }}
                            className="h-3.5 w-3.5 rounded"
                          />
                          Select All
                        </label>

                        <span className="text-[10px] text-slate-400">
                          {filteredEmployees.length} Employees
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Employee List */}
                  {showEmployeeList && (
                    <div className="max-h-64 overflow-y-auto p-2">
                      {!formData.projectId ? (
                        <div className="py-6 text-center text-[11px] text-slate-400">
                          Select project first
                        </div>
                      ) : employeesLoading ? (
                        <div className="flex items-center justify-center gap-2 py-6">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />

                          <span className="text-[11px] text-slate-500">
                            Loading employees...
                          </span>
                        </div>
                      ) : filteredEmployees.length > 0 ? (
                        <div className="space-y-1.5">
                          {filteredEmployees.map((emp) => {
                            const checked = formData.assignees.includes(
                              emp._id,
                            );

                            return (
                              <label
                                key={emp._id}
                                className={`
                    flex cursor-pointer items-center gap-3
                    rounded-xl border px-3 py-2.5
                    transition-all
                    ${
                      checked
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }
                  `}
                              >
                                {/* Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({
                                        ...formData,
                                        assignees: [
                                          ...formData.assignees,
                                          emp._id,
                                        ],
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        assignees: formData.assignees.filter(
                                          (id) => id !== emp._id,
                                        ),
                                      });
                                    }
                                  }}
                                  className="h-3.5 w-3.5 rounded"
                                />

                                {/* Avatar */}
                                <div
                                  className={`
                      flex h-8 w-8 shrink-0 items-center justify-center
                      rounded-full text-[11px] font-bold
                      ${
                        checked
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700"
                      }
                    `}
                                >
                                  {emp.name?.charAt(0)?.toUpperCase()}
                                </div>

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`
                        truncate text-[12px] font-semibold
                        ${checked ? "text-white" : "text-slate-800"}
                      `}
                                  >
                                    {emp.name}
                                  </p>

                                  <p
                                    className={`
                        truncate text-[10px]
                        ${checked ? "text-white/60" : "text-slate-400"}
                      `}
                                  >
                                    {emp.email}
                                  </p>
                                </div>

                                {/* Check */}
                                <div
                                  className={`
                      flex h-4 w-4 items-center justify-center
                      rounded-full border
                      ${checked ? "border-white bg-white" : "border-slate-300"}
                    `}
                                >
                                  {checked && (
                                    <svg
                                      width="8"
                                      height="8"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="#0f172a"
                                      strokeWidth="4"
                                    >
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-[11px] text-slate-400">
                          No employees found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Employees */}
                {formData.assignees.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {formData.assignees.map((id) => {
                      const emp = projectEmployees.find((e) => e._id === id);

                      if (!emp) return null;

                      return (
                        <div
                          key={id}
                          className="
              flex items-center gap-1.5 rounded-full
              border border-slate-200 bg-slate-100
              px-2.5 py-1 text-[11px]
              font-medium text-slate-700
            "
                        >
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                            {emp.name?.charAt(0)?.toUpperCase()}
                          </div>

                          <span>{emp.name}</span>

                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                assignees: formData.assignees.filter(
                                  (a) => a !== id,
                                ),
                              })
                            }
                            className="
                text-slate-400 transition
                hover:text-red-500
              "
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={editing}
                  className="min-w-[150px] px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {editing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icons.Check />
                  )}

                  {editing ? "Updating..." : "Update Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportTasksModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        projects={projects}
        onImportSuccess={(importedTasks) => {
          setTasks((prev) => [...importedTasks, ...prev]);
          setHasNewTaskData(false);
        }}
      />
      {/* QA Assign Model  */}
      <QaAssignModal
        isOpen={showQaAssignModal}
        onClose={() => {
          setShowQaAssignModal(false);
          setQaAssignTask(null);
        }}
        task={qaAssignTask}
        onAssigned={(updatedTask) => {
          setTasks((prev) =>
            prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)),
          );

          setGlobalSearchResults((prev) =>
            prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)),
          );

          setShowQaAssignModal(false);
          setQaAssignTask(null);

          toast.success("Task moved to QA Testing");
        }}
      />
    </div>
  );
}
