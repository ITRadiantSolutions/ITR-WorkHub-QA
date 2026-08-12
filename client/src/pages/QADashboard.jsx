import { useState, useEffect, useMemo } from "react";
import { isTaskOverdue } from "../utils/taskDates";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "../components/NotificationBell";
import { API, DATA_MUTATED_EVENT } from "../services/api";

import TaskViewModal from "../components/TaskViewModal";
import CreateTaskModal from "../components/CreateTaskModal";
import SprintPage from "./SprintPage";
import ProjectPage from "./ProjectPage";
import { BugDetailModal } from "../components/BugComponents";
import { toast } from "sonner";
import RoleSettingsView from "../components/RoleAccess/RoleSettingsView";
import {
  getRoleKeyFromUser,
  ROLE_SETTINGS_CONFIG,
} from "../data/roleSettingsConfig";
import Icons from "../components/Icons";
import ReportsPage from "./ReportsPage";
import BugReportPage from "./BugReportPage";
import KeepAliveTab from "../components/KeepAliveTab";
import RoleGuideFaq from "./RoleGuideFaq";
import useAdminSidebarTabCounts from "../hooks/useAdminSidebarTabCounts";
import { adminNotificationAPI } from "../services/adminNotificationApi";
import TrackerSidebar from "../components/TrackerSidebar";

// ── Severity config ───────────────────────────────────────────────────────────
const SEVERITY = {
  CRITICAL: {
    label: "Critical",
    bar: "bg-red-600",
    badge: "bg-red-50 text-red-700 border-red-200",
    accent: "border-red-500",
    bg: "bg-red-50",
  },
  HIGH: {
    label: "High",
    bar: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    accent: "border-orange-400",
    bg: "bg-orange-50",
  },
  MEDIUM: {
    label: "Medium",
    bar: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    accent: "border-amber-400",
    bg: "bg-amber-50",
  },
  LOW: {
    label: "Low",
    bar: "bg-green-500",
    badge: "bg-green-50 text-green-700 border-green-200",
    accent: "border-green-400",
    bg: "bg-green-50",
  },
};

const STATUS_STYLES = {
  OPEN: "bg-red-50 text-red-700 border border-red-200",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  WONT_FIX: "bg-slate-100 text-slate-600 border border-slate-200",
};

function getTaskPriorityVariant(p) {
  return { High: "high", Medium: "medium", Low: "low" }[p] || "default";
}
const normalizeStatus = (status = "") => {
  return String(status || "")
    .replace(/\s+/g, "_")
    .trim()
    .toUpperCase();
};
function TaskStatusSelect({ value, onChange, task, user }) {
  const normalizedValue = value?.toString()?.trim()?.toUpperCase();

  // QA self-created task
  const isSelfCreated =
    task?.createdBy?._id?.toString() === user?._id?.toString() ||
    task?.createdBy?.toString() === user?._id?.toString();

  // Self-created QA tasks can access QA_TESTING
  const options = isSelfCreated
    ? ["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING", "DONE"]
    : ["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING", "DONE"];

  return (
    <div className="relative w-full min-w-[120px]">
      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
        <div
          className={`h-2 w-2 rounded-full ${
            normalizedValue === "DONE"
              ? "bg-emerald-500"
              : normalizedValue === "IN_PROGRESS"
                ? "bg-indigo-600"
                : normalizedValue === "QA_TESTING"
                  ? "bg-purple-500"
                  : "bg-slate-400"
          }`}
        />
      </div>

      <select
        value={normalizeStatus(normalizedValue)}
        onChange={(e) => onChange(normalizeStatus(e.target.value))}
        className={`
          h-8 w-full appearance-none rounded-xl border
          pl-6 pr-7 text-[11px] font-semibold
          transition-all focus:outline-none
          focus:ring-2 focus:ring-slate-200
          cursor-pointer

          ${
            normalizedValue === "DONE"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : normalizedValue === "IN_PROGRESS"
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : normalizedValue === "QA_TESTING"
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
                    : "Done"}
          </option>
        ))}
      </select>
    </div>
  );
}

function TaskBadge({ label, variant }) {
  const s = {
    todo: "bg-slate-50 text-slate-600 border border-slate-200",
    progress: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-green-50 text-green-700 border border-green-200",
    overdue: "bg-red-100 text-red-700 border border-red-200",
    default: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${s[variant] || s.default}`}
    >
      {label}
    </span>
  );
}

function DonutChart({ completed, total }) {
  const ratio = total > 0 ? completed / total : 0;
  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 36 36" className="w-full h-full">
        <path
          d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831"
          fill="none"
          stroke="#0f172a"
          strokeWidth="3"
          strokeDasharray={`${Math.round(ratio * 100)}, 100`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-900">
          {Math.round(ratio * 100)}%
        </span>
        <span className="text-[11px] text-slate-500">Done</span>
      </div>
    </div>
  );
}

function DistributionDonut({ data, centerLabel }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const [hovered, setHovered] = useState(null);
  const segmentSizes = data.map((item) => (total ? (item.value / total) * circumference : 0));
  const segments = data.map((item, i) => ({
    ...item,
    segment: segmentSizes[i],
    offset: segmentSizes.slice(0, i).reduce((a, b) => a + b, 0),
  }));
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="13"
          />
          {segments.map((item) => (
            <circle
              key={item.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="13"
              strokeDasharray={`${item.segment} ${circumference - item.segment}`}
              strokeDashoffset={-item.offset}
              className="transition-all duration-700 cursor-pointer"
              style={{ opacity: hovered && hovered.label !== item.label ? 0.35 : 1 }}
              onMouseEnter={() => setHovered(item)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered ? (
            <>
              <span className="text-xl font-bold text-slate-900">{hovered.value}</span>
              <span className="max-w-[90px] truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">{hovered.label}</span>
              <span className="text-[9px] font-semibold text-slate-400">{total ? Math.round((hovered.value / total) * 100) : 0}%</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold text-slate-900">{total}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {centerLabel}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
        {data.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 cursor-pointer text-xs"
            onMouseEnter={() => setHovered(item)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-500">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
// ── Bug StatusSelect (unchanged) ────────────────────────────────────────────
function StatusSelect({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-[11px] font-semibold border rounded px-2 py-1 pr-6 cursor-pointer focus:outline-none appearance-none ${STATUS_STYLES[value] || STATUS_STYLES.OPEN}`}
        style={{ backgroundImage: "none" }}
      >
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="RESOLVED">Resolved</option>
        <option value="WONT_FIX">Won't Fix</option>
      </select>
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-60">
        <Icons.ChevronDown />
      </div>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function QADashboard() {
  const { user, confirmLogout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const [filterTaskStatus, setFilterTaskStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");

  // Pagination for tasks
  const [taskPageSize] = useState(20);
  const [taskPage, setTaskPage] = useState(1);

  const [projects, setProjects] = useState([]);
  const [userProjects, setUserProjects] = useState([]);

  // Task modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [taskComments, setTaskComments] = useState([]);
  const [newTaskComment, setNewTaskComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [sprints, setSprints] = useState([]);
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalSearchFocused, setGlobalSearchFocused] = useState(false);
  const [pageSearchRequest, setPageSearchRequest] = useState(null);
  const { tabCounts, fetchTabCounts, setTabCounts } = useAdminSidebarTabCounts({});

  useEffect(() => {
    if (!["projects", "tasks", "sprints", "bugs"].includes(activeTab)) return;
    if ((tabCounts[activeTab] || 0) === 0) return;
    // Update locally; do not issue another tabs-counts GET after mark-tab-read.
    setTabCounts((current) => ({ ...current, [activeTab]: 0 }));
    adminNotificationAPI.markAdminTabRead({ tab: activeTab }).catch((error) => {
      console.error("Failed to clear notification dot", error);
      fetchTabCounts();
    });
  }, [activeTab, fetchTabCounts, setTabCounts, tabCounts]);

  useEffect(() => {
    window.history.replaceState(null, "", window.location.href);
  }, []);

  const fetchProjects = async () => {
    try {
      setProjectsLoading(true);
      const res = await API.get("/projects");

      const projectData =
        res.data?.data || (Array.isArray(res.data) ? res.data : []);

      setProjects(projectData);

      // Filter projects where user is a team member
      const userAssignedProjects = projectData.filter((project) =>
        project.teamMembers?.some(
          (member) =>
            (typeof member === "object" ? member._id : member) === user?._id,
        ),
      );
      setUserProjects(userAssignedProjects);
    } catch {
      setProjects([]);
      setUserProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };
  const fetchSprints = async () => {
    try {
      const res = await API.get("/sprints");
      const sprintData = res.data?.data || res.data || [];
      setSprints(Array.isArray(sprintData) ? sprintData : []);
    } catch {
      setSprints([]);
    }
  };
  const fetchTasks = async () => {
    try {
      setTaskLoading(true);

      const res = await API.get("/tasks/qa");
      const qaTasks = Array.isArray(res?.data?.data) ? res.data.data : [];
      setTasks(
        qaTasks.map((task) => ({
          ...task,
          status: normalizeStatus(task.status),
        })),
      );
    } catch {
      setTasks([]);
    } finally {
      setTaskLoading(false);
    }
  };

  // Task modal functions
  const fetchTaskDetails = async (taskId) => {
    try {
      setTaskLoading(true);
      const response = await API.get(`/tasks/${taskId}`);
      const task = response.data.data || response.data;
      setTaskDetails(task);
      setTaskComments(task.comments || []);
    } catch (error) {
      console.error("Error fetching task details:", error);
    } finally {
      setTaskLoading(false);
    }
  };

  const handleViewTask = async (task) => {
    setSelectedTask(task);
    await fetchTaskDetails(task._id);
    setShowViewModal(true);
  };

  const handleAddTaskComment = async () => {
    if (!newTaskComment.trim()) return;
    try {
      setCommentLoading(true);
      const response = await API.post(`/tasks/${selectedTask._id}/comments`, {
        text: newTaskComment.trim(),
      });
      setTaskComments(response.data.data || response.data.comments || []);
      setNewTaskComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setCommentLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchSprints();
    fetchTasks();
    fetchBugs();
  }, []);

  useEffect(() => {
    let refreshTimer;
    const handleDataMutation = (event) => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        const url = event?.detail?.url || "";
        const isTaskChange = event?.detail?.entity === "task" || url.includes("/tasks");
        if (activeTab === "tasks" && isTaskChange) fetchTasks();
        else if (activeTab === "bugs" && url.includes("/bugs")) fetchBugs();
        else if (activeTab === "projects" && url.includes("/projects")) fetchProjects();
        else if (activeTab === "sprints" && url.includes("/sprints")) fetchSprints();
        else if (activeTab === "dashboard") {
          if (isTaskChange) fetchTasks();
          if (url.includes("/bugs")) fetchBugs();
          if (url.includes("/projects")) fetchProjects();
          if (url.includes("/sprints")) fetchSprints();
        }
      }, 120);
    };
    window.addEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    };
  }, [activeTab]);

  // Reset pagination when filters or search changes
  useEffect(() => {
    setTaskPage(1);
  }, [taskSearch, filterTaskStatus, filterPriority]);

  const fetchBugs = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await API.get("/bugs");

      const bugData =
        res.data?.data ||
        res.data?.bugs ||
        (Array.isArray(res.data) ? res.data : []);

      setBugs(Array.isArray(bugData) ? bugData : []);
    } catch (error) {
      console.error("Fetch bugs error:", error);
      setBugs([]);
      setError("Failed to load bugs");
    } finally {
      setLoading(false);
    }
  };
  const handleLogout = async () => {
    if (await confirmLogout()) toast.success("Logged out successfully");
  };
  const counts = {
    total: bugs.length,
    totalproject: projects.length,
    open: bugs.filter((b) => b.status === "OPEN").length,
    progress: bugs.filter((b) => b.status === "IN_PROGRESS").length,
    resolved: bugs.filter((b) => b.status === "RESOLVED").length,
    critical: bugs.filter((b) => b.severity === "CRITICAL").length,
    high: bugs.filter((b) => b.severity === "HIGH").length,
  };

  const normalizeStatus = (status = "") => {
    return String(status || "")
      .replace(/\s+/g, "_")
      .trim()
      .toUpperCase();
  };

  const taskCounts = {
    total: tasks.length,

    todo: tasks.filter((t) => normalizeStatus(t.status) === "TODO").length,

    inProgress: tasks.filter((t) => normalizeStatus(t.status) === "IN_PROGRESS")
      .length,

    done: tasks.filter((t) => normalizeStatus(t.status) === "DONE").length,

    overdue: tasks.filter((t) => {
      if (!t.dueDate) return false;
      return isTaskOverdue({ ...t, status: normalizeStatus(t.status) });
    }).length,
  };

  // 👇 Task filtering & analytics
  const filteredTasks = tasks.filter((task) => {
    /* Status Filter */
    if (
      filterTaskStatus !== "ALL" &&
      normalizeStatus(task.status) !== normalizeStatus(filterTaskStatus)
    ) {
      return false;
    }

    /* Priority Filter */
    if (filterPriority !== "ALL" && task.priority !== filterPriority) {
      return false;
    }

    /* Search */
    if (taskSearch.trim()) {
      const query = taskSearch.toLowerCase();

      const projectName =
        typeof task.projectId === "object"
          ? task.projectId?.name || ""
          : typeof task.project === "object"
            ? task.project?.name || ""
            : "";

      const title = task.title?.toLowerCase() || "";

      const description = task.description?.toLowerCase() || "";

      const project = projectName.toLowerCase();

      const assignees =
        task.assignees
          ?.map((a) => (typeof a === "object" ? a.name : ""))
          .join(" ")
          .toLowerCase() || "";

      const createdBy =
        typeof task.createdBy === "object"
          ? task.createdBy?.name?.toLowerCase() || ""
          : "";

      const matches =
        title.includes(query) ||
        description.includes(query) ||
        project.includes(query) ||
        assignees.includes(query) ||
        createdBy.includes(query);

      if (!matches) {
        return false;
      }
    }

    return true;
  });

  const handleUpdateTaskStatus = async (taskId, status) => {
    const normalizedStatus = normalizeStatus(status);
    const currentTask = tasks.find((task) => task._id === taskId);
    const previousStatus = currentTask?.status;

    // Update only the changed row instead of reloading the complete task list.
    setTasks((current) =>
      current.map((task) =>
        task._id === taskId ? { ...task, status: normalizedStatus } : task,
      ),
    );

    try {
      const response = await API.put(
        `/tasks/${taskId}`,
        { status: normalizedStatus },
        { suppressNotify: true },
      );
      const updatedTask = response.data?.data || response.data;

      if (updatedTask && typeof updatedTask === "object") {
        setTasks((current) =>
          current.map((task) =>
            task._id === taskId
              ? {
                  ...task,
                  ...updatedTask,
                  status: normalizeStatus(updatedTask.status || normalizedStatus),
                }
              : task,
          ),
        );
      }

      setTaskDetails((current) =>
        current?._id === taskId
          ? { ...current, ...updatedTask, status: normalizedStatus }
          : current,
      );
      toast.success("Task updated");
    } catch (err) {
      setTasks((current) =>
        current.map((task) =>
          task._id === taskId ? { ...task, status: previousStatus } : task,
        ),
      );
      console.error("STATUS UPDATE ERROR:", err);
      toast.error(err?.response?.data?.message || "Failed to update task");
    }
  };
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

    const bugResults = bugs
      .filter((item) =>
        matches([
          item.title,
          item.description,
          item.projectId?.name,
          item.project?.name,
          item.taskId?.projectId?.name,
        ]),
      )
      .map((item) => ({
        key: "bug-" + item._id,
        type: "bug",
        tab: "bugs",
        title: item.title || "Untitled bug",
        subtitle: [
          item.projectId?.name ||
            item.project?.name ||
            item.taskId?.projectId?.name,
          item.status,
        ]
          .filter(Boolean)
          .join(" · "),
        priority: startsWithQuery(item.title) ? 0 : 1,
      }));

    return [...projectResults, ...sprintResults, ...taskResults, ...bugResults]
      .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title))
      .slice(0, 12);
  }, [bugs, globalQuery, projects, sprints, tasks]);

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
    { id: "projects", label: "Projects", Ic: Icons.Projects },
    { id: "tasks", label: "My Tasks", Ic: Icons.Tasks },
    { id: "sprints", label: "Sprints", Ic: Icons.SprintBoardIcon },
    { id: "bugs", label: "Bug Reports", Ic: Icons.Bug },
    { id: "reports", label: "Reports", Ic: Icons.Reports },
    { id: "guideFaq", label: "Guide & FAQ", Ic: Icons.Help, tag: "NEW" },
    { id: "settings", label: "Settings", Ic: Icons.Settings },
  ].map((item) => ({ ...item, dot: tabCounts[item.id] > 0 }));

  return (
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="flex min-h-screen bg-slate-50"
    >
      <TrackerSidebar navItems={navItems} activeId={activeTab} onSelect={setActiveTab} onLogout={handleLogout} />

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col bg-slate-50">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5 lg:flex-nowrap lg:px-6 lg:py-3.5">
          <div className="min-w-0 shrink-0">
            <h1 className="text-base font-bold text-slate-800">
              {activeTab === "dashboard" && "QA Overview"}

              {activeTab === "bugs" && "Bug Reports"}
              {activeTab === "projects" && "My Projects"}
              {activeTab === "tasks" && "My Tasks"}
              {activeTab === "sprints" && "Sprints"}
              {activeTab === "reports" && "Report"}
              {activeTab === "guideFaq" && "Guide & FAQ"}
              {activeTab === "settings" && "Access & Permissions"}
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
          <div className="relative order-3 w-full lg:order-none lg:mx-4 lg:flex-1 lg:max-w-xl xl:mx-6">
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
              placeholder="Search projects, sprints, tasks, bug reports..."
              aria-label="Search projects, sprints, tasks, and bug reports"
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
                          {result.type === "bug" && <Icons.Bug />}
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
                      Try a project, sprint, task, or bug name.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
            <NotificationBell />
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5">
              <Icons.User />
              <span className="font-medium text-slate-700">{user?.name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-purple-600 font-semibold">QA Engineer</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs mb-4">
              <Icons.Alert />
              {error}
              <button onClick={() => setError("")} className="ml-auto">
                <Icons.X />
              </button>
            </div>
          )}

          {/* ── DASHBOARD ──────────────────────────────────────────────── */}

          {activeTab === "dashboard" && (
            <div
              className="mx-auto w-full max-w-[1600px] space-y-4"
              style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
            >
              {/* ── Metric cards ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
                {[
                  {
                    label: "Assigned Projects",
                    value: counts.totalproject,
                    sub: "overall projects",
                    Icon: Icons.Folder,
                    loading: projectsLoading,
                  },
                  {
                    label: "Total Bugs",
                    value: counts.total,
                    sub: "reported bugs",
                    Icon: Icons.Bug,
                    warn: counts.open > 0,
                    loading,
                  },
                  {
                    label: "Total Tasks",
                    value: taskCounts.total,
                    sub: `${taskCounts.total ? Math.round((taskCounts.done / taskCounts.total) * 100) : 0}% completion rate`,
                    Icon: Icons.Tasks,
                    loading: taskLoading,
                  },
                  {
                    label: "Open Issues",
                    value: counts.open + counts.progress,
                    sub: "need attention",
                    Icon: Icons.Alert,
                    warn: counts.open + counts.progress > 0,
                    loading,
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl p-4 border shadow-sm bg-white border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {card.label}
                      </p>
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          card.warn ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <card.Icon />
                      </div>
                    </div>
                    <p
                      className={`text-3xl font-bold ${card.warn ? "text-red-600" : "text-slate-900"}`}
                    >
                      {card.loading ? (
                        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
                      ) : (
                        card.value
                      )}
                    </p>
                    <p className="text-[11px] mt-0.5 text-slate-400">
                      {card.loading ? "Loading..." : card.sub}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── Charts row ────────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                {/* Bug Analytics */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2"><div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Icons.Bug /></div><div><p className="text-sm font-bold text-slate-800">Bug Status</p><p className="text-[10px] text-slate-400">Current QA issue distribution</p></div></div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-full">{counts.resolved} resolved</span>
                  </div>
                  <div className="p-5"><DistributionDonut centerLabel="bugs" data={[
                    { label: "Open", value: counts.open, color: "#F97316" }, { label: "In Progress", value: counts.progress, color: "var(--chart-primary)" },
                    { label: "Resolved", value: counts.resolved, color: "var(--color-indigo-600)" }, { label: "Won't Fix", value: bugs.filter((b) => b.status === "WONT_FIX").length, color: "var(--chart-neutral)" },
                  ]} /></div>
                </div>

                {/* Task Analytics */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2"><div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Icons.Tasks /></div><div><p className="text-sm font-bold text-slate-800">Task Progress</p><p className="text-[10px] text-slate-400">Assigned QA workload</p></div></div>
                    <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">{taskCounts.total ? Math.round((taskCounts.done / taskCounts.total) * 100) : 0}% done</span>
                  </div>
                  <div className="p-5"><DistributionDonut centerLabel="tasks" data={[
                    { label: "Todo", value: taskCounts.todo, color: "var(--color-indigo-200)" }, { label: "In Progress", value: taskCounts.inProgress, color: "var(--color-indigo-400)" },
                    { label: "QA Testing", value: tasks.filter((t) => normalizeStatus(t.status) === "QA_TESTING").length, color: "var(--color-indigo-600)" }, { label: "Done", value: taskCounts.done, color: "var(--color-indigo-800)" },
                  ]} /></div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                {/* Bugs by Severity */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                      <Icons.Alert />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      Bugs by Severity
                    </p>
                  </div>
                  <div className="p-4 space-y-2">
                    {Object.entries(SEVERITY).map(([key, cfg]) => {
                      const count = bugs.filter(
                        (b) => b.severity === key,
                      ).length;
                      const pct =
                        counts.total > 0
                          ? Math.round((count / counts.total) * 100)
                          : 0;
                      const dotColor =
                        {
                          CRITICAL: "#dc2626",
                          HIGH: "#ea580c",
                          MEDIUM: "#f59e0b",
                          LOW: "#22c55e",
                        }[key] || "#94a3b8";
                      const badgeCls =
                        {
                          CRITICAL: "bg-red-50 text-red-700 border-red-200",
                          HIGH: "bg-orange-50 text-orange-700 border-orange-200",
                          MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
                          LOW: "bg-green-50 text-green-700 border-green-200",
                        }[key] || "bg-slate-50 text-slate-600 border-slate-200";

                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 px-3 py-2.5 border border-slate-100 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeCls}`}
                          >
                            {cfg.label}
                          </span>
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5 mx-1">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: dotColor,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 w-6 text-right">
                            {pct}%
                          </span>
                          <span className="text-xs font-bold text-slate-800 w-5 text-right">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tasks by Priority */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                      <Icons.Tasks />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      Tasks by Priority
                    </p>
                  </div>
                  <div className="p-4 space-y-2">
                    {[
                      {
                        key: "High",
                        dotColor: "#dc2626",
                        badge: "bg-red-50 text-red-700 border-red-200",
                      },
                      {
                        key: "Medium",
                        dotColor: "#f59e0b",
                        badge: "bg-amber-50 text-amber-700 border-amber-200",
                      },
                      {
                        key: "Low",
                        dotColor: "#22c55e",
                        badge: "bg-green-50 text-green-700 border-green-200",
                      },
                    ].map(({ key, dotColor, badge }) => {
                      const count = tasks.filter(
                        (t) =>
                          t.priority === key ||
                          t.priority === key.toUpperCase(),
                      ).length;
                      const pct =
                        taskCounts.total > 0
                          ? Math.round((count / taskCounts.total) * 100)
                          : 0;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 px-3 py-2.5 border border-slate-100 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge}`}
                          >
                            {key}
                          </span>
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5 mx-1">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: dotColor,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 w-6 text-right">
                            {pct}%
                          </span>
                          <span className="text-xs font-bold text-slate-800 w-5 text-right">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Recent data ───────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                {/* Recent Bugs */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <Icons.Bug />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        Recent Bugs
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("bugs")}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition"
                    >
                      View all →
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                    </div>
                  ) : bugs.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No bugs yet
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {bugs.slice(0, 5).map((bug) => {
                        const sevColor =
                          {
                            CRITICAL: "#dc2626",
                            HIGH: "#ea580c",
                            MEDIUM: "#f59e0b",
                            LOW: "#22c55e",
                          }[bug.severity] || "#94a3b8";
                        const statusBadge =
                          {
                            OPEN: "bg-red-50 text-red-700 border-red-200",
                            IN_PROGRESS:
                              "bg-blue-50 text-blue-700 border-blue-200",
                            RESOLVED:
                              "bg-emerald-50 text-emerald-700 border-emerald-200",
                            WONT_FIX:
                              "bg-slate-100 text-slate-600 border-slate-200",
                          }[bug.status] ||
                          "bg-slate-100 text-slate-600 border-slate-200";
                        return (
                          <div
                            key={bug._id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition group"
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: sevColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">
                                {bug.title}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {bug.createdAt
                                  ? new Date(bug.createdAt).toLocaleDateString(
                                      "en-US",
                                      { month: "short", day: "numeric" },
                                    )
                                  : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge}`}
                              >
                                {bug.status?.replace("_", " ")}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 border border-slate-200 bg-slate-50 px-2 py-0.5 rounded">
                                {bug.severity}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Tasks */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <Icons.Tasks />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        Recent Tasks
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition"
                    >
                      View all →
                    </button>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No tasks yet
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {tasks.slice(0, 5).map((task) => {
                        const statusDot =
                          normalizeStatus(task.status) === "DONE"
                            ? "bg-emerald-500"
                            : normalizeStatus(task.status) === "IN_PROGRESS"
                              ? "bg-indigo-600"
                              : normalizeStatus(task.status) === "QA_TESTING"
                                ? "bg-purple-500"
                                : "bg-slate-300";
                        const priorityBadge =
                          {
                            High: "bg-red-50 text-red-700 border-red-200",
                            Medium:
                              "bg-amber-50 text-amber-700 border-amber-200",
                            Low: "bg-green-50 text-green-700 border-green-200",
                          }[task.priority] ||
                          "bg-slate-100 text-slate-600 border-slate-200";
                        const statusBadge =
                          normalizeStatus(task.status) === "DONE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : normalizeStatus(task.status) === "IN_PROGRESS"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : normalizeStatus(task.status) === "QA_TESTING"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-slate-50 text-slate-600 border-slate-200";
                        return (
                          <div
                            key={task._id}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition"
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">
                                {task.title}
                              </p>
                              {task.dueDate && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Due{" "}
                                  {new Date(task.dueDate).toLocaleDateString(
                                    "en-US",
                                    { month: "short", day: "numeric" },
                                  )}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge}`}
                              >
                                {task.status?.replace(/_/g, " ")}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityBadge}`}
                              >
                                {task.priority}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Bug Report Tab */}
          <KeepAliveTab active={activeTab === "bugs"}>
            <BugReportPage searchRequest={pageSearchRequest} />
          </KeepAliveTab>
          {/* Sprint */}
          <KeepAliveTab active={activeTab === "projects"}>
            <ProjectPage
              onRefresh={() => {}}
              searchRequest={pageSearchRequest}
            />
          </KeepAliveTab>

          {/* Sprint */}
          <KeepAliveTab active={activeTab === "sprints"}>
            <SprintPage searchRequest={pageSearchRequest} />
          </KeepAliveTab>

          {/* ── MY TASKS TAB ───────────────────────────────────────────────── */}
          <KeepAliveTab active={activeTab === "tasks"}>
            <div className="w-full space-y-4">
              {/* ================================================= */}
              {/* TOP HEADER */}
              {/* ================================================= */}
              <div className="flex items-center justify-between rounded-2xl   px-1 py-1">
                {/* Left */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                    <Icons.Tasks />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Task Management
                    </h2>

                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {filteredTasks.length} task
                      {filteredTasks.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2">
                  {/* Refresh */}
                  <button
                    onClick={fetchTasks}
                    disabled={taskLoading}
                    className="flex h-7 items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                  >
                    <div className={`${taskLoading ? "animate-spin" : ""}`}>
                      <Icons.Refresh />
                    </div>
                    Refresh
                  </button>

                  {/* Create */}
                  {userProjects.length > 0 && (
                    <button
                      onClick={() => {
                        // Auto-select project based on the first task in QA list (Task tab)
                        // (Create modal itself handles defaultProjectId)
                        setSelectedTask(null);
                        setShowCreateModal(true);
                      }}
                      className="flex h-7 items-center gap-1.5 rounded-sm bg-indigo-600 px-2 text-[11px] font-semibold text-white transition hover:bg-indigo-700"
                    >
                      <Icons.Plus />
                      Create Task
                    </button>
                  )}
                </div>
              </div>
              {/* Summary Cards */}
              <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6">
                {[
                  {
                    label: "Total",
                    value: tasks.length,
                    icon: <Icons.Tasks />,
                    bg: "bg-indigo-50",
                    text: "text-indigo-700",

                    iconBg: "bg-indigo-100",
                  },

                  {
                    label: "Todo",
                    value: tasks.filter(
                      (t) => normalizeStatus(t.status) === "TODO",
                    ).length,
                    icon: <Icons.Alert />,
                    bg: "bg-slate-50",
                    text: "text-slate-800",

                    iconBg: "bg-slate-200",
                  },

                  {
                    label: "Progress",
                    value: tasks.filter(
                      (t) => normalizeStatus(t.status) === "IN_PROGRESS",
                    ).length,
                    icon: <Icons.InProgess />,
                    bg: "bg-blue-50",
                    text: "text-blue-700",

                    iconBg: "bg-blue-100",
                  },

                  {
                    label: "On Hold",
                    value: tasks.filter(
                      (t) => normalizeStatus(t.status) === "ON_HOLD",
                    ).length,
                    icon: <Icons.OnHold />,
                    bg: "bg-amber-50",
                    text: "text-amber-700",
                    iconBg: "bg-amber-100",
                  },
                  {
                    label: "QA",
                    value: tasks.filter(
                      (t) => normalizeStatus(t.status) === "QA_TESTING",
                    ).length,
                    icon: <Icons.QATesting />,
                    bg: "bg-purple-50",
                    text: "text-purple-700",

                    iconBg: "bg-purple-100",
                  },

                  {
                    label: "Done",
                    value: tasks.filter(
                      (t) => normalizeStatus(t.status) === "DONE",
                    ).length,
                    icon: <Icons.Check />,
                    bg: "bg-emerald-50",
                    text: "text-emerald-700",

                    iconBg: "bg-emerald-100",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`
        ${item.bg} ${item.text}
        rounded-lg border border-slate-200
        px-3 py-2.5
        flex items-center justify-between
        min-w-0
        
        
      `}
                  >
                    {/* Left */}
                    <div className="min-w-0">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wide ${
                          item.label === "Total"
                            ? "text-slate-300"
                            : "opacity-60"
                        }`}
                      >
                        {item.label}
                      </p>

                      <div className="flex items-end gap-1 mt-1">
                        <h3 className="text-lg font-bold leading-none">
                          {item.value}
                        </h3>

                        <span
                          className={`text-[10px] pb-0.5 ${
                            item.label === "Total"
                              ? "text-slate-400"
                              : "opacity-70"
                          }`}
                        >
                          {item.sub}
                        </span>
                      </div>
                    </div>

                    {/* Right Icon */}
                    <div
                      className={`
          h-8 w-8 rounded-xl
          flex items-center justify-center
          ${item.iconBg}
          shrink-0
        `}
                    >
                      {item.icon}
                    </div>
                  </div>
                ))}
              </div>
              {/* ================================================= */}
              {/* FILTER TOOLBAR */}
              {/* ================================================= */}
              <div className="flex flex-col lg:flex-row lg:items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                {/* Search */}
                <div className="relative w-full lg:flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Search task, project, user..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="
        h-9 w-full rounded-xl
        border border-slate-200
        bg-slate-50
        pl-9 pr-3
        text-xs font-medium text-slate-700
        placeholder:text-slate-400
        focus:border-slate-300
        focus:bg-white
        focus:outline-none
      "
                  />

                  <div className="absolute left-3 top-2.5 scale-90 text-slate-400">
                    <Icons.Search />
                  </div>
                </div>

                {/* Status */}
                <select
                  className="
      h-9 min-w-[120px]
      rounded-xl
      border border-slate-200
      bg-slate-50
      px-3
      text-xs font-semibold text-slate-700
      focus:outline-none
      focus:border-slate-300
    "
                  value={filterTaskStatus}
                  onChange={(e) => setFilterTaskStatus(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="TODO">Todo</option>
                  <option value="IN_PROGRESS">Progress</option>
                  <option value="ON_HOLD">On Hold</option>

                  <option value="QA_TESTING">QA Testing</option>
                  <option value="DONE">Done</option>
                </select>

                {/* Priority */}
                <select
                  className="
      h-9 min-w-[120px]
      rounded-xl
      border border-slate-200
      bg-slate-50
      px-3
      text-xs font-semibold text-slate-700
      focus:outline-none
      focus:border-slate-300
    "
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                >
                  <option value="ALL">All Priority</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>

                {/* Clear */}
                {(filterTaskStatus !== "ALL" ||
                  filterPriority !== "ALL" ||
                  taskSearch) && (
                  <button
                    onClick={() => {
                      setFilterTaskStatus("ALL");
                      setFilterPriority("ALL");
                      setTaskSearch("");
                    }}
                    className="
        flex h-9 items-center gap-1.5
        rounded-xl
        border border-slate-200
        bg-slate-50
        px-3
        text-xs font-semibold text-slate-600
        transition
        hover:bg-slate-100
      "
                  >
                    <div className="scale-75">
                      <Icons.X />
                    </div>
                    Clear
                  </button>
                )}
              </div>

              {/* ================================================= */}
              {/* LOADING */}
              {/* ================================================= */}
              {taskLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-10 shadow-sm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />

                  <span className="text-xs font-medium text-slate-500">
                    Loading tasks...
                  </span>
                </div>
              ) : filteredTasks.length === 0 ? (
                /* EMPTY */
                <div className="rounded-2xl border border-slate-200 bg-white py-14 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Icons.Tasks />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-slate-700">
                    No tasks found
                  </h3>

                  <p className="mt-1 text-xs text-slate-400">
                    Try changing filters or create a task
                  </p>
                </div>
              ) : (
                /* TABLE */
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-[1200px]">
                      {/* HEADER */}
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="w-[28%] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Task
                          </th>

                          <th className="w-[15%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Project
                          </th>

                          <th className="w-[10%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Priority
                          </th>

                          <th className="w-[12%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Created
                          </th>

                          <th className="w-[12%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Due
                          </th>

                          {/* <th className="w-[15%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Assignees
                          </th> */}

                          <th className="w-[15%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Status
                          </th>

                          <th className="w-[8%] px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      {/* BODY */}
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const startIdx = (taskPage - 1) * taskPageSize;
                          const paginatedTasks = filteredTasks.slice(
                            0,
                            startIdx + taskPageSize,
                          );

                          return paginatedTasks.map((task) => {
                            const isOverdue = isTaskOverdue(task);

                            const projectNameFromTask =
                              typeof task.projectId === "object"
                                ? task.projectId?.name
                                : typeof task.project === "object"
                                  ? task.project?.name
                                  : null;

                            const project = projectNameFromTask
                              ? {
                                  name: projectNameFromTask,
                                }
                              : projects.find(
                                  (p) =>
                                    p._id === task.projectId ||
                                    p._id?.toString() ===
                                      task.projectId?.toString() ||
                                    p._id === task.project ||
                                    p._id?.toString() ===
                                      task.project?.toString(),
                                );

                            const isSelfCreated =
                              task?.createdBy?._id === user?._id ||
                              task?.createdBy === user?._id;

                            return (
                              <tr
                                key={task._id}
                                className="transition hover:bg-slate-50"
                              >
                                {/* TASK */}
                                <td className="px-3 py-3 align-top">
                                  <div className="flex items-start gap-2">
                                    {/* Status Dot */}
                                    <div
                                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                        task.status === "DONE"
                                          ? "bg-emerald-500"
                                          : task.status === "IN_PROGRESS"
                                            ? "bg-indigo-600"
                                            : task.status === "QA_TESTING"
                                              ? "bg-purple-500"
                                              : "bg-slate-400"
                                      }`}
                                    />

                                    {/* Content */}
                                    <div className="min-w-0 flex-1">
                                      {/* Title */}
                                      <p
                                        className="
            break-words whitespace-normal
            text-[12px] font-semibold
            leading-5 text-slate-800
          "
                                      >
                                        {task.title}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* PROJECT */}
                                <td className="px-2 py-3">
                                  <div className="truncate">
                                    <span className="inline-flex max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-700">
                                      {project?.name || "No project"}
                                    </span>
                                  </div>
                                </td>

                                {/* PRIORITY */}
                                <td className="px-2 py-3">
                                  <TaskBadge
                                    label={task.priority}
                                    variant={getTaskPriorityVariant(
                                      task.priority,
                                    )}
                                  />
                                </td>

                                {/* CREATED */}
                                <td className="px-2 py-3">
                                  <p className="text-[10px] text-slate-500">
                                    {task.createdAt
                                      ? new Date(
                                          task.createdAt,
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })
                                      : "—"}
                                  </p>
                                </td>

                                {/* DUE */}
                                <td className="px-2 py-3">
                                  <div className="flex flex-col">
                                    <span
                                      className={`text-[10px] font-semibold ${
                                        isOverdue
                                          ? "text-red-600"
                                          : "text-slate-600"
                                      }`}
                                    >
                                      {new Date(
                                        task.dueDate,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </span>

                                    {isOverdue && (
                                      <span className="mt-0.5 text-[9px] font-medium text-red-400">
                                        Overdue
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* STATUS */}
                                <td className="px-3 py-3 min-w-[220px]">
                                  <TaskStatusSelect
                                    value={task.status}
                                    onChange={(status) =>
                                      handleUpdateTaskStatus(task._id, status)
                                    }
                                    task={task}
                                    user={user}
                                  />
                                </td>

                                {/* ACTIONS */}
                                <td className="px-2 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {/* Edit */}
                                    {isSelfCreated && (
                                      <button
                                        onClick={() => {
                                          setSelectedTask(task);

                                          setShowCreateModal(true);
                                        }}
                                        className="
                          flex h-7 w-7 items-center justify-center
                          rounded-lg border border-slate-200
                          bg-white text-slate-500
                          transition hover:bg-slate-100
                          hover:text-slate-800
                        "
                                      >
                                        <Icons.Edit />
                                      </button>
                                    )}

                                    {/* View */}
                                    <button
                                      onClick={() => handleViewTask(task)}
                                      className="
                        flex h-7 w-7 items-center justify-center
                        rounded-lg border border-slate-200
                        bg-white text-slate-500
                        transition hover:bg-slate-100
                        hover:text-slate-800
                      "
                                    >
                                      <Icons.Eye />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Info & Load More Button */}
                  {(() => {
                    const totalFiltered = filteredTasks.length;
                    const displayedCount = Math.min(
                      taskPage * taskPageSize,
                      totalFiltered,
                    );
                    const remaining = totalFiltered - displayedCount;

                    return (
                      <div className="mt-4 flex items-center justify-between px-4 py-3">
                        <p className="text-xs text-slate-500">
                          Showing{" "}
                          <span className="font-semibold">
                            {displayedCount}
                          </span>{" "}
                          of{" "}
                          <span className="font-semibold">{totalFiltered}</span>{" "}
                          tasks
                        </p>

                        {remaining > 0 && (
                          <button
                            onClick={() => setTaskPage(taskPage + 1)}
                            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            Load More{" "}
                            <span className="text-[10px] text-slate-500">
                              ({remaining} remaining)
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </KeepAliveTab>

          {/* ── TASK MODAL ───────────────────────────────────────────────── */}
          <TaskViewModal
            isOpen={showViewModal}
            onClose={() => {
              setShowViewModal(false);
              setSelectedTask(null);
              setTaskDetails(null);
              setTaskComments([]);
              setNewTaskComment("");
            }}
            selectedTask={selectedTask || taskDetails}
            projects={projects}
            employees={[]}
            comments={taskComments}
            onAddComment={handleAddTaskComment}
            newComment={newTaskComment}
            onNewCommentChange={setNewTaskComment}
            isLoading={taskLoading || commentLoading}
            getProjectName={(project) => {
              // populated object
              if (typeof project === "object" && project?.name) {
                return project.name;
              }

              // normal objectId
              return (
                projects.find((p) => p._id?.toString() === project?.toString())
                  ?.name || "Unknown Project"
              );
            }}
            getAssigneeName={(a) => (typeof a === "object" ? a.name : "User")}
          />

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
            defaultProjectId={null}
          />

          {/* ── REPORTS TAB (moved to ReportsPage.jsx) ───────────────────────── */}
          <KeepAliveTab active={activeTab === "reports"}>
            <ReportsPage
              metrics={null}
              projects={userProjects}
              tasks={tasks}
              bugs={bugs}
            />
          </KeepAliveTab>

          {/* ── GUIDE & FAQ TAB ─────────────────────────────────────────────── */}
          {activeTab === "guideFaq" && (
            <div className="w-full">
              <RoleGuideFaq initialTab="guide" />
            </div>
          )}

          {/* ── ACCESS & SETTINGS ──────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Shared Access Control UI */}
              <div className="lg:col-span-2">
                <RoleSettingsView
                  user={user}
                  roleConfig={ROLE_SETTINGS_CONFIG[getRoleKeyFromUser(user)]}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
