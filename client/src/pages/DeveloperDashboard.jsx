import { useState, useEffect, useMemo } from "react";
import { isTaskOverdue } from "../utils/taskDates";
import { getTask, addTaskComment } from "../services/api";
import TaskViewModal from "../components/TaskViewModal";
import CreateTaskModal from "../components/CreateTaskModal";
import NotificationBell from "../components/NotificationBell";
import { API, DATA_MUTATED_EVENT } from "../services/api";
import { useAuth } from "../context/AuthContext";
import SprintPage from "./SprintPage";
import ProjectsPage from "./ProjectPage";
import ReportsPage from "./ReportsPage";

import { toast } from "sonner";
import RoleSettingsView from "../components/RoleAccess/RoleSettingsView";
import {
  getRoleKeyFromUser,
  ROLE_SETTINGS_CONFIG,
} from "../data/roleSettingsConfig";
import Icons from "../components/Icons";
import QaAssignModal from "../components/QaAssignModal";
import KeepAliveTab from "../components/KeepAliveTab";
import RoleGuideFaq from "./RoleGuideFaq";
import useAdminSidebarTabCounts from "../hooks/useAdminSidebarTabCounts";
import { adminNotificationAPI } from "../services/adminNotificationApi";
import TrackerSidebar from "../components/TrackerSidebar";

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const r = 36,
    cx = 44,
    cy = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="donut-chart__track"
          stroke="currentColor"
          strokeWidth="10"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#00a21d"
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />

        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          className="donut-chart__value"
          fill="currentColor"
        >
          {pct}%
        </text>
      </svg>
      <div>
        <p className="text-xs text-slate-500 mb-1">Completion</p>
        <p className="text-sm font-semibold text-slate-800">
          {completed} / {total} done
        </p>
      </div>
    </div>
  );
}

function TaskStatusPie({ metrics }) {
  const other = metrics.qaTesting + metrics.onHold + metrics.todo;
  const segments = [
    { label: "Completed", value: metrics.done, color: "url(#taskDonutPrimary)", legendColor: "linear-gradient(135deg,#1d4ed8,#3b82f6)" },
    { label: "In Progress", value: metrics.inProgress, color: "#60a5fa", legendColor: "#60a5fa" },
    { label: "Other", value: other, color: "#e2e8f0", legendColor: "#e2e8f0" },
  ];
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = 80,
    cx = 110,
    cy = 110,
    circ = 2 * Math.PI * r,
    gap = 3; // degrees of visual gap between segments
  const [hovered, setHovered] = useState(null);

  const arcs = segments.reduce((acc, s) => {
    const cursor = acc.length ? acc[acc.length - 1].cursor : 0;
    const pct = total > 0 ? s.value / total : 0;
    const length = Math.max(pct * circ - gap, 0);
    acc.push({ ...s, pct: Math.round(pct * 100), dasharray: `${length} ${circ - length}`, dashoffset: circ - cursor, cursor: cursor + pct * circ });
    return acc;
  }, []);

  const footerStats = [
    { label: "Total Tasks", value: metrics.total, cls: "bg-blue-50 text-blue-600", Icon: Icons.Tasks },
    { label: "Completed", value: metrics.done, cls: "bg-blue-50 text-blue-700", Icon: Icons.CheckCircle },
    { label: "In Progress", value: metrics.inProgress, cls: "bg-sky-50 text-sky-600", Icon: Icons.Clock },
    { label: "Overdue", value: metrics.overdue, cls: "bg-red-50 text-red-600", Icon: Icons.Alert },
  ];

  return (
    <div>
      <div className="flex flex-col items-center gap-4">
        <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 220 220">
            <defs>
              <linearGradient id="taskDonutPrimary" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eff6ff" strokeWidth="24" />
            {arcs.map((a, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth="24"
                strokeDasharray={a.dasharray}
                strokeDashoffset={a.dashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{
                  transition: "stroke-dasharray 0.6s ease, opacity 0.15s ease",
                  cursor: "pointer",
                  opacity: hovered && hovered.label !== a.label ? 0.35 : 1,
                }}
                onMouseEnter={() => setHovered(a)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hovered ? (
              <>
                <span className="text-2xl font-bold text-slate-800 tabular-nums">{hovered.value}</span>
                <span className="mt-1 max-w-[120px] truncate text-xs font-semibold text-slate-500">{hovered.label}</span>
                <span className="text-xs font-semibold text-slate-400">{hovered.pct}%</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-slate-800 tabular-nums">{metrics.rate}%</span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Completion</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {arcs.map((a, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 cursor-pointer"
              onMouseEnter={() => setHovered(a)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.legendColor }} />
              <span className="text-sm font-semibold text-slate-700">{a.label} ({a.value})</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
        {footerStats.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.cls}`}>
              <s.Icon />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-slate-400">{s.label}</p>
              <p className="text-base font-extrabold leading-none text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ── Mini corner sparkline for a stat card — bars read better than a line
// when a week's data is mostly flat/sparse (a flat line looks like a stray
// dash; flat bars still read as "a little chart").
function MiniSparkline({ values, color, width = 64, height = 28 }) {
  if (!values?.length) return <div style={{ width, height }} className="shrink-0" />;
  const max = Math.max(...values, 1);
  const barW = width / values.length;
  const gap = barW * 0.28;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      {values.map((v, i) => {
        const h = Math.max((v / max) * (height - 4), 2); // floor so zero-days still show a nub
        const x = i * barW + gap / 2;
        const w = barW - gap;
        return (
          <rect
            key={i}
            x={x}
            y={height - h}
            width={w}
            height={h}
            rx={Math.min(w / 2, 1.5)}
            fill={color}
            opacity={v > 0 ? 1 : 0.25}
          />
        );
      })}
    </svg>
  );
}

// ── Mini Progress Bar ─────────────────────────────────────────────────────────
function ProgressBar({ value, color = "#0f172a" }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function Badge({ label, variant }) {
  const styles = {
    done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    progress: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    todo: "bg-slate-50 text-slate-600 border border-slate-200",
    qa: "bg-violet-50 text-violet-700 border border-violet-200",
    hold: "bg-amber-50 text-amber-700 border border-amber-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-[#F8FAFC] text-[#475569] border border-[#CBD5E1]",
    low: "bg-green-50 text-green-700 border border-green-200",
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    planning: "bg-violet-50 text-violet-700 border border-violet-200",
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

function getStatusVariant(s) {
  if (!s) return "default";
  const m = {
    DONE: "done",
    IN_PROGRESS: "progress",
    TODO: "todo",
    QA_TESTING: "qa",
    ON_HOLD: "hold",
    Active: "active",
    Planning: "planning",
  };
  return m[s] || "default";
}
function getPriorityVariant(p) {
  const m = { High: "high", Medium: "medium", Low: "low" };
  return m[p] || "default";
}

// ══════════════════════════════════════════════════════════════════════════════
export default function DeveloperDashboard() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [userProjects, setUserProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardTasksLoading, setDashboardTasksLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  // View modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [updatingTask, setUpdatingTask] = useState(null);
  const [taskSearch, setTaskSearch] = useState("");
  const [sprints, setSprints] = useState([]);
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalSearchFocused, setGlobalSearchFocused] = useState(false);
  const [pageSearchRequest, setPageSearchRequest] = useState(null);
  const { tabCounts, fetchTabCounts, setTabCounts } = useAdminSidebarTabCounts({});

  useEffect(() => {
    if (!["projects", "tasks", "sprints"].includes(activeTab)) return;
    if ((tabCounts[activeTab] || 0) === 0) return;
    setTabCounts((current) => ({ ...current, [activeTab]: 0 }));
    adminNotificationAPI.markAdminTabRead({ tab: activeTab }).catch((error) => {
      console.error("Failed to clear Developer notification dot", error);
      fetchTabCounts();
    });
  }, [activeTab, fetchTabCounts, setTabCounts, tabCounts]);

  // keep eslint happy for legacy code paths
  void updatingTask;
  const [filterTaskStatus, setFilterTaskStatus] = useState("ALL");

  const [filterPriority, setFilterPriority] = useState("ALL");

  // Pagination for tasks
  const [taskPageSize, setTaskPageSize] = useState(10);
  const [taskPage, setTaskPage] = useState(1);

  // QA assign modal
  const [showQaAssignModal, setShowQaAssignModal] = useState(false);
  const [qaAssignTask, setQaAssignTask] = useState(null);

  // StatusSelect component for Developer
  const StatusSelect = ({ value, onChange, task }) => {
    const isUpdating = updatingTask === task?._id;

    // For self-created tasks, allow all statuses
    const isSelfCreated =
      task?.createdBy?._id === user?._id || task?.createdBy === user?._id;

    const isDone = value === "DONE";
    const options = isSelfCreated
      ? ["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING", "DONE"]
      : isDone
        ? ["DONE"]
        : ["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING"];
    const isDisabled = (!isSelfCreated && isDone) || isUpdating;

    return (
      // <div className="relative w-full min-w-[120px]">
      <div className="relative w-[180px]">
        {/* Status Dot */}
        <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
          <div
            className={`h-2.5 w-2.5 gap-3 rounded-full ${
              value === "DONE"
                ? "bg-emerald-500"
                : value === "IN_PROGRESS"
                  ? "bg-indigo-600"
                  : value === "ON_HOLD"
                    ? "bg-amber-500"
                    : value === "QA_TESTING"
                      ? "bg-purple-500"
                      : "bg-slate-400"
            }`}
          />
        </div>

        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          className={`
      h-8 w-full appearance-none rounded-xl border
      pl-6 pr-7 text-[11px] font-semibold
      transition-all focus:outline-none
      focus:ring-2 focus:ring-slate-200
      ${isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}

      ${
        value === "DONE"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : value === "IN_PROGRESS"
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : value === "ON_HOLD"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : value === "QA_TESTING"
                ? "border-purple-200 bg-purple-50 text-purple-700"
                : "border-slate-200 bg-slate-50 text-slate-600"
      }
    `}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "IN_PROGRESS"
                ? "In Progress"
                : opt === "ON_HOLD"
                  ? "On Hold"
                  : opt === "QA_TESTING"
                    ? "QA Testing"
                    : opt === "TODO"
                      ? "Todo"
                      : opt}
            </option>
          ))}
        </select>

        {/* Chevron */}
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    );
  };

  const refreshMyTasks = async () => {
    try {
      setTasksLoading(true);
      const tasksRes = await API.get("/tasks");
      const allTasks = tasksRes.data?.data || tasksRes.data || [];

      const employeeTasks = allTasks.filter((task) => {
        const assigneeIds =
          task.assignees?.map((a) => (typeof a === "object" ? a._id : a)) || [];

        const createdById =
          typeof task.createdBy === "object"
            ? task.createdBy?._id
            : task.createdBy;

        return assigneeIds.includes(user?._id) || createdById === user?._id;
      });

      setTasks(employeeTasks);
    } catch (err) {
      console.error("Failed to refresh tasks:", err);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus, task) => {
    // If moving to QA_TESTING, require QA assignment flow
    if (newStatus === "QA_TESTING") {
      setQaAssignTask(task);
      setShowQaAssignModal(true);
      return;
    }

    const oldStatus = task.status;

    try {
      // Update UI immediately for smooth experience
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
      );
      setUpdatingTask(taskId);

      // Send update to server (suppress global mutation event - we already updated UI optimistically)
      await API.patch(
        `/tasks/${taskId}/status`,
        { status: newStatus },
        { suppressNotify: true },
      );

      // No full refresh needed; the task list is already updated optimistically.
    } catch (err) {
      console.error("Status update failed:", err);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: oldStatus } : t)),
      );
      alert("Failed to update status");
    } finally {
      setUpdatingTask(null);
    }
  };

  // Task view functions
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

  const handleAddComment = async () => {
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

  const getProjectName = (p) => {
    if (typeof p === "object" && p?.name) return p.name;
    return projects.find((pr) => pr._id === p)?.name || "—";
  };

  const getAssigneeName = (a) => {
    if (typeof a === "object" && a?.name) return a.name;
    // Since it's developer dashboard, assignee is usually self
    return user?.name || "You";
  };

  useEffect(() => {
    window.history.replaceState(null, "", window.location.href);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setDashboardTasksLoading(true);

        await Promise.allSettled([
          API.get("/projects")
            .then((res) => {
              const allProjects = res.data || [];
              setProjects(allProjects);
              setUserProjects(
                allProjects.filter((project) =>
                  project.teamMembers?.some(
                    (member) =>
                      (typeof member === "object" ? member._id : member) ===
                      user?._id,
                  ),
                ),
              );
            })
            .catch(() => {
              setProjects([]);
              setUserProjects([]);
            }),
          API.get("/sprints")
            .then((res) => {
              const data = res.data?.data || res.data || [];
              setSprints(Array.isArray(data) ? data : []);
            })
            .catch(() => setSprints([])),
          API.get("/tasks")
            .then((res) => {
              const allTasks = res.data?.data || res.data || [];
              setTasks(
                allTasks.filter((task) => {
                  const assigneeIds =
                    task.assignees?.map((a) =>
                      typeof a === "object" ? a._id : a,
                    ) || [];
                  const createdById =
                    typeof task.createdBy === "object"
                      ? task.createdBy?._id
                      : task.createdBy;
                  return (
                    assigneeIds.includes(user?._id) || createdById === user?._id
                  );
                }),
              );
            })
            .catch(() => setTasks([]))
            .finally(() => setDashboardTasksLoading(false)),
        ]);
      } catch (err) {
        console.error("❌ Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?._id]);

  useEffect(() => {
    const handleDataMutation = (event) => {
      const currentUserId = user?._id || user?.id;
      const performedBy = event?.detail?.performedBy;
      const isOwnSocketUpdate =
        event?.detail?.source === "socket" &&
        currentUserId &&
        performedBy &&
        String(currentUserId) === String(performedBy);

      // Own task updates are already applied optimistically to the changed row.
      if (isOwnSocketUpdate) return;
      refreshMyTasks();
    };

    window.addEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    return () =>
      window.removeEventListener(DATA_MUTATED_EVENT, handleDataMutation);
  }, [user?._id, user?.id]);

  // Reset pagination when filters, search, or page size changes
  useEffect(() => {
    setTaskPage(1);
  }, [taskSearch, filterTaskStatus, filterPriority, taskPageSize]);

  const handleLogout = () => {
    toast.success("Logged out successfully");
    logout();
  };

  const toDay = (d) => {
    const x = new Date(d);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  };

  const today = toDay(new Date());
  const metrics = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "DONE").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    qaTesting: tasks.filter((t) => t.status === "QA_TESTING").length,
    onHold: tasks.filter((t) => t.status === "ON_HOLD").length,
    todo: tasks.filter((t) => t.status === "TODO").length,
    overdue: tasks.filter((t) => {
      if (!t.dueDate) return false;
      const dueDay = toDay(t.dueDate);
      return dueDay < today && t.status !== "DONE";
    }).length,
    rate:
      tasks.length > 0
        ? Math.round(
            (tasks.filter((t) => t.status === "DONE").length / tasks.length) *
              100,
          )
        : 0,
  };

  // How many of your tasks were touched (created or updated) on each day of
  // the current week, broken out per status — feeds each stat card's corner
  // sparkline (the "total" series backs the Total Tasks card specifically).
  const taskTrendByStatus = useMemo(() => {
    const day = today.getDay();
    const weekStart = toDay(today);
    weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
    const bucket = (predicate) => {
      const counts = Array(7).fill(0);
      tasks.forEach((t) => {
        if (!predicate(t)) return;
        const ts = t.updatedAt || t.createdAt;
        if (!ts) return;
        const diffDays = Math.floor((toDay(ts) - weekStart) / 86400000);
        if (diffDays >= 0 && diffDays < 7) counts[diffDays] += 1;
      });
      return counts;
    };
    return {
      total: bucket(() => true),
      done: bucket((t) => t.status === "DONE"),
      inProgress: bucket((t) => t.status === "IN_PROGRESS"),
      onHold: bucket((t) => t.status === "ON_HOLD"),
      qaTesting: bucket((t) => t.status === "QA_TESTING"),
      overdue: bucket((t) => isTaskOverdue(t)),
    };
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "DONE"), [tasks]);

  // "My Tasks" tab: search/status/priority filtering + page-based pagination,
  // computed once and shared by the table and the pagination bar below it.
  const filteredMyTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return tasks.filter((task) => {
      if (q) {
        const title = task.title?.toLowerCase() || "";
        const project = getProjectName(task.projectId)?.toLowerCase() || "";
        const description = task.description?.toLowerCase() || "";
        if (!title.includes(q) && !project.includes(q) && !description.includes(q)) return false;
      }
      if (filterTaskStatus !== "ALL" && task.status !== filterTaskStatus) return false;
      if (filterPriority !== "ALL" && task.priority !== filterPriority) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, taskSearch, filterTaskStatus, filterPriority]);

  const myTasksPageCount = Math.max(1, Math.ceil(filteredMyTasks.length / taskPageSize));
  const paginatedMyTasks = filteredMyTasks.slice((taskPage - 1) * taskPageSize, taskPage * taskPageSize);

  const globalSearchResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    const matches = (values) =>
      values.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );
    const startsWithQuery = (value) =>
      String(value || "")
        .toLowerCase()
        .startsWith(query);

    const projectResults = projects
      .filter((item) => matches([item.name, item.description]))
      .map((item) => ({
        key: "project-" + item._id,
        type: "project",
        tab: "projects",
        title: item.name || "Unnamed project",
        subtitle: [item.status, item.priority].filter(Boolean).join(" · "),
        priority: startsWithQuery(item.name) ? 0 : 1,
      }));

    const sprintResults = sprints
      .filter((item) => matches([item.name, item.goal, item.projectId?.name]))
      .map((item) => ({
        key: "sprint-" + item._id,
        type: "sprint",
        tab: "sprints",
        title: item.name || "Unnamed sprint",
        subtitle: [item.projectId?.name, item.status]
          .filter(Boolean)
          .join(" · "),
        priority: startsWithQuery(item.name) ? 0 : 1,
      }));

    const taskResults = tasks
      .filter((item) =>
        matches([
          item.title,
          item.description,
          item.projectId?.name,
          item.status,
          item.priority,
        ]),
      )
      .map((item) => ({
        key: "task-" + item._id,
        type: "task",
        tab: "tasks",
        title: item.title || "Untitled task",
        subtitle: [item.projectId?.name, item.status]
          .filter(Boolean)
          .join(" · "),
        priority: startsWithQuery(item.title) ? 0 : 1,
      }));

    return [...projectResults, ...sprintResults, ...taskResults]
      .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title))
      .slice(0, 12);
  }, [globalQuery, projects, sprints, tasks]);

  const openGlobalSearchResult = (result) => {
    if (result.type === "task") {
      setTaskSearch(result.title);
      setFilterTaskStatus("ALL");
      setFilterPriority("ALL");
      setTaskPage(1);
      setShowViewModal(false);
      setSelectedTask(null);
    } else {
      setPageSearchRequest({
        type: result.type,
        query: result.title,
        requestId: Date.now(),
      });
    }
    setGlobalQuery(result.title);
    setGlobalSearchFocused(false);
    setActiveTab(result.tab);
  };

  const clearGlobalSearch = () => {
    setGlobalQuery("");
    if (pageSearchRequest?.type) {
      setPageSearchRequest({
        ...pageSearchRequest,
        query: "",
        requestId: Date.now(),
      });
    }
    setTaskSearch("");
  };
  const navItems = [
    { id: "dashboard", label: "Dashboard", Ic: Icons.Dashboard },
    { id: "projects", label: "My Projects", Ic: Icons.Projects },

    { id: "tasks", label: "My Tasks", Ic: Icons.Tasks },
    { id: "sprints", label: "Sprints", Ic: Icons.Sprints },
    { id: "reports", label: "Reports", Ic: Icons.Reports },

    // Same Guide & FAQ component used by Admin; role-based via getRoleKeyFromUser
    { id: "guideFaq", label: "Guide & FAQ", Ic: Icons.Help, tag: "NEW" },

    { id: "settings", label: "Settings", Ic: Icons.Settings },
  ].map((item) => ({ ...item, dot: tabCounts[item.id] > 0 }));

  return (
    <div
      style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}
      className="flex min-h-screen bg-slate-50"
    >
      <TrackerSidebar navItems={navItems} activeId={activeTab} onSelect={setActiveTab} onLogout={handleLogout} />

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-base font-bold text-slate-800">
              {activeTab === "dashboard" && "Overview"}
              {activeTab === "projects" && "My Projects"}
              {activeTab === "sprints" && "Sprints"}
              {activeTab === "tasks" && "My Tasks"}
              {activeTab === "reports" && "Reports"}
              {activeTab === "guideFaq" && "Guide & FAQ"}
              {activeTab === "settings" && "Settings"}
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="relative mx-6 flex-1 max-w-xl">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icons.Search />
            </span>
            <input
              type="search"
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              onFocus={() => setGlobalSearchFocused(true)}
              onBlur={() =>
                setTimeout(() => setGlobalSearchFocused(false), 150)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && globalSearchResults[0]) {
                  event.preventDefault();
                  openGlobalSearchResult(globalSearchResults[0]);
                }
                if (event.key === "Escape") setGlobalSearchFocused(false);
              }}
              placeholder="Search projects, sprints, tasks..."
              aria-label="Search projects, sprints, and tasks"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
            {globalQuery && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearGlobalSearch}
                aria-label="Clear global search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <Icons.X />
              </button>
            )}

            {globalSearchFocused && globalQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-12 z-50 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                {globalSearchResults.length > 0 ? (
                  <>
                    <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Search results
                    </div>
                    {globalSearchResults.map((result) => (
                      <button
                        key={result.key}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => openGlobalSearchResult(result)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          {result.type === "project" && <Icons.Projects />}
                          {result.type === "sprint" && <Icons.Sprints />}
                          {result.type === "task" && <Icons.Tasks />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-slate-800">
                            {result.title}
                          </span>
                          <span className="block truncate text-[11px] text-slate-400">
                            {result.subtitle || "Open " + result.tab}
                          </span>
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                          {result.type}
                        </span>
                      </button>
                    ))}
                    <p className="border-t border-slate-100 px-3 pb-1 pt-2 text-[10px] text-slate-400">
                      Press Enter to open the first result
                    </p>
                  </>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      No matching records
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Try a project, sprint, or task name.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <NotificationBell />
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5">
              <Icons.User />
              <span className="font-medium text-slate-700">{user?.name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-600 font-semibold">
                {user?.role}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {/* ── DASHBOARD ──────────────────────────────────────────────── */}
          {activeTab === "dashboard" && (
            <div className="space-y-4 w-full">
              {/* Task stat cards */}
              {dashboardTasksLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-8 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
                  Loading tasks...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    {
                      label: "Total Tasks",
                      value: metrics.total,
                      sub: "All assigned tasks",
                      icon: "Tasks",
                      bg: "bg-indigo-50",
                      fg: "text-indigo-600",
                      spark: "#A5B4FC",
                      trend: taskTrendByStatus.total,
                    },
                    {
                      label: "Completed",
                      value: metrics.done,
                      sub: `${metrics.rate}% done`,
                      icon: "Check",
                      bg: "bg-indigo-50",
                      fg: "text-indigo-600",
                      spark: "#A5B4FC",
                      trend: taskTrendByStatus.done,
                    },
                    {
                      label: "In Progress",
                      value: metrics.inProgress,
                      sub: "Actively working",
                      icon: "Clock",
                      bg: "bg-indigo-50",
                      fg: "text-indigo-600",
                      spark: "#A5B4FC",
                      trend: taskTrendByStatus.inProgress,
                    },
                    {
                      label: "On Hold",
                      value: metrics.onHold,
                      sub: "On hold",
                      icon: "OnHold",
                      bg: "bg-indigo-50",
                      fg: "text-indigo-600",
                      spark: "#A5B4FC",
                      trend: taskTrendByStatus.onHold,
                    },
                    {
                      label: "QA Testing",
                      value: metrics.qaTesting,
                      sub: "In testing",
                      icon: "QATesting",
                      bg: "bg-indigo-50",
                      fg: "text-indigo-600",
                      spark: "#A5B4FC",
                      trend: taskTrendByStatus.qaTesting,
                    },
                    {
                      label: "Overdue",
                      value: metrics.overdue,
                      sub: "Past due date",
                      icon: "Alert",
                      bg: "bg-indigo-50",
                      fg: "text-indigo-600",
                      spark: "#A5B4FC",
                      trend: taskTrendByStatus.overdue,
                    },
                  ].map((s) => {
                    const Icon = Icons[s.icon];
                    return (
                      <div
                        key={s.label}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]"
                      >
                        <div className="mb-3 flex items-center gap-2">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${s.bg} ${s.fg}`}>
                            {Icon && <Icon />}
                          </span>
                          <span className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</span>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-2xl font-extrabold leading-none tracking-tight text-slate-900">{s.value}</p>
                            <p className="mt-1.5 truncate text-[11px] text-slate-400">{s.sub}</p>
                          </div>
                          <MiniSparkline values={s.trend} color={s.spark} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Task Completion + Recent Tasks */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icons.BarChart /></span>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Task Completion</p>
                        <p className="text-[11px] text-slate-400">Overall task progress</p>
                      </div>
                    </div>
                    <span
                      title="Time-range filtering isn't wired up yet"
                      className="flex shrink-0 cursor-not-allowed items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-400"
                    >
                      <Icons.Calendar /> This Week <Icons.ChevronDown />
                    </span>
                  </div>
                  {dashboardTasksLoading ? (
                    <div className="flex h-28 items-center justify-center gap-2 text-[11px] font-semibold text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />Loading tasks...</div>
                  ) : (
                    <TaskStatusPie metrics={metrics} />
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-700">Recent Tasks</p>
                  </div>
                  {dashboardTasksLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-semibold text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />Loading tasks...</div>
                  ) : activeTasks.length === 0 ? (
                    <div className="py-8 text-center"><p className="text-xs font-semibold text-slate-600">No active tasks</p><p className="mt-1 text-[10px] text-slate-400">Everything's done for now.</p></div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {activeTasks.slice(0, 5).map((task) => {
                        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                        const isOverdue = isTaskOverdue(task);
                        const projectName = task.projectId?.name || task.project?.name || "No project";
                        return (
                          <button key={task._id} onClick={() => handleViewTask(task)} className="grid w-full grid-cols-1 gap-2 py-3 text-left transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${task.status === "QA_TESTING" ? "bg-violet-50 text-violet-600" : task.status === "ON_HOLD" ? "bg-amber-50 text-amber-600" : task.status === "TODO" ? "bg-slate-100 text-slate-600" : "bg-indigo-50 text-indigo-600"}`}>{task.title?.charAt(0)?.toUpperCase() || "T"}</span>
                              <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{task.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span className="truncate">{projectName}</span><span className="h-1 w-1 rounded-full bg-slate-300" /><span className={isOverdue ? "font-semibold text-red-500" : ""}>{dueDate && !Number.isNaN(dueDate.getTime()) ? `${isOverdue ? "Overdue · " : "Due "}${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}</span></div></div>
                            </div>
                            <div className="flex items-center gap-2 pl-11 sm:pl-0">
                              <Badge label={task.priority || "Normal"} variant={getPriorityVariant(task.priority)} />
                              <Badge label={(task.status || "TODO").replaceAll("_", " ")} variant={getStatusVariant(task.status)} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={() => setActiveTab("tasks")} className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700">View all tasks →</button>
                </div>
              </div>
            </div>
          )}

          {/* ── PROJECTS ───────────────────────────────────────────────── */}
          <KeepAliveTab active={activeTab === "projects"}>
            <ProjectsPage
              onRefresh={() => {}}
              searchRequest={pageSearchRequest}
            />
          </KeepAliveTab>
          {/* Sprint */}
          <KeepAliveTab active={activeTab === "sprints"}>
            <SprintPage searchRequest={pageSearchRequest} />
          </KeepAliveTab>
          {/* ── TASKS ───────────────────────────────────────────── */}
          <KeepAliveTab active={activeTab === "tasks"}>
            <>
              <div className="w-full max-w-[1400px] mx-auto px-4">
                {loading ? (
                  <div className="flex items-center justify-center mt-40 gap-2 py-8">
                    {/* Spinner */}
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />

                    {/* Text */}
                    <span className="text-xs font-medium text-slate-500">
                      Loading tasks...
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Create Task Button + Refresh */}
                    {/* Top Header */}
                    <div className="mb-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                      {/* Left */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                          <Icons.Tasks />
                        </div>

                        <div>
                          <h2 className="text-sm font-semibold leading-none text-slate-800">
                            Task Management
                          </h2>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Manage assigned tasks
                          </p>
                        </div>
                      </div>

                      {/* Middle: search + filters — fills the gap instead of leaving it empty */}
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[220px] max-w-sm">
                          <input
                            type="text"
                            placeholder="Search task, project..."
                            value={taskSearch}
                            onChange={(e) => setTaskSearch(e.target.value)}
                            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none"
                          />
                          <div className="absolute left-2.5 top-2 text-slate-400">
                            <Icons.Search />
                          </div>
                        </div>
                        <select
                          value={filterTaskStatus}
                          onChange={(e) => setFilterTaskStatus(e.target.value)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 focus:outline-none"
                        >
                          <option value="ALL">All Status</option>
                          <option value="TODO">Todo</option>
                          <option value="IN_PROGRESS">Progress</option>
                          <option value="ON_HOLD">On Hold</option>
                          <option value="QA_TESTING">QA</option>
                          <option value="DONE">Done</option>
                        </select>
                        <select
                          value={filterPriority}
                          onChange={(e) => setFilterPriority(e.target.value)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 focus:outline-none"
                        >
                          <option value="ALL">All Priority</option>
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                        {(taskSearch || filterTaskStatus !== "ALL" || filterPriority !== "ALL") && (
                          <button
                            onClick={() => {
                              setTaskSearch("");
                              setFilterTaskStatus("ALL");
                              setFilterPriority("ALL");
                            }}
                            className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
                          >
                            <Icons.X />
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Right Actions */}
                      {/* <div className="flex items-center gap-1.5"> */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {/* Refresh */}
                        <button
                          onClick={async () => {
                            try {
                              setTasksLoading(true);

                              const tasksRes = await API.get("/tasks");

                              const allTasks =
                                tasksRes.data?.data || tasksRes.data || [];

                              const employeeTasks = allTasks.filter((task) => {
                                const assigneeIds =
                                  task.assignees?.map((a) =>
                                    typeof a === "object" ? a._id : a,
                                  ) || [];

                                const createdById =
                                  typeof task.createdBy === "object"
                                    ? task.createdBy?._id
                                    : task.createdBy;

                                return (
                                  assigneeIds.includes(user?._id) ||
                                  createdById === user?._id
                                );
                              });

                              // Only refresh the task list for My Tasks tab.
                              // Dashboard summary cards + projects summary will remain as-is.
                              setTasks(employeeTasks);
                            } catch (err) {
                              console.error("Failed to refresh tasks:", err);
                            } finally {
                              setTasksLoading(false);
                            }
                          }}
                          disabled={loading || tasksLoading}
                          title="Refresh Tasks"
                          className="flex h-8 items-center gap-1 rounded-sm border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                        >
                          <div
                            className={`${loading || tasksLoading ? "animate-spin" : ""}`}
                          >
                            <Icons.Refresh />
                          </div>
                          Refresh
                        </button>

                        {/* Create */}
                        {userProjects.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedTask(null);
                              setShowCreateModal(true);
                            }}
                            className="flex h-8 items-center gap-1 rounded-sm bg-indigo-600 px-2.5 text-[11px] font-medium text-white transition hover:bg-indigo-700"
                          >
                            <Icons.Plus />
                            Create Task
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Empty State */}
                    {tasks.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                          <Icons.Tasks />
                        </div>

                        <p className="text-sm font-semibold text-slate-600">
                          No tasks assigned yet
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          Your manager will assign tasks soon
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Summary */}
                        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-6 xl:grid-cols-6">
                          {[
                            {
                              label: "Total",
                              value: metrics.total,
                              color: "bg-indigo-50 text-indigo-700",
                              icon: <Icons.Tasks />,
                            },
                            {
                              label: "To Do",
                              value: metrics.todo,
                              color: "bg-slate-100 text-slate-700",
                              icon: <Icons.Alert />,
                            },
                            {
                              label: "In Progress",
                              value: metrics.inProgress,
                              color: "bg-indigo-50 text-indigo-700",
                              icon: <Icons.InProgess />,
                            },
                            {
                              label: "On Hold",
                              value: metrics.onHold,
                              color: "bg-amber-50 text-amber-700",
                              icon: <Icons.OnHold />,
                            },                            {
                              label: "QA Testing",
                              value: metrics.qaTesting,
                              color: "bg-purple-50 text-purple-700",
                              icon: <Icons.QATesting />,
                            },
                            {
                              label: "Done",
                              value: metrics.done,
                              color: "bg-emerald-50 text-emerald-700",
                              icon: <Icons.Check />,
                            },
                          ].map((item, i) => (
                            <div
                              key={i}
                              className={`${item.color} flex items-center justify-between rounded-xl px-4 py-3 min-h-[72px]`}
                            >
                              {/* Left */}
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                                  {item.label}
                                </p>

                                <p className="mt-0.5 text-sm font-bold leading-none">
                                  {item.value}
                                </p>
                              </div>

                              {/* Icon */}
                              <div className="opacity-80">{item.icon}</div>
                            </div>
                          ))}
                        </div>
                        {/* Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                {[
                                  "Task",
                                  "Project",
                                  "Priority",

                                  "Created",
                                  "Due",
                                  "Status",
                                  "Actions ",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide"
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-50">
                              {(() => {
                                const paginatedTasks = paginatedMyTasks;

                                if (tasksLoading) {
                                  return Array.from({ length: 6 }).map(
                                    (_, index) => (
                                      <tr key={index} className="animate-pulse">
                                        <td className="px-4 py-3">
                                          <div className="h-3.5 w-36 rounded-full bg-slate-200" />
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="h-3.5 w-28 rounded-full bg-slate-200" />
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="h-3.5 w-20 rounded-full bg-slate-200" />
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="h-3.5 w-24 rounded-full bg-slate-200" />
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="h-3.5 w-20 rounded-full bg-slate-200" />
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="h-3.5 w-24 rounded-full bg-slate-200" />
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="h-3.5 w-16 rounded-full bg-slate-200" />
                                        </td>
                                      </tr>
                                    ),
                                  );
                                }

                                return paginatedTasks.map((task) => {
                                  const isOverdue = (() => {
                                    if (!task.dueDate) return false;
                                    const dueDay = toDay(task.dueDate);
                                    return (
                                      dueDay < today && task.status !== "DONE"
                                    );
                                  })();

                                  const isSelfCreated =
                                    task?.createdBy?._id === user?._id ||
                                    task?.createdBy === user?._id;

                                  return (
                                    <tr
                                      key={task._id}
                                      className="hover:bg-slate-50"
                                    >
                                      <td className="px-4 py-3 font-medium text-slate-800">
                                        {task.title}
                                      </td>

                                      <td className="px-4 py-3 text-slate-500">
                                        {getProjectName(task.projectId)}
                                      </td>

                                      <td className="px-4 py-3">
                                        <Badge
                                          label={task.priority}
                                          variant={getPriorityVariant(
                                            task.priority,
                                          )}
                                        />
                                      </td>

                                      <td className="px-4 py-3 text-slate-500">
                                        {task.createdAt
                                          ? new Date(
                                              task.createdAt,
                                            ).toLocaleDateString()
                                          : "—"}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={
                                            isOverdue
                                              ? "text-red-600 font-semibold"
                                              : "text-slate-500"
                                          }
                                        >
                                          {new Date(
                                            task.dueDate,
                                          ).toLocaleDateString()}
                                        </span>
                                      </td>

                                      <td className="px-4 py-3 w-[220px]">
                                        <StatusSelect
                                          value={task.status}
                                          onChange={(newStatus) =>
                                            handleStatusChange(
                                              task._id,
                                              newStatus,
                                              task,
                                            )
                                          }
                                          task={task}
                                        />
                                        {task.status === "DONE" &&
                                          ["ADMIN", "PM"].includes(
                                            task.createdBy?.role,
                                          ) &&
                                          task.closedBy?.name && (
                                            <p className="mt-1 text-[9px] font-medium text-slate-400">
                                              Task done by {task.closedBy.name}
                                            </p>
                                          )}
                                      </td>

                                      <td className="px-4 py-3 flex gap-1.5">
                                        {isSelfCreated && (
                                          <button
                                            onClick={() => {
                                              setSelectedTask(task);
                                              setShowCreateModal(true);
                                            }}
                                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                                            title="Edit task"
                                          >
                                            <Icons.Edit />
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleViewTask(task)}
                                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                                          title="View details & comment"
                                        >
                                          <Icons.Eye />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-xs text-slate-500">
                            Showing{" "}
                            <span className="font-semibold text-slate-700">
                              {filteredMyTasks.length ? (taskPage - 1) * taskPageSize + 1 : 0}
                            </span>
                            –
                            <span className="font-semibold text-slate-700">
                              {Math.min(taskPage * taskPageSize, filteredMyTasks.length)}
                            </span>{" "}
                            of <span className="font-semibold text-slate-700">{filteredMyTasks.length}</span> tasks
                          </p>

                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              Per page
                              <select
                                value={taskPageSize}
                                onChange={(e) => setTaskPageSize(Number(e.target.value))}
                                className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 focus:outline-none"
                              >
                                {[10, 20, 50].map((n) => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </label>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setTaskPage((p) => Math.max(1, p - 1))}
                                disabled={taskPage === 1}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Previous page"
                              >
                                <Icons.Back />
                              </button>
                              <span className="px-1 text-[11px] font-semibold text-slate-600">
                                {taskPage} / {myTasksPageCount}
                              </span>
                              <button
                                onClick={() => setTaskPage((p) => Math.min(myTasksPageCount, p + 1))}
                                disabled={taskPage === myTasksPageCount}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Next page"
                              >
                                <Icons.Arrow />
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* View Task Modal */}
              <TaskViewModal
                isOpen={showViewModal}
                onClose={() => {
                  setShowViewModal(false);
                  setSelectedTask(null);
                  setTaskDetails(null);
                  setComments([]);
                  setNewComment("");
                }}
                selectedTask={selectedTask || taskDetails}
                projects={projects}
                employees={[]}
                comments={comments}
                onAddComment={handleAddComment}
                newComment={newComment}
                onNewCommentChange={setNewComment}
                isLoading={taskLoading || commentLoading}
                getProjectName={getProjectName}
                getAssigneeName={getAssigneeName}
              />

              {/* Create Task Modal */}
              <CreateTaskModal
                isOpen={showCreateModal}
                onClose={() => {
                  setShowCreateModal(false);
                  setSelectedTask(null);
                }}
                onTaskCreated={(newTask) => {
                  if (selectedTask) {
                    // Update existing task
                    setTasks((prev) =>
                      prev.map((t) => (t._id === newTask._id ? newTask : t)),
                    );
                  } else {
                    // Create new task
                    setTasks((prev) => [newTask, ...prev]);
                  }
                  setShowCreateModal(false);
                  setSelectedTask(null);
                }}
                suppressNotify={true}
                userProjects={userProjects}
                editingTask={selectedTask}
              />

              {/* QA Assign Modal */}
              <QaAssignModal
                isOpen={showQaAssignModal}
                suppressNotify
                onClose={() => {
                  setShowQaAssignModal(false);
                  setQaAssignTask(null);
                }}
                task={qaAssignTask}
                onAssigned={(updatedTask) => {
                  // Close modal and update only the affected task.
                  setShowQaAssignModal(false);
                  setQaAssignTask(null);

                  setTasks((current) =>
                    current.map((task) =>
                      task._id === updatedTask._id
                        ? { ...task, ...updatedTask }
                        : task,
                    ),
                  );

                  toast.success("Task moved to QA Testing");
                }}
              />
            </>
          </KeepAliveTab>

          {/* Reports Tab */}
          <KeepAliveTab active={activeTab === "reports"}>
            <ReportsPage metrics={metrics} projects={projects} tasks={tasks} />
          </KeepAliveTab>

          {/* Guide & FAQ */}
          {activeTab === "guideFaq" && (
            <div className="w-full">
              <RoleGuideFaq />
            </div>
          )}

          {/* Settings */}
          {activeTab === "settings" && (
            <RoleSettingsView
              user={user}
              roleConfig={ROLE_SETTINGS_CONFIG[getRoleKeyFromUser(user)]}
            />
          )}
        </main>
      </div>
    </div>
  );
}
