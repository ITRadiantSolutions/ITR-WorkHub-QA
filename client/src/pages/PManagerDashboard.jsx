import { useState, useEffect, useCallback, useMemo } from "react";
import { isTaskOverdue } from "../utils/taskDates";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "../components/NotificationBell";
import { API, DATA_MUTATED_EVENT } from "../services/api";
import ProjectsPage from "./ProjectPage";
import TasksPage from "./TaskPage";
import SprintPage from "./SprintPage";
import ReportsPage from "./ReportsPage";
import BugReportPage from "./BugReportPage";
import KeepAliveTab from "../components/KeepAliveTab";
import { toast } from "sonner";
import {
  BugIcon,
  StatusSelect,
  Field,
  BugDetailModal,
} from "../components/BugComponents";
import { SEVERITY, STATUS_STYLES } from "../components/bugConstants";
import Icons from "../components/Icons";
import RoleGuideFaq from "./RoleGuideFaq";
import useAdminSidebarTabCounts from "../hooks/useAdminSidebarTabCounts";
import { adminNotificationAPI } from "../services/adminNotificationApi";
import TrackerSidebar from "../components/TrackerSidebar";

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ value, total, label }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 34,
    cx = 42,
    cy = 42,
    circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="donut-chart__track"
          stroke="currentColor"
          strokeWidth="9"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#00a21d"
          strokeWidth="9"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 42 42)"
          style={{ transition: "stroke-dashoffset 0.7s ease" }}
        />
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          className="donut-chart__value"
          fill="currentColor"
        >
          {pct}%
        </text>
      </svg>
      <p className="text-[11px] text-slate-500 mt-1">{label}</p>
    </div>
  );
}

// ── Horizontal Bar ────────────────────────────────────────────────────────────
function HBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-bold text-slate-800">{count}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Vertical Bar Chart ────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2.5 h-20 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] font-bold text-slate-600">
            {d.value}
          </span>
          <div
            className="w-full rounded-t"
            style={{
              height: `${Math.max((d.value / max) * 60, d.value > 0 ? 4 : 0)}px`,
              backgroundColor: d.color,
              transition: "height 0.5s ease",
            }}
          />
          <span className="text-[9px] text-slate-400 text-center leading-tight">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function DashboardPie({ data, centerValue, centerLabel }) {
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
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${centerLabel} distribution`}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
          {segments.map((item) => (
            <circle
              key={item.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="12"
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
              <span className="text-lg font-bold leading-none text-slate-800">{hovered.value}</span>
              <span className="mt-1 max-w-[90px] truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{hovered.label}</span>
              <span className="text-[9px] font-semibold text-slate-400">{total ? Math.round((hovered.value / total) * 100) : 0}%</span>
            </>
          ) : (
            <>
              <span className="text-xl font-bold leading-none text-slate-800">{centerValue ?? total}</span>
              <span className="mt-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">{centerLabel}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5">
        {data.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 cursor-pointer"
            onMouseEnter={() => setHovered(item)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] font-medium text-slate-500">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
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
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${styles[variant] || styles.default}`}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [bugLoading, setBugLoading] = useState(true);
  const [bugError, setBugError] = useState("");
  const [dashboardTasksLoading, setDashboardTasksLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
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

  const fetchData = useCallback(async () => {
    try {
      setDashboardTasksLoading(true);
      setProjectsLoading(true);

      await Promise.allSettled([
        API.get("/tasks", { params: { view: "dashboard" } })
          .then((res) => setTasks(res.data?.data || res.data || []))
          .catch(() => setTasks([]))
          .finally(() => setDashboardTasksLoading(false)),
        API.get("/projects")
          .then((res) => setProjects(res.data || []))
          .catch(() => setProjects([]))
          .finally(() => setProjectsLoading(false)),
        API.get("/sprints")
          .then((res) => {
            const data = res.data?.data || res.data || [];
            setSprints(Array.isArray(data) ? data : []);
          })
          .catch(() => setSprints([])),
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  }, []);

  const fetchBugs = async () => {
    try {
      setBugLoading(true);
      setBugError("");

      const res = await API.get("/bugs");

      const bugData =
        res.data?.data ||
        res.data?.bugs ||
        (Array.isArray(res.data) ? res.data : []);

      setBugs(Array.isArray(bugData) ? bugData : []);
    } catch (error) {
      console.error("Fetch bugs error:", error);
      setBugs([]);
      setBugError("Failed to load bugs");
    } finally {
      setBugLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBugs();
  }, [fetchData, refreshKey]);

  useEffect(() => {
    if (activeTab !== "dashboard") return undefined;
    let refreshTimer;
    const handleDataMutation = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        fetchData();
        fetchBugs();
      }, 120);
    };
    window.addEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    };
  }, [activeTab, fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const bugCounts = {
    total: bugs.length,
    open: bugs.filter((b) => b.status === "OPEN").length,
    progress: bugs.filter((b) => b.status === "IN_PROGRESS").length,
    resolved: bugs.filter((b) => b.status === "RESOLVED").length,
    critical: bugs.filter((b) => b.severity === "CRITICAL").length,
  };

  const handleLogout = () => {
    toast.custom(
      (t) => (
        <div className="w-[360px] rounded-3xl border border-slate-200 bg-white shadow-2xl p-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">
                Logout Account?
              </h3>

              <p className="text-xs text-slate-500 mt-1 leading-5">
                Are you sure you want to sign out from your account?
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => toast.dismiss(t)}
              className="flex-1 h-10 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>

            <button
              onClick={() => {
                toast.dismiss(t);
                toast.success("Logged out successfully");

                setTimeout(() => {
                  logout();
                  navigate("/");
                }, 600);
              }}
              className="flex-1 h-10 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      ),
      {
        position: "bottom-left",
        duration: 5000,
      },
    );
  };

  const toDay = (d) => {
    const x = new Date(d);
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  };

  const today = toDay(new Date());
  const m = {
    totalTasks: tasks.length,
    todoTasks: tasks.filter((t) => t.status === "TODO").length,
    inProgressTasks: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    qaTestingTasks: tasks.filter((t) => t.status === "QA_TESTING").length,
    onHoldTasks: tasks.filter((t) => t.status === "ON_HOLD").length,
    completedTasks: tasks.filter((t) => t.status === "DONE").length,
    overdueTasks: tasks.filter((t) => {
      if (!t.dueDate) return false;
      const dueDay = toDay(t.dueDate);
      return dueDay < today && t.status !== "DONE";
    }).length,
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === "Active").length,
    highPriority: tasks.filter((t) => t.priority === "High").length,
    medPriority: tasks.filter((t) => t.priority === "Medium").length,
    lowPriority: tasks.filter((t) => t.priority === "Low").length,
    completionRate:
      tasks.length > 0
        ? Math.round(
            (tasks.filter((t) => t.status === "DONE").length / tasks.length) *
              100,
          )
        : 0,
  };

  const globalSearchResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    const matches = (values) =>
      values.some((value) => String(value || "").toLowerCase().includes(query));
    const startsWithQuery = (value) =>
      String(value || "").toLowerCase().startsWith(query);

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
        subtitle: [item.projectId?.name, item.status].filter(Boolean).join(" · "),
        priority: startsWithQuery(item.name) ? 0 : 1,
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

    return [...projectResults, ...sprintResults, ...bugResults]
      .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title))
      .slice(0, 12);
  }, [bugs, globalQuery, projects, sprints]);

  const openGlobalSearchResult = (result) => {
    setPageSearchRequest({
      type: result.type,
      query: result.title,
      requestId: Date.now(),
    });
    setGlobalQuery(result.title);
    setGlobalSearchFocused(false);
    setActiveTab(result.tab);
  };
  const navItems = [
    { id: "dashboard", label: "Dashboard", Ic: Icons.Dashboard },
    { id: "projects", label: "Projects", Ic: Icons.Projects },
    { id: "tasks", label: "Tasks", Ic: Icons.Tasks },
    { id: "sprints", label: "Sprints", Ic: Icons.Sprints },

    { id: "bugs", label: "Bug Reports", Ic: BugIcon },
    { id: "reports", label: "Reports", Ic: Icons.Reports },
    { id: "guideFaq", label: "Guide & FAQ", Ic: Icons.Help, tag: "NEW" },
    { id: "settings", label: "Settings", Ic: Icons.Settings },
  ].map((item) => ({ ...item, dot: tabCounts[item.id] > 0 }));

  const permissions = [
    {
      label: "Create Projects",
      desc: "Can create and manage new projects",
      allowed: true,
    },
    {
      label: "Edit Projects",
      desc: "Can update project details, deadlines and status",
      allowed: true,
    },
    {
      label: "Assign Team Members",
      desc: "Can assign developers and QA to projects",
      allowed: true,
    },
    {
      label: "Create Tasks",
      desc: "Can create and distribute tasks to team members",
      allowed: true,
    },
    {
      label: "Manage Sprints",
      desc: "Can create sprint plans and track progress",
      allowed: true,
    },
    {
      label: "View Reports",
      desc: "Can access productivity and progress reports",
      allowed: true,
    },
    {
      label: "Approve Users",
      desc: "Only Admin can approve or reject accounts",
      allowed: false,
    },
    {
      label: "Manage Roles",
      desc: "Only Admin can change employee roles",
      allowed: false,
    },
    {
      label: "Delete Users",
      desc: "Restricted to administrator access only",
      allowed: false,
    },
    {
      label: "Global Settings",
      desc: "Only Admin can manage full system settings",
      allowed: false,
    },
  ];
  return (
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="flex min-h-screen bg-slate-50"
    >
      <TrackerSidebar navItems={navItems} activeId={activeTab} onSelect={setActiveTab} onLogout={handleLogout} />

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-base font-bold text-slate-800">
              {activeTab === "dashboard" && "Overview"}
              {activeTab === "projects" && "Projects"}
              {activeTab === "sprints" && "Sprints"}
              {activeTab === "tasks" && "Tasks"}
              {activeTab === "bugs" && "Bug Reports"}
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
              placeholder="Search projects, sprints, bug reports..."
              aria-label="Search projects, sprints, and bug reports"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
            {globalQuery && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setGlobalQuery("");
                  setPageSearchRequest((current) =>
                    current
                      ? {
                          ...current,
                          query: "",
                          requestId: Date.now(),
                        }
                      : null,
                  );
                }}
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
                      Try a project, sprint, or bug name.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <NotificationBell />
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5">
              <Icons.User />
              <span className="font-medium text-slate-700">{user?.name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-blue-600 font-semibold">
                Project Manager
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          {/* ── DASHBOARD ──────────────────────────────────────────────── */}
            {activeTab === "dashboard" && (
          <div className="mx-auto w-full max-w-[1600px] space-y-4">
              {/* Metric cards with bugs */}
         <div className="grid grid-cols-1 sm:grid-cols-4 xl:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total Tasks",
                    value: m.totalTasks,
                    sub: `${m.completedTasks} completed`,
                    Ic: Icons.Tasks,
                    loading: dashboardTasksLoading,
                  },
                  {
                    label: "Total Bugs",
                    value: bugCounts.total,
                    sub: `${bugCounts.open} open`,
                    Ic: BugIcon,
                    loading: bugLoading,
                  },
                  {
                    label: "Total Projects",
                    value: m.totalProjects,
                    sub: `${m.activeProjects} active`,
                    Ic: Icons.Projects,
                    loading: projectsLoading,
                  },
                  {
                    label: "Critical Bugs",
                    value: bugCounts.critical,
                    sub: "high priority",
                    Ic: Icons.Alert,
                    warn: bugCounts.critical > 0,
                    loading: bugLoading,
                  },
                ].map((card, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 border shadow-sm bg-white border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {card.label}
                      </p>
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center ${card.warn ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-500"}`}
                      >
                        <card.Ic />
                      </div>
                    </div>
                    <p
                      className={`text-3xl font-bold ${card.warn ? "text-red-600" : "text-slate-800"}`}
                    >
                      {card.loading ? (
                        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
                      ) : (
                        card.value
                      )}
                    </p>
                    <p className="text-[11px] mt-1 text-slate-400">
                      {card.loading ? "Loading..." : card.sub}
                    </p>
                  </div>
                ))}
              </div>

              {/* Dashboard charts */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Icons.Check /></span><div><p className="text-xs font-bold text-slate-700">Task Completion</p><p className="text-[10px] text-slate-400">Status distribution</p></div></div><span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{m.completedTasks}/{m.totalTasks} done</span></div>
                  <div className="p-4">{dashboardTasksLoading ? <div className="flex h-28 items-center justify-center gap-2 text-[11px] font-semibold text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />Loading tasks...</div> : <DashboardPie centerValue={`${m.completionRate}%`} centerLabel="complete" data={[
                    { label: "Done", value: m.completedTasks, color: "#10b981" }, { label: "In Progress", value: m.inProgressTasks, color: "#3b82f6" }, { label: "QA Testing", value: m.qaTestingTasks, color: "#8b5cf6" }, { label: "On Hold", value: m.onHoldTasks, color: "#f59e0b" }, { label: "Todo", value: m.todoTasks, color: "#cbd5e1" },
                  ]} />}</div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icons.Tasks /></span><div><p className="text-xs font-bold text-slate-700">Task Breakdown</p><p className="text-[10px] text-slate-400">Workload comparison</p></div></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${m.overdueTasks ? "border-red-100 bg-red-50 text-red-600" : "border-slate-200 bg-white text-slate-500"}`}>{m.overdueTasks} overdue</span></div>
                  <div className="p-4">{dashboardTasksLoading ? <div className="flex h-28 items-center justify-center gap-2 text-[11px] font-semibold text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />Loading tasks...</div> : <BarChart data={[
                    { label: "Todo", value: m.todoTasks, color: "#cbd5e1" }, { label: "Progress", value: m.inProgressTasks, color: "#3b82f6" }, { label: "On Hold", value: m.onHoldTasks, color: "#f59e0b" }, { label: "QA Test", value: m.qaTestingTasks, color: "#8b5cf6" }, { label: "Done", value: m.completedTasks, color: "#10b981" },
                  ]} />}<div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400"><span>{m.totalTasks} managed tasks</span><span className="font-semibold text-slate-600">{m.completionRate}% complete</span></div></div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Icons.Projects /></span><div><p className="text-xs font-bold text-slate-700">Projects</p><p className="text-[10px] text-slate-400">Managed portfolio</p></div></div><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{projects.length} total</span></div>
                  <div className="p-4">{projectsLoading ? <div className="flex h-28 items-center justify-center gap-2 text-[11px] font-semibold text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />Loading projects...</div> : <DashboardPie centerValue={projects.length} centerLabel="projects" data={[
                    { label: "Active", value: projects.filter((p) => p.status === "Active").length, color: "#10b981" }, { label: "Planning", value: projects.filter((p) => p.status === "Planning").length, color: "#8b5cf6" }, { label: "Completed", value: projects.filter((p) => p.status === "Completed").length, color: "#3b82f6" },
                  ]} />}</div>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-500"><Icons.Bug /></span><div><p className="text-xs font-bold text-slate-700">Bugs by Status</p><p className="text-[10px] text-slate-400">Issue resolution</p></div></div><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">{bugCounts.total} total</span></div>
                  <div className="p-4">{bugLoading ? <div className="flex h-28 items-center justify-center gap-2 text-[11px] font-semibold text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-red-500" />Loading bugs...</div> : <DashboardPie centerValue={bugCounts.total} centerLabel="bugs" data={[
                    { label: "Open", value: bugCounts.open, color: "#ef4444" }, { label: "In Progress", value: bugCounts.progress, color: "#3b82f6" }, { label: "Resolved", value: bugCounts.resolved, color: "#10b981" }, { label: "Won't Fix", value: bugs.filter((bug) => bug.status === "WONT_FIX").length, color: "#94a3b8" },
                  ]} />}</div>
                </div>              </div>
              {/* Recent Tasks */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icons.Tasks /></span><div><p className="text-xs font-bold text-slate-700">Recent Tasks</p><p className="text-[10px] text-slate-400">Latest managed work</p></div></div><div className="flex items-center gap-2"><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">{tasks.length} total</span><button onClick={() => setActiveTab("tasks")} className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-indigo-600 transition hover:bg-indigo-50">View all →</button></div></div>
                {dashboardTasksLoading ? <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-semibold text-slate-400"><span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />Loading recent tasks...</div> : tasks.length === 0 ? <div className="py-8 text-center"><p className="text-xs font-semibold text-slate-600">No tasks available</p><p className="mt-1 text-[10px] text-slate-400">New managed tasks will appear here.</p></div> : (
                  <div className="divide-y divide-slate-100">{tasks.slice(0, 5).map((task) => { const dueDate = task.dueDate ? new Date(task.dueDate) : null; const isOverdue = isTaskOverdue(task); const projectName = task.projectId?.name || task.project?.name || "No project"; return <button key={task._id} onClick={() => setActiveTab("tasks")} className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${task.status === "DONE" ? "bg-emerald-50 text-emerald-600" : task.status === "QA_TESTING" ? "bg-violet-50 text-violet-600" : task.status === "ON_HOLD" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"}`}>{task.title?.charAt(0)?.toUpperCase() || "T"}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{task.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span>{projectName}</span><span className="h-1 w-1 rounded-full bg-slate-300" /><span className={isOverdue ? "font-semibold text-red-500" : ""}>{dueDate && !Number.isNaN(dueDate.getTime()) ? `${isOverdue ? "Overdue · " : "Due "}${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}</span></div></div></div><div className="flex items-center gap-2 pl-11 sm:pl-0"><Badge label={task.priority || "Normal"} variant={(task.priority || "").toLowerCase()} /><span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{(task.status || "TODO").replaceAll("_", " ")}</span><span className="text-slate-300">→</span></div></button>; })}</div>
                )}
              </div>
              {/* Project health table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs font-bold text-slate-700">
                    Project Health
                  </p>
                  <button
                    onClick={() => setActiveTab("projects")}
                    className="text-[11px] text-slate-400 hover:text-slate-700 transition"
                  >
                    View all →
                  </button>
                </div>
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No projects yet
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {projects.slice(0, 5).map((p) => (
                      <div
                        key={p._id}
className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                p.status === "Active"
                                  ? "#059669"
                                  : p.status === "Planning"
                                    ? "#7c3aed"
                                    : "#94a3b8",
                            }}
                          />
                          <p className="text-xs font-medium text-slate-700 truncate">
                            {p.name}
                          </p>
                        </div>
                      <div className="flex flex-wrap items-center gap-2">  
                          <Badge
                            label={p.status}
                            variant={
                              p.status === "Active"
                                ? "active"
                                : p.status === "Planning"
                                  ? "planning"
                                  : "completed"
                            }
                          />
                          <Badge
                            label={p.priority}
                            variant={
                              p.priority === "High"
                                ? "high"
                                : p.priority === "Medium"
                                  ? "medium"
                                  : "low"
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Overdue alert */}
              {m.overdueTasks > 0 && (
       <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <div className="text-red-500 shrink-0">
                    <Icons.Alert />
                  </div>
                  <p className="text-xs text-red-700 font-medium">
                    <span className="font-bold">
                      {m.overdueTasks} task{m.overdueTasks > 1 ? "s" : ""}
                    </span>{" "}
                    overdue — review and reassign as needed.
                  </p>
                  <button
                    onClick={() => setActiveTab("tasks")}
             className="sm:ml-auto text-[11px] text-red-600 font-semibold hover:underline"
                  >
                    View Tasks →
                  </button>
                </div>
              )}
            </div>
          )}

          <KeepAliveTab active={activeTab === "projects"}>
            <ProjectsPage onRefresh={handleRefresh} searchRequest={pageSearchRequest} />
          </KeepAliveTab>
          <KeepAliveTab active={activeTab === "sprints"}>
            <SprintPage onRefresh={handleRefresh} searchRequest={pageSearchRequest} />
          </KeepAliveTab>
          <KeepAliveTab active={activeTab === "tasks"}>
            <TasksPage onRefresh={handleRefresh} />
          </KeepAliveTab>

          {/* ── REPORTS TAB ─────────────────────────────────────────────────── */}
          <KeepAliveTab active={activeTab === "reports"}>
            <ReportsPage
              metrics={null}
              projects={projects}
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

          {/* ── BUG REPORTS TAB ─────────────────────────────────────────────── */}
          <KeepAliveTab active={activeTab === "bugs"}>
            <BugReportPage
              bugs={bugs}
              setBugs={setBugs}
              loading={bugLoading}
              error={bugError}
              setError={setBugError}
              onRefresh={fetchBugs}
              user={user}
              searchRequest={pageSearchRequest}
            />
          </KeepAliveTab>
          {/*Settings  */}

          {activeTab === "settings" && (
            <div className="max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Profile Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-800">
                    Profile Information
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Your manager account details
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-bold">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {user?.name}
                      </p>
                      <p className="text-xs text-slate-500">{user?.email}</p>

                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 font-semibold">
                        PROJECT MANAGER
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    {[
                      { label: "Full Name", value: user?.name },
                      { label: "Email", value: user?.email },
                      { label: "Role", value: "Project Manager" },
                      { label: "Status", value: "Active" },
                    ].map((row, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0"
                      >
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          {row.label}
                        </span>

                        <span className="text-xs font-medium text-slate-800">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Permissions Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-800">
                    Manager Permissions
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Access rights for managing projects & teams
                  </p>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {permissions.map((p, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 transition ${
                        p.allowed
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-slate-50 border-slate-200 opacity-70"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            p.allowed
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-300 text-white"
                          }`}
                        >
                          {p.allowed ? <Icons.Check /> : <Icons.X />}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {p.label}
                          </p>

                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            {p.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Access */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-800">
                    Manager Access Points
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Main tools available in dashboard
                  </p>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    "Create Projects",
                    "Assign Team Members",
                    "Manage Tasks",
                    "Track Sprint Progress",
                    "View Reports",
                    "Approve Workflow",
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </span>

                      <span className="text-xs font-medium text-slate-700">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
