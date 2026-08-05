import { useState, useEffect, useMemo } from "react";
import { API, DATA_MUTATED_EVENT } from "../services/api";

import { useAuth } from "../context/AuthContext";

import NotificationBell from "../components/NotificationBell";
import ProjectsPage from "./ProjectPage";
import EmployeesPage from "./EmployeePage";
import SprintPage from "./SprintPage";
import TasksPage from "./TaskPage";

import { toast } from "sonner";
import { useNotifications } from "../context/NotificationContext.jsx";
import RoleSettingsView from "../components/RoleAccess/RoleSettingsView";
import { adminNotificationAPI } from "../services/adminNotificationApi.js";
import AdminNotificationSearch from "../components/AdminNotificationSearch.jsx";

import { ROLE_SETTINGS_CONFIG } from "../data/roleSettingsConfig";
import Icons from "../components/Icons";
import ReportsPage from "./ReportsPage";
import BugReportPage from "./BugReportPage";
import KeepAliveTab from "../components/KeepAliveTab";
import RoleGuideFaq from "./RoleGuideFaq";
import useAdminSidebarTabCounts from "../hooks/useAdminSidebarTabCounts";

import {
  getActivityClass,
  getActivityLabel,
  getActorName,
  getEntityLabel,
  getEntityName,
  getNotificationMessage,
  getNotificationSummary,
  getProjectName,
  formatTimeAgo,
} from "../utils/notificationDisplay.js";
import RoleGuideFaqTabs from "./RoleGuideFaqTabs.jsx";
import TrackerSidebar from "../components/TrackerSidebar";
import AdminClientTab from "../components/AdminClientTab";
// import AdminOverview from "../components/AdminOverview.jsx";

function DonutChart({ value, total, label, color = "var(--chart-success)" }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 32;
  const cx = 40;
  const cy = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="donut-chart__track"
          stroke="currentColor"
          strokeWidth="8"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text
          x="40"
          y="44"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          className="donut-chart__value"
          fill="currentColor"
        >
          {pct}%
        </text>
      </svg>

      <p className="text-xs text-slate-500 mt-1 text-center">{label}</p>
    </div>
  );
}

function DistributionPieChart({ data, centerLabel, centerValue }) {
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
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`${centerLabel} distribution chart`}
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="12"
          />
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
              <span className="text-xl font-bold leading-none text-slate-900">{hovered.value}</span>
              <span className="mt-1 max-w-[90px] truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{hovered.label}</span>
              <span className="text-[9px] font-semibold text-slate-400">{total ? Math.round((hovered.value / total) * 100) : 0}%</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold leading-none text-slate-900">
                {centerValue ?? total}
              </span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">
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
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="font-medium text-slate-500">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
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

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [clientGroupDraft, setClientGroupDraft] = useState(null);
  const [clientResumeProject, setClientResumeProject] = useState(null);
  const [projectCreateRequest, setProjectCreateRequest] = useState(null);
  const [projectOpenRequest, setProjectOpenRequest] = useState(null);
  const [employeeReportRequest, setEmployeeReportRequest] = useState(null);
  const [stats, setStats] = useState({
    projects: [],
    employees: [],
    tasks: [],
    taskSummary: {},
    bugs: [],
    sprints: [],
    clientGroups: [],
  });

  const [metricsLoading, setMetricsLoading] = useState(true);
  const [employeeLoading, setEmployeeLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [globalQuery, setGlobalQuery] = useState("");
  const [globalSearchFocused, setGlobalSearchFocused] = useState(false);
  const [pageSearchRequest, setPageSearchRequest] = useState(null);

  // Admin notifications (all employees) state
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminPagination, setAdminPagination] = useState({
    page: 1,
    // keep existing backend pagination but default to a large limit for â€œshow allâ€ UX
    limit: 1000,
    total: 0,
    totalPages: 0,
  });

  const [adminEmployeeId, setAdminEmployeeId] = useState("");
  const [adminProjectId, setAdminProjectId] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all"); // all|unread|read
  const [adminQuery, setAdminQuery] = useState("");

  // Fetch admin notifications:
  // - when filters/search change -> reset list (replace)
  // - when clicking Load more -> append manually (no reset fetch triggered)
  const fetchAdminNotificationsPage = async ({
    page,
    limit,
    append = false,
  }) => {
    const res = await adminNotificationAPI.getAdminNotifications({
      page,
      limit,
      employeeId: adminEmployeeId || undefined,
      projectId: adminProjectId || undefined,
      unreadOnly: adminStatusFilter === "unread",
      readOnly: adminStatusFilter === "read",
      q: adminQuery || undefined,
    });

    const data = res?.data?.data || res?.data?.notifications || res?.data || [];

    const pagination = res?.data?.pagination;

    setAdminNotifications((prev) =>
      append
        ? [...prev, ...(Array.isArray(data) ? data : [])]
        : Array.isArray(data)
          ? data
          : [],
    );

    if (pagination) {
      setAdminPagination((p) => ({
        ...p,
        total: pagination.total ?? p.total,
        totalPages: pagination.totalPages ?? p.totalPages,
        page: pagination.page ?? page,
        limit: pagination.limit ?? limit,
      }));
    } else {
      setAdminPagination((p) => ({
        ...p,
        page,
        limit,
      }));
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setAdminLoading(true);
        setAdminPagination({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        });

        const res = await adminNotificationAPI.getAdminNotifications({
          page: 1,
          limit: 20,
          employeeId: adminEmployeeId || undefined,
          projectId: adminProjectId || undefined,
          unreadOnly: adminStatusFilter === "unread",
          readOnly: adminStatusFilter === "read",
          q: adminQuery || undefined,
        });

        const data =
          res?.data?.data || res?.data?.notifications || res?.data || [];

        const pagination = res?.data?.pagination;
        if (!cancelled) {
          setAdminNotifications(Array.isArray(data) ? data : []);
          setAdminPagination((p) => ({
            ...p,
            total: pagination?.total ?? 0,
            totalPages: pagination?.totalPages ?? 0,
            page: pagination?.page ?? 1,
            limit: pagination?.limit ?? 20,
          }));
        }
      } catch (e) {
        console.error("Failed to fetch admin notifications", e);
        if (!cancelled) {
          setAdminNotifications([]);
          setAdminPagination({ page: 1, limit: 20, total: 0, totalPages: 0 });
        }
      } finally {
        if (!cancelled) setAdminLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [adminEmployeeId, adminProjectId, adminStatusFilter, adminQuery]);

  const { markAsRead } = useNotifications();

  useEffect(() => {
    window.history.replaceState(null, "", window.location.href);
  }, []);

  const fetchStats = async () => {
    setEmployeeLoading(true);
    setProjectsLoading(true);
    setMetricsLoading(true);

    const projectRequest = API.get("/projects")
      .catch(() => ({ data: [] }))
      .then((res) => {
        const projects = res.data?.data || res.data || [];
        setStats((current) => ({
          ...current,
          projects: Array.isArray(projects) ? projects : [],
        }));
      })
      .finally(() => setProjectsLoading(false));

    const employeeRequest = API.get("/users")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        const employees = res.data?.data ?? res.data ?? [];
        setStats((current) => ({
          ...current,
          employees: Array.isArray(employees) ? employees : [],
        }));
      })
      .finally(() => setEmployeeLoading(false));

    const clientGroupRequest = API.get("/client-groups")
      .catch(() => ({ data: { data: [] } }))
      .then((res) => {
        const clientGroups = res.data?.data || res.data || [];
        setStats((current) => ({
          ...current,
          clientGroups: Array.isArray(clientGroups) ? clientGroups : [],
        }));
      });
    const taskRequest = API.get("/tasks/summary")
      .catch(() => ({ data: {} }))
      .then((res) => {
        const taskSummary = res.data?.data || res.data || {};
        setStats((current) => ({ ...current, taskSummary }));
      });

    const bugRequest = API.get("/bugs")
      .catch(() => ({ data: [] }))
      .then((res) => {
        const bugs = res.data?.data || res.data || [];
        setStats((current) => ({
          ...current,
          bugs: Array.isArray(bugs) ? bugs : [],
        }));
      });

    const sprintRequest = API.get("/sprints")
      .catch(() => ({ data: [] }))
      .then((res) => {
        const sprints = res.data?.data || res.data || [];
        setStats((current) => ({
          ...current,
          sprints: Array.isArray(sprints) ? sprints : [],
        }));
      });

    // Secondary datasets must not hold the dashboard skeleton open.
    await Promise.allSettled([
      projectRequest,
      employeeRequest,
      taskRequest,
      bugRequest,
    ]);
    setMetricsLoading(false);
    await Promise.allSettled([sprintRequest, clientGroupRequest]);
  };
  // metricsLoading will be turned off in finally above
  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab !== "dashboard") return undefined;
    let refreshTimer;
    const handleDataMutation = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(fetchStats, 120);
    };
    window.addEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    };
  }, [activeTab]);

  const handleLogout = () => {
    toast.success("Logged out successfully");
    logout();
  };

  // Derived metrics
  const m = {
    totalProjects: stats.projects.length,

    activeProjects: stats.projects.filter((p) => p.status === "Active").length,
    totalUsers: stats.employees.length,
    managers: stats.employees.filter((u) => u.role === "PM").length,
    pms: stats.employees.filter((u) => u.role === "PM").length,
    developers: stats.employees.filter((u) => u.role === "DEVELOPER").length,
    qaEngineers: stats.employees.filter((u) => u.role === "QA").length,
    businessUsers: stats.employees.filter((u) => u.role === "BUSINESS_USER")
      .length,
    admins: stats.employees.filter((u) => u.role === "ADMIN").length,
    totalTasks: stats.taskSummary.total || 0,
    doneTasks: stats.taskSummary.done || 0,
    progressTasks: stats.taskSummary.progress || 0,
    onHoldTasks: stats.taskSummary.onHold || 0,
    qaTestingTasks: stats.taskSummary.qaTesting || 0,
    todoTasks: stats.taskSummary.todo || 0,
    overdueTasks: stats.taskSummary.overdue || 0,

    completionRate:
      (stats.taskSummary.total || 0) > 0
        ? Math.round(
            ((stats.taskSummary.done || 0) / stats.taskSummary.total) * 100,
          )
        : 0,
  };

  const { tabCounts, fetchTabCounts, setTabCounts } = useAdminSidebarTabCounts({
    employeeId: adminEmployeeId || undefined,
    projectId: adminProjectId || undefined,
  });

  // Mark only tabs with unread activity and clear the badge locally.
  useEffect(() => {
    const shouldMark = ["projects", "tasks", "sprints", "bugs", "notifications"].includes(activeTab);
    if (!shouldMark || (tabCounts[activeTab] || 0) === 0) return;
    setTabCounts((current) => ({ ...current, [activeTab]: 0 }));
    adminNotificationAPI.markAdminTabRead({
      tab: activeTab,
      employeeId: adminEmployeeId || undefined,
      projectId: adminProjectId || undefined,
    }).catch((error) => {
      console.error("Failed to mark admin tab notifications as read", error);
      fetchTabCounts();
    });
  }, [activeTab, adminEmployeeId, adminProjectId, fetchTabCounts, setTabCounts, tabCounts]);

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

    const users = (stats.employees || [])
      .filter((item) => matches([item.name, item.email, item.role]))
      .map((item) => ({
        key: "user-" + (item._id || item.id),
        type: "user",
        tab: "employees",
        title: item.name || "Unnamed user",
        subtitle: [item.email, item.role].filter(Boolean),
        userTab:
          item.approvalStatus === "Rejected"
            ? "rejected"
            : item.approvalStatus === "Pending"
              ? "pending"
              : "approved",
        priority: startsWithQuery(item.name) ? 0 : 1,
      }));

    const employeeReports = (stats.employees || [])
      .filter(
        (item) =>
          ["DEVELOPER", "QA", "EMPLOYEE"].includes(item.role) &&
          matches([item.name, item.email, item.role, "employee report"]),
      )
      .map((item) => ({
        key: "employee-report-" + (item._id || item.id),
        id: item._id || item.id,
        type: "employeeReport",
        tab: "reports",
        title: `${item.name || "Unnamed employee"} Report`,
        subtitle: [item.email, "Employee performance report"]
          .filter(Boolean)
          .join(" · "),
        priority: startsWithQuery(item.name) ? 0 : 1,
      }));
    const projects = (stats.projects || [])
      .filter((item) => matches([item.name, item.description]))
      .map((item) => ({
        key: "project-" + item._id,
        type: "project",
        tab: "projects",
        title: item.name || "Unnamed project",
        subtitle: [item.status, item.priority].filter(Boolean).join("  •  "),
        priority: startsWithQuery(item.name) ? 0 : 1,
      }));

    const clientGroups = (stats.clientGroups || [])
      .filter((item) =>
        matches([
          item.name,
          item.description,
          item.status,
          item.createdBy?.name,
          item.createdBy?.email,
          ...(item.projects || []).map((project) => project.name),
        ]),
      )
      .map((item) => ({
        key: "client-group-" + item._id,
        id: item._id,
        type: "clientGroup",
        tab: "clients",
        title: item.name || "Unnamed account",
        subtitle: [
          item.status || "Active",
          `${item.projects?.length || 0} projects`,
        ]
          .filter(Boolean)
          .join(" · "),
        priority: startsWithQuery(item.name) ? 0 : 1,
      }));
    const sprints = (stats.sprints || [])
      .filter((item) => matches([item.name, item.goal, item.projectId?.name]))
      .map((item) => ({
        key: "sprint-" + item._id,
        type: "sprint",
        tab: "sprints",
        title: item.name || "Unnamed sprint",
        subtitle: [item.projectId?.name, item.status].filter(Boolean),
        priority: startsWithQuery(item.name) ? 0 : 1,
      }));

    const bugs = (stats.bugs || [])
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
        ].filter(Boolean),
        priority: startsWithQuery(item.title) ? 0 : 1,
      }));

    return [
      ...users,
      ...employeeReports,
      ...clientGroups,
      ...projects,
      ...sprints,
      ...bugs,
    ]
      .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title))
      .slice(0, 12);
  }, [
    globalQuery,
    stats.bugs,
    stats.clientGroups,
    stats.employees,
    stats.projects,
    stats.sprints,
  ]);

  const openGlobalSearchResult = (result) => {
    if (result.type === "employeeReport") {
      setEmployeeReportRequest({
        employeeId: result.id,
        requestId: Date.now(),
      });
    }
    setPageSearchRequest({
      type: result.type,
      id: result.id,
      query: result.title,
      userTab: result.userTab,
      requestId: Date.now(),
    });
    setGlobalQuery(result.title);
    setGlobalSearchFocused(false);
    setActiveTab(result.tab);
  };
  const navItems = [
    { id: "dashboard", label: "Dashboard", Ic: Icons.Dashboard },
    { id: "clients", label: "Accounts", Ic: Icons.Users },

    { id: "projects", label: "Projects", Ic: Icons.Projects },
    { id: "tasks", label: "Tasks", Ic: Icons.Tasks },

    { id: "sprints", label: "Sprints", Ic: Icons.Sprints },
    { id: "bugs", label: "Bug Reports", Ic: Icons.Bug },
    { id: "notifications", label: "Notifications", Ic: Icons.Activity },

    { id: "reports", label: "Reports", Ic: Icons.Reports },
    { id: "employees", label: "Users", Ic: Icons.Employees },
    { id: "guideFaq", label: "Guide & FAQ", Ic: Icons.Help, tag: "NEW" },
    { id: "settings", label: "Settings", Ic: Icons.Settings },
  ].map((item) => ({ ...item, dot: tabCounts[item.id] > 0 }));

  return (
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="flex min-h-screen bg-slate-50"
    >
      <TrackerSidebar navItems={navItems} activeId={activeTab} onSelect={setActiveTab} onLogout={handleLogout} />

      <div className="flex-1 min-w-0 min-h-screen flex flex-col bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-base font-bold text-slate-800">
              {activeTab === "dashboard" && "System Overview"}
              {activeTab === "clients" && "Accounts"}
              {activeTab === "projects" && "Projects"}
              {activeTab === "tasks" && "All Tasks"}
              {activeTab === "bugs" && "Bug Reports"}
              {activeTab === "sprints" && "Sprints"}
              {activeTab === "notifications" && "Notifications"}
              {activeTab === "employees" && "Employees"}
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
              placeholder="Search users, accounts , projects, employee reports , sprints , bugs..."
              aria-label="Search users, accounts, projects, sprints, and bug reports"
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
                          {["user", "employeeReport"].includes(result.type) && (
                            <Icons.Employees />
                          )}
                          {result.type === "project" && <Icons.Projects />}
                          {result.type === "clientGroup" && <Icons.Folder />}
                          {result.type === "sprint" && <Icons.Sprints />}
                          {result.type === "bug" && <Icons.Bug />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-slate-800">
                            {result.title}
                          </span>

                          <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                            {result.subtitle || `Open ${result.tab}`}
                          </span>
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                          {result.type === "clientGroup"
                            ? "account"
                            : result.type === "employeeReport"
                              ? "report"
                              : result.type}
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
                      Try a user, project, sprint, or bug name.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <NotificationBell />
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5">
              <Icons.Shield />
              <span className="font-medium text-slate-700">{user?.name}</span>

              <span className="text-red-600 font-semibold">Admin</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
          {activeTab === "dashboard" && (
            <div className="space-y-4 w-full">
              {/* Top metrics */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Total Projects",
                    value: m.totalProjects,
                    sub: `${m.activeProjects} active`,
                    Ic: Icons.Projects,
                    iconCls: "bg-indigo-50 text-indigo-500",
                    loading: metricsLoading,
                  },
                  {
                    label: "Total Users",
                    value: m.totalUsers,
                    sub: `${m.totalUsers} employees`,
                    Ic: Icons.Employees,
                    iconCls: "bg-indigo-50 text-indigo-500",
                    loading: employeeLoading,
                  },
                  {
                    label: "Total Tasks",
                    value: m.totalTasks,
                    sub: `${m.doneTasks} completed`,
                    Ic: Icons.Activity,
                    iconCls: "bg-indigo-50 text-indigo-500",
                    loading: metricsLoading,
                  },
                  {
                    label: "Bug Count",
                    value: stats.bugs.length,
                    sub: `${stats.bugs.length} total bugs`,
                    Ic: Icons.Bug,
                    iconCls: "bg-indigo-50 text-indigo-500",
                    loading: metricsLoading,
                  },
                ].map((card, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 border shadow-sm transition-shadow hover:shadow-md bg-white border-slate-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {card.label}
                      </p>
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center ${card.iconCls}`}
                      >
                        <card.Ic />
                      </div>
                    </div>
                    <p className="text-xl font-bold leading-none mb-1 text-slate-800">
                      {card.loading ? (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
                          Loading
                        </span>
                      ) : (
                        card.value
                      )}
                    </p>
                    <p className="text-[10.5px] text-slate-400">
                      {card.loading ? "Fetching dashboard data..." : card.sub}
                    </p>
                  </div>
                ))}
              </div>
              {/* Dashboard distribution charts */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Icons.Projects />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Projects by Status
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Portfolio distribution
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      {m.totalProjects} total
                    </span>
                  </div>
                  <div className="relative min-h-48 p-5">
                    {metricsLoading ? (
                      <div className="flex h-36 items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
                        Loading projects...
                      </div>
                    ) : (
                      <DistributionPieChart
                        centerLabel="projects"
                        data={[
                          {
                            label: "Active",
                            value: stats.projects.filter(
                              (p) => p.status === "Active",
                            ).length,
                            color: "var(--chart-success)",
                          },
                          {
                            label: "Planning",
                            value: stats.projects.filter(
                              (p) => p.status === "Planning",
                            ).length,
                            color: "var(--chart-secondary)",
                          },
                          {
                            label: "Completed",
                            value: stats.projects.filter(
                              (p) => p.status === "Completed",
                            ).length,
                            color: "var(--chart-primary)",
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Icons.Activity />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Task Completion
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Overall delivery progress
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      {m.completionRate}% done
                    </span>
                  </div>
                  <div className="relative min-h-48 p-5">
                    {metricsLoading ? (
                      <div className="flex h-36 items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
                        Loading tasks...
                      </div>
                    ) : (
                      <>
                        <DistributionPieChart
                          centerLabel="tasks"
                          data={[
                            {
                              label: "Completed",
                              value: m.doneTasks,
                              color: "var(--chart-success)",
                            },
                            {
                              label: "In Progress",
                              value: m.progressTasks,
                              color: "var(--chart-primary)",
                            },
                            {
                              label: "On Hold",
                              value: m.onHoldTasks,
                              color: "var(--chart-warning)",
                            },
                            {
                              label: "QA Testing",
                              value: m.qaTestingTasks,
                              color: "var(--chart-secondary)",
                            },
                            {
                              label: "Todo",
                              value: m.todoTasks,
                              color: "var(--chart-neutral)",
                            },
                          ]}
                        />
                        {m.overdueTasks > 0 && (
                          <div className="mt-4 flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px]">
                            <span className="font-semibold text-red-600">
                              Needs attention
                            </span>
                            <span className="font-bold text-red-700">
                              {m.overdueTasks} overdue
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
                        <Icons.Bug />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Bugs by Status
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Issue resolution overview
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      {stats.bugs.length} total
                    </span>
                  </div>
                  <div className="relative min-h-48 p-5">
                    {metricsLoading ? (
                      <div className="flex h-36 items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-red-500" />
                        Loading bugs...
                      </div>
                    ) : (
                      <DistributionPieChart
                        centerLabel="bugs"
                        data={[
                          {
                            label: "Open",
                            value: stats.bugs.filter((b) => b.status === "OPEN")
                              .length,
                            color: "var(--chart-danger)",
                          },
                          {
                            label: "In Progress",
                            value: stats.bugs.filter(
                              (b) => b.status === "IN_PROGRESS",
                            ).length,
                            color: "var(--chart-primary)",
                          },
                          {
                            label: "Resolved",
                            value: stats.bugs.filter(
                              (b) => b.status === "RESOLVED",
                            ).length,
                            color: "var(--chart-success)",
                          },
                          {
                            label: "Won't Fix",
                            value: stats.bugs.filter(
                              (b) => b.status === "WONT_FIX",
                            ).length,
                            color: "var(--chart-neutral)",
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
              </div>
              {/* User Roles + Quick Links */}
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {/* User roles */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Icons.Employees />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          User Roles
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Access distribution
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {m.totalUsers} users
                    </span>
                  </div>

                  <div className="p-4">
                    <div
                      className="mb-3 flex h-2 overflow-hidden rounded-full bg-slate-100"
                      aria-label="User role distribution"
                    >
                      {[
                        { value: m.admins, color: "#f59e0b" },
                        { value: m.pms, color: "#6366f1" },
                        { value: m.developers, color: "#3b82f6" },
                        { value: m.qaEngineers, color: "#8b5cf6" },
                        { value: m.businessUsers, color: "#10b981" },
                      ].map((role, index) => (
                        <span
                          key={index}
                          className="h-full transition-all duration-700"
                          style={{
                            width: m.totalUsers
                              ? `${(role.value / m.totalUsers) * 100}%`
                              : "0%",
                            backgroundColor: role.color,
                          }}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                      {[
                        {
                          label: "Admins",
                          value: m.admins,
                          color: "#f59e0b",
                          bg: "bg-amber-50",
                        },
                        {
                          label: "Managers",
                          value: m.pms,
                          color: "#6366f1",
                          bg: "bg-indigo-50",
                        },
                        {
                          label: "Developers",
                          value: m.developers,
                          color: "#3b82f6",
                          bg: "bg-blue-50",
                        },
                        {
                          label: "QA",
                          value: m.qaEngineers,
                          color: "#8b5cf6",
                          bg: "bg-violet-50",
                        },
                        {
                          label: "Business",
                          value: m.businessUsers,
                          color: "#10b981",
                          bg: "bg-emerald-50",
                        },
                      ].map((role) => (
                        <div
                          key={role.label}
                          className={`rounded-lg border border-slate-100 px-2.5 py-2 ${role.bg}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: role.color }}
                            />
                            <span className="text-sm font-bold leading-none text-slate-800">
                              {role.value}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-end justify-between gap-1">
                            <span className="truncate text-[10px] font-semibold text-slate-600">
                              {role.label}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {m.totalUsers
                                ? Math.round((role.value / m.totalUsers) * 100)
                                : 0}
                              %
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Quick Links */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Icons.Activity />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Quick Links
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Common admin actions
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      4 shortcuts
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {[
                      {
                        label: "Projects",
                        sub: `${m.totalProjects} total`,
                        tab: "projects",
                        Ic: Icons.Projects,
                        style: "bg-indigo-50 text-indigo-600",
                      },
                      {
                        label: "Bug Reports",
                        sub: `${stats.bugs.length} issues`,
                        tab: "bugs",
                        Ic: Icons.Bug,
                        style: "bg-red-50 text-red-500",
                      },
                      {
                        label: "Manage Users",
                        sub: `${m.totalUsers} users`,
                        tab: "employees",
                        Ic: Icons.Employees,
                        style: "bg-blue-50 text-blue-600",
                      },
                      {
                        label: "Reports",
                        sub: "View insights",
                        tab: "reports",
                        Ic: Icons.Activity,
                        style: "bg-emerald-50 text-emerald-600",
                      },
                    ].map((link) => (
                      <button
                        key={link.tab}
                        onClick={() => setActiveTab(link.tab)}
                        className="group flex min-w-0 items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/60"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${link.style}`}
                        >
                          <link.Ic />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-bold text-slate-700">
                            {link.label}
                          </span>
                          <span className="block truncate text-[9px] text-slate-400">
                            {link.sub}
                          </span>
                        </span>
                        <span className="text-xs text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500">
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Recent Projects */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Icons.Projects />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Recent Projects
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Latest portfolio activity
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                      {stats.projects.length} total
                    </span>
                    <button
                      onClick={() => setActiveTab("projects")}
                      className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"
                    >
                      View all →
                    </button>
                  </div>
                </div>
                {projectsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-semibold text-slate-400">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
                    Loading projects...
                  </div>
                ) : stats.projects.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No projects yet
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2">
                    {stats.projects.slice(0, 6).map((project) => {
                      const createdAt = project.createdAt
                        ? new Date(project.createdAt)
                        : null;
                      const lead =
                        project.projectLead?.name ||
                        project.createdBy?.name ||
                        "Not assigned";
                      return (
                        <button
                          key={project._id}
                          onClick={() => {
                            setProjectOpenRequest({
                              projectId: project._id,
                              requestId: Date.now(),
                            });
                            setActiveTab("projects");
                          }}
                          className="group flex min-w-0 items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 lg:odd:border-r"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${project.status === "Active" ? "bg-emerald-50 text-emerald-600" : project.status === "Planning" ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-blue-600"}`}
                          >
                            <Icons.Projects />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-slate-700">
                              {project.name}
                            </span>
                            <span className="mt-1 block truncate text-[9px] text-slate-400">
                              {lead} ·{" "}
                              {createdAt && !Number.isNaN(createdAt.getTime())
                                ? createdAt.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "No date"}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span
                              className={`block rounded-full px-2 py-0.5 text-[9px] font-bold ${project.status === "Active" ? "bg-emerald-50 text-emerald-700" : project.status === "Planning" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}
                            >
                              {project.status}
                            </span>
                            <span
                              className={`mt-1 block text-[9px] font-semibold ${project.priority === "High" ? "text-red-500" : project.priority === "Medium" ? "text-amber-500" : "text-emerald-500"}`}
                            >
                              {project.priority}
                            </span>
                          </span>
                          <span className="text-slate-300 group-hover:text-indigo-500">
                            →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>{" "}
            </div>
          )}
          {/* Project */}
          <KeepAliveTab active={activeTab === "projects"}>
            <ProjectsPage
              searchRequest={pageSearchRequest}
              createRequest={projectCreateRequest}
              openProjectRequest={projectOpenRequest}
              onProjectCreated={(project) => {
                setClientResumeProject(project);
                setActiveTab("clients");
                fetchStats();
              }}
            />
          </KeepAliveTab>
          {/* Sprint Page */}
          <KeepAliveTab active={activeTab === "sprints"}>
            <SprintPage searchRequest={pageSearchRequest} />
          </KeepAliveTab>
          {/* Notification Tab Page (Admin: all notifications) */}
          {activeTab === "notifications" && (
            <section
              className="w-full space-y-3"
              style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
            >
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                        <Icons.Activity />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Activity center
                        </h2>
                        <p className="text-[11px] text-slate-400">
                          Monitor work updates across every employee and
                          project.
                        </p>
                      </div>
                      {adminNotifications.some((item) => !item.isRead) && (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
                          {
                            adminNotifications.filter((item) => !item.isRead)
                              .length
                          }{" "}
                          unread
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {adminNotifications.some((item) => !item.isRead) && (
                      <button
                        type="button"
                        onClick={async () => {
                          await markAsRead({ all: true });
                          setAdminNotifications((current) =>
                            current.map((item) => ({
                              ...item,
                              isRead: true,
                            })),
                          );
                          toast.success("All notifications marked as read");
                          fetchTabCounts();
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Icons.Check />
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setAdminLoading(true);
                          await fetchAdminNotificationsPage({
                            page: 1,
                            limit: adminPagination.limit || 20,
                          });
                        } finally {
                          setAdminLoading(false);
                        }
                      }}
                      disabled={adminLoading}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span
                        className={
                          adminLoading
                            ? "inline-flex animate-spin"
                            : "inline-flex"
                        }
                      >
                        <Icons.Refresh />
                      </span>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {(() => {
                  const list = Array.isArray(adminNotifications)
                    ? adminNotifications
                    : [];
                  const total = adminPagination.total || list.length;
                  const unread = list.filter((item) => !item.isRead).length;
                  const read = list.length - unread;
                  const today = list.filter((item) => {
                    const date = new Date(item.createdAt);
                    return date.toDateString() === new Date().toDateString();
                  }).length;

                  return [
                    {
                      label: "Total activity",
                      value: total,
                      note: "All matching records",
                      dot: "bg-indigo-600",
                    },
                    {
                      label: "Unread",
                      value: unread,
                      note: "Needs attention",
                      dot: "bg-red-500",
                    },
                    {
                      label: "Read",
                      value: read,
                      note: "Reviewed on this page",
                      dot: "bg-emerald-500",
                    },
                    {
                      label: "Today",
                      value: today,
                      note: "New today",
                      dot: "bg-blue-500",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {item.label}
                          </p>
                          <p className="mt-1 text-xl font-bold leading-none text-slate-800">
                            {item.value}
                          </p>
                        </div>
                        <span
                          className={
                            "h-2.5 w-2.5 shrink-0 rounded-full " + item.dot
                          }
                        />
                      </div>
                      <p className="mt-2 truncate text-[10px] text-slate-400">
                        {item.note}
                      </p>
                    </div>
                  ));
                })()}
              </div>

              <AdminNotificationSearch
                employees={stats.employees || []}
                projects={stats.projects || []}
                employeeId={adminEmployeeId}
                onEmployeeId={(value) => {
                  setAdminEmployeeId(value || "");
                  setAdminPagination((current) => ({
                    ...current,
                    page: 1,
                  }));
                }}
                projectId={adminProjectId}
                onProjectId={(value) => {
                  setAdminProjectId(value || "");
                  setAdminPagination((current) => ({
                    ...current,
                    page: 1,
                  }));
                }}
                statusFilter={adminStatusFilter}
                onStatusFilter={(value) => {
                  setAdminStatusFilter(value);
                  setAdminPagination((current) => ({
                    ...current,
                    page: 1,
                  }));
                }}
                query={adminQuery}
                onQuery={(value) => {
                  setAdminQuery(value);
                  setAdminPagination((current) => ({
                    ...current,
                    page: 1,
                  }));
                }}
                onClear={() => {
                  setAdminEmployeeId("");
                  setAdminProjectId("");
                  setAdminStatusFilter("all");
                  setAdminQuery("");
                  setAdminPagination((current) => ({
                    ...current,
                    page: 1,
                  }));
                }}
              />

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-1 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      Notification feed
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Newest activity appears first.
                    </p>
                  </div>
                  <p className="text-[10px] font-medium text-slate-400">
                    Showing {adminNotifications.length}
                    {adminPagination.total > adminNotifications.length
                      ? " of " + adminPagination.total
                      : ""}{" "}
                    records
                  </p>
                </div>

                {adminLoading && adminNotifications.length === 0 && (
                  <div className="divide-y divide-slate-100">
                    {[0, 1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="flex animate-pulse gap-3 px-4 py-3"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-100" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-1/3 rounded bg-slate-100" />
                          <div className="h-2.5 w-4/5 rounded bg-slate-100" />
                          <div className="h-2 w-1/2 rounded bg-slate-50" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!adminLoading && adminNotifications.length === 0 && (
                  <div className="flex flex-col items-center px-4 py-14 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <Icons.Activity />
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-700">
                      No notifications found
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-slate-400">
                      No activity matches the current search and filters.
                    </p>
                    {(adminQuery ||
                      adminEmployeeId ||
                      adminProjectId ||
                      adminStatusFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdminEmployeeId("");
                          setAdminProjectId("");
                          setAdminStatusFilter("all");
                          setAdminQuery("");
                        }}
                        className="mt-4 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}

                {adminNotifications.length > 0 && (
                  <div className="divide-y divide-slate-100">
                    {adminNotifications.map((notification) => {
                      const actorName = getActorName(notification);
                      const entityLabel = getEntityLabel(notification);
                      const entityName = getEntityName(notification);
                      const projectName = getProjectName(notification);
                      const message = getNotificationMessage(notification);
                      const summary = getNotificationSummary(notification);
                      const isUnread = !notification.isRead;
                      const changes = notification.metadata?.changes;
                      const oldStatus = notification.metadata?.oldStatus;
                      const newStatus = notification.metadata?.newStatus;
                      const oldDueDate = notification.metadata?.oldDueDate;
                      const newDueDate = notification.metadata?.newDueDate;
                      const type = notification.type || "";
                      const NotificationTypeIcon = type.startsWith("task")
                        ? Icons.Tasks
                        : type.startsWith("project")
                          ? Icons.Projects
                          : type.startsWith("sprint")
                            ? Icons.Sprints
                            : type.startsWith("bug")
                              ? Icons.Bug
                              : type.startsWith("team") ||
                                  type.startsWith("user")
                                ? Icons.Employees
                                : Icons.Activity;
                      const iconClass = type.startsWith("task")
                        ? "bg-blue-50 text-blue-600"
                        : type.startsWith("project")
                          ? "bg-violet-50 text-violet-600"
                          : type.startsWith("sprint")
                            ? "bg-amber-50 text-amber-600"
                            : type.startsWith("bug")
                              ? "bg-red-50 text-red-600"
                              : type.startsWith("team") ||
                                  type.startsWith("user")
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-slate-100 text-slate-600";

                      return (
                        <article
                          key={notification._id}
                          className={
                            "group relative px-3 py-3 transition hover:bg-slate-50 sm:px-4 " +
                            (isUnread ? "bg-blue-50/30" : "")
                          }
                        >
                          {isUnread && (
                            <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-blue-500" />
                          )}

                          <div className="flex items-start gap-2.5 sm:gap-3">
                            <div
                              className={
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
                                iconClass
                              }
                            >
                              <NotificationTypeIcon />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {notification.activityType && (
                                      <span
                                        className={
                                          "rounded-full px-1.5 py-0.5 text-[9px] font-bold " +
                                          getActivityClass(
                                            notification.activityType,
                                          )
                                        }
                                      >
                                        {getActivityLabel(
                                          notification.activityType,
                                        )}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                      {entityLabel}
                                    </span>
                                    {isUnread && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    )}
                                  </div>
                                  <h3
                                    className={
                                      "mt-1 break-words text-[13px] leading-5 " +
                                      (isUnread
                                        ? "font-bold text-slate-900"
                                        : "font-semibold text-slate-700")
                                    }
                                  >
                                    {notification.title || "Activity update"}
                                  </h3>
                                </div>

                                <div className="flex shrink-0 items-center gap-2 text-[10px] text-slate-400">
                                  <span
                                    title={new Date(
                                      notification.createdAt,
                                    ).toLocaleString()}
                                  >
                                    {formatTimeAgo(notification.createdAt)}
                                  </span>
                                  {isUnread && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await markAsRead({
                                          notificationId: notification._id,
                                        });
                                        setAdminNotifications((current) =>
                                          current.map((item) =>
                                            item._id === notification._id
                                              ? { ...item, isRead: true }
                                              : item,
                                          ),
                                        );
                                        fetchTabCounts();
                                      }}
                                      title="Mark as read"
                                      aria-label="Mark notification as read"
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-600 transition hover:bg-emerald-50"
                                    >
                                      <Icons.Check />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {message && (
                                <p className="mt-1 break-words text-[11px] leading-4.5 text-slate-500">
                                  {message}
                                </p>
                              )}

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {actorName && (
                                  <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                                    By{" "}
                                    <strong className="font-semibold text-slate-700">
                                      {actorName}
                                    </strong>
                                  </span>
                                )}
                                {entityName && (
                                  <span className="max-w-full rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                                    Item:{" "}
                                    <strong className="font-semibold text-slate-700">
                                      {entityName}
                                    </strong>
                                  </span>
                                )}
                                {projectName && projectName !== entityName && (
                                  <span className="max-w-full rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                                    Project:{" "}
                                    <strong className="font-semibold text-slate-700">
                                      {projectName}
                                    </strong>
                                  </span>
                                )}
                                {changes && (
                                  <span className="max-w-full break-words rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                                    Changes: {String(changes)}
                                  </span>
                                )}
                                {oldStatus && newStatus && (
                                  <span className="rounded-md border border-violet-100 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
                                    {oldStatus} → {newStatus}
                                  </span>
                                )}
                                {(oldDueDate || newDueDate) && (
                                  <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                    Due:{" "}
                                    {newDueDate
                                      ? new Date(
                                          newDueDate,
                                        ).toLocaleDateString()
                                      : "Removed"}
                                  </span>
                                )}
                              </div>

                              {summary && summary !== message && (
                                <p className="mt-1.5 break-words text-[10px] leading-4 text-slate-400">
                                  {summary}
                                </p>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {adminNotifications.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] text-slate-400">
                      Page {adminPagination.page || 1}
                      {adminPagination.totalPages > 0
                        ? " of " + adminPagination.totalPages
                        : ""}
                    </p>

                    {adminPagination.totalPages > adminPagination.page && (
                      <button
                        type="button"
                        onClick={async () => {
                          const nextPage = adminPagination.page + 1;
                          try {
                            setAdminLoading(true);
                            await fetchAdminNotificationsPage({
                              page: nextPage,
                              limit: adminPagination.limit || 20,
                              append: true,
                            });
                          } finally {
                            setAdminLoading(false);
                          }
                        }}
                        disabled={adminLoading}
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        {adminLoading && (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
                        )}
                        {adminLoading ? "Loading..." : "Load more"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
          {activeTab === "clients" && (
            <AdminClientTab
              projects={stats.projects}
              searchRequest={pageSearchRequest}
              draft={clientGroupDraft}
              resumeProject={clientResumeProject}
              onDraftChange={setClientGroupDraft}
              onCreateProject={(draft) => {
                setClientGroupDraft(draft);
                setClientResumeProject(null);
                setProjectCreateRequest({ requestId: Date.now() });
                setActiveTab("projects");
              }}
              onViewProject={(project) => {
                setProjectOpenRequest({
                  projectId: project._id,
                  requestId: Date.now(),
                });
                setActiveTab("projects");
              }}
              onGroupCreated={() => {
                setClientGroupDraft(null);
                setClientResumeProject(null);
              }}
            />
          )}

          {/* Employees  */}
          <KeepAliveTab active={activeTab === "employees"}>
            <EmployeesPage searchRequest={pageSearchRequest} />
          </KeepAliveTab>

          {/* Reports */}
          <KeepAliveTab active={activeTab === "reports"}>
            <ReportsPage
              metrics={{
                total: m.totalTasks,
                done: m.doneTasks,
                inProgress: m.progressTasks,
                todo: m.todoTasks,
                overdue: m.overdueTasks,
                rate: m.completionRate,
              }}
              projects={stats.projects}
              tasks={stats.tasks}
              bugs={stats.bugs}
              employeeReportRequest={employeeReportRequest}
            />
          </KeepAliveTab>

          {/* TASKS TAB  */}
          {/* {activeTab === "tasks" && <TasksPage />} */}
          <KeepAliveTab active={activeTab === "tasks"}>
            <TasksPage onTaskUpdated={fetchStats} />
          </KeepAliveTab>

          {/* BUGS TAB (uses shared page) */}
          <KeepAliveTab active={activeTab === "bugs"}>
            <BugReportPage searchRequest={pageSearchRequest} />
          </KeepAliveTab>

          {/* Guide & FAQ */}
          {activeTab === "guideFaq" && (
            <div className="w-full">
              <RoleGuideFaq />
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-5xl space-y-5">
              <RoleSettingsView
                user={user}
                roleSettings={ROLE_SETTINGS_CONFIG["ADMIN"]}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
