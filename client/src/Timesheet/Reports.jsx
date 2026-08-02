import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "../components/Icons";
import { useAuth } from "../context/AuthContext";

const PAGE_SIZE = 10;

const PERIODS = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "custom", label: "Custom Range" },
];

const STATUSES = [
  { value: "all", label: "All Status" },
  { value: "approved", label: "Approved" },
  { value: "submitted", label: "Submitted & Not Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "needs_edit", label: "Needs Edit" },
  { value: "not_submitted", label: "Not submitted" },
];

const STATUS_WEEK_LABEL = {
  all: "Weeks",
  approved: "Approved Weeks",
  submitted: "Submitted Weeks",
  rejected: "Rejected Weeks",
  needs_edit: "Needs-Edit Weeks",
  not_submitted: "Weeks",
};

const VIEWS = [
  { key: "employees", label: "Employees", icon: "Users" },
  { key: "projects", label: "Projects", icon: "Folder" },
];

const PROJECT_COLUMNS = [
  { key: "name", label: "Project", align: "left" },
  { key: "employeeCount", label: "Employees", align: "right" },
  { key: "totalHours", label: "Total Hours", align: "right" },
];

const AVATAR_COLORS = ["bg-indigo-600", "bg-slate-600", "bg-blue-600", "bg-teal-600", "bg-cyan-700", "bg-sky-700"];
const colorFor = (str) => AVATAR_COLORS[Math.abs([...(str || "")].reduce((h, c) => h * 31 + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
const initialsOf = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function downloadBlob(data, filename, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(escape).join(",")).join("\n");
}

function SortHeader({ col, sort, onSort }) {
  const active = sort.key === col.key;
  return (
    <th className={`px-4 py-3 font-bold text-slate-500 text-xs uppercase tracking-wide ${col.align === "right" ? "text-right" : "text-left"}`}>
      <button onClick={() => onSort(col.key)} className={`inline-flex items-center gap-1 hover:text-slate-800 ${active ? "text-teal-600" : ""}`}>
        {col.label}
        <span className="text-[10px]">{active ? (sort.dir === "desc" ? "↓" : "↑") : "↕"}</span>
      </button>
    </th>
  );
}

const STATUS_BADGE = {
  approved: "bg-emerald-100 text-emerald-700",
  submitted: "bg-orange-100 text-orange-700",
  needs_edit: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  draft: "bg-slate-100 text-slate-600",
};

function EmployeeDrilldown({ userId, onClose, dateParams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    API.get(`/hr/user-report/${userId}`, { params: dateParams })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load employee report"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Week Start", "Week End", "Status", "Total Hours", "Projects"],
      ...data.weeklyDetail.map((w) => [
        w.weekStart.slice(0, 10),
        w.weekEnd.slice(0, 10),
        w.status,
        w.totalHours,
        w.projects.map((p) => `${p.projectName} (${p.hours}h)`).join("; "),
      ]),
    ];
    downloadBlob(toCsv(rows), `${data.employee.userName || "employee"}-report.csv`, "text/csv");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">{data?.employee?.userName || "Employee Report"}</h3>
            {data && (
              <p className="text-xs text-slate-500">
                {data.employee.email} {data.employee.managerName ? `· Manager: ${data.employee.managerName}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">
                <Icons.Download /> Export CSV
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">
              <Icons.X />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : !data ? (
          <div className="p-12 text-center text-slate-500">No data.</div>
        ) : (
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Total Hours", value: data.totalHours },
                { label: "Projects", value: data.totalProjects },
                { label: "Weeks", value: data.totalWeeks },
                { label: "Avg/Day", value: data.avgHoursPerDay },
                { label: "NSA Days", value: data.nsaCount },
                { label: "Approval %", value: data.approvalRate != null ? `${data.approvalRate}%` : "—" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{kpi.label}</p>
                  <p className="text-lg font-extrabold text-slate-900 tabular-nums">{kpi.value}</p>
                </div>
              ))}
            </div>

            {data.projectBreakdown.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Project Breakdown</h4>
                <div className="space-y-1.5">
                  {data.projectBreakdown
                    .slice()
                    .sort((a, b) => b.totalHours - a.totalHours)
                    .map((p) => {
                      const pct = data.totalHours ? Math.round((p.totalHours / data.totalHours) * 100) : 0;
                      return (
                        <div key={p.projectId} className="flex items-center gap-3 text-sm">
                          <span className="w-32 truncate text-slate-700 font-medium">{p.projectName}</span>
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-16 text-right tabular-nums text-slate-600">{p.totalHours}h</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Weekly Detail</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="px-3 py-2 text-left font-bold text-slate-500 text-xs uppercase">Week</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 text-xs uppercase">Status</th>
                      <th className="px-3 py-2 text-right font-bold text-slate-500 text-xs uppercase">Hours</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 text-xs uppercase">Projects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeklyDetail.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-400">No weeks in range.</td>
                      </tr>
                    ) : (
                      data.weeklyDetail
                        .slice()
                        .reverse()
                        .map((w) => (
                          <tr key={w.weekStart} className="border-b border-slate-50 last:border-0">
                            <td className="px-3 py-2 text-slate-700">{w.weekStart.slice(0, 10)} – {w.weekEnd.slice(0, 10)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[w.status] || "bg-slate-100 text-slate-600"}`}>
                                {w.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">{w.totalHours}</td>
                            <td className="px-3 py-2 text-slate-600">{w.projects.map((p) => p.projectName).join(", ") || "—"}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const isHr = user?.roles?.timesheet === "hr";

  const [view, setView] = useState("employees");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("last_week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState({ key: "totalHours", dir: "desc" });
  const [page, setPage] = useState(1);

  const [employees, setEmployees] = useState([]);
  const [totals, setTotals] = useState({ totalEmployees: 0, totalHours: 0, totalProjects: 0, totalNsaDays: 0 });
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState(null);
  const [drilldownUserId, setDrilldownUserId] = useState(null);

  const dateParams = useMemo(() => {
    if (period === "custom") {
      const p = {};
      if (customStart) p.startDate = customStart;
      if (customEnd) p.endDate = customEnd;
      return p;
    }
    return { range: period };
  }, [period, customStart, customEnd]);

  useEffect(() => {
    if (period === "custom" && (!customStart || !customEnd)) return;
    setLoading(true);
    Promise.all([
      API.get("/hr/employee-report", { params: { ...dateParams, status } }),
      API.get("/hr/project-summary", { params: { ...dateParams, status } }),
      API.get("/projects"),
    ])
      .then(([empRes, projSummaryRes, projRes]) => {
        setEmployees(empRes.data.employees || []);
        setTotals(empRes.data.totals || {});
        const summaryByProject = new Map((projSummaryRes.data || []).map((p) => [p.projectId, p]));
        setProjects(
          (projRes.data || []).map((p) => ({
            projectId: p._id,
            name: p.name,
            employeeCount: p.teamMembers?.length || 0,
            totalHours: summaryByProject.get(p._id)?.totalHours || 0,
            members: summaryByProject.get(p._id)?.members || [],
          })),
        );
      })
      .catch(() => toast.error("Failed to load report"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, status, customStart, customEnd]);

  useEffect(() => setPage(1), [view, search, period, status]);

  const onSort = (key) => setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const employeeColumns = useMemo(() => {
    const cols = [{ key: "userName", label: "Employee", align: "left" }];
    if (isHr) cols.push({ key: "managerName", label: "Manager", align: "left" });
    cols.push(
      { key: "totalHours", label: "Total Hours", align: "right" },
      { key: "projectCount", label: "Projects", align: "right" },
      { key: "avgPerDay", label: "Avg/Day", align: "right" },
      { key: "nsaDays", label: "NSA", align: "right" },
      { key: "weeksCount", label: STATUS_WEEK_LABEL[status] || "Weeks", align: "right" },
      { key: "approvalRate", label: "Approval %", align: "right" },
    );
    return cols;
  }, [isHr, status]);

  const employeeCell = (e, key) => {
    switch (key) {
      case "userName":
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full ${colorFor(e.userName)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
              {initialsOf(e.userName)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 truncate">{e.userName}</p>
              <p className="text-xs text-slate-400 truncate">{e.email}</p>
            </div>
          </div>
        );
      case "managerName":
        return <span className="text-slate-600">{e.managerName || "—"}</span>;
      case "totalHours":
        return <span className="font-bold text-slate-800 tabular-nums">{e.totalHours}</span>;
      case "projectCount":
        return <span className="text-slate-600 tabular-nums">{e.projectCount}</span>;
      case "avgPerDay":
        return <span className="text-slate-600 tabular-nums">{e.avgPerDay}</span>;
      case "nsaDays":
        return (
          <span className={`inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${e.nsaDays > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
            {e.nsaDays}
          </span>
        );
      case "weeksCount":
        return <span className="text-slate-600 tabular-nums">{e.weeksCount}</span>;
      case "approvalRate":
        return <span className="text-slate-600 tabular-nums">{e.approvalRate != null ? `${e.approvalRate}%` : "—"}</span>;
      default:
        return null;
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? employees.filter((e) => e.userName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) : employees;
    const sorted = [...rows].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : (av ?? -1) - (bv ?? -1);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [employees, search, sort]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
    const sorted = [...rows].sort((a, b) => {
      const cmp = typeof a[sort.key] === "string" ? a[sort.key].localeCompare(b[sort.key]) : (a[sort.key] ?? 0) - (b[sort.key] ?? 0);
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [projects, search, sort]);

  const items = view === "employees" ? filteredEmployees : filteredProjects;
  const columns = view === "employees" ? employeeColumns : PROJECT_COLUMNS;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportAll = async () => {
    try {
      const res = await API.get("/hr/report/export", { params: { ...dateParams, status }, responseType: "blob" });
      downloadBlob(res.data, "timesheet-report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch {
      toast.error("Failed to export report");
    }
  };

  const exportProject = async (projectId, name) => {
    try {
      const res = await API.get("/hr/project-report/download", { params: { projectId, ...dateParams, status }, responseType: "blob" });
      downloadBlob(res.data, `${name || "project"}-report.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch {
      toast.error("Failed to export project report");
    }
  };

  return (
    <main className="w-[92%] max-w-[1600px] mx-auto px-2 py-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm shrink-0">
          <Icons.TrendUp />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500">
            {isHr ? "Employee time analytics & project overview" : "Your team's time analytics & project overview"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-teal-500 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Icons.Users /> <span className="text-xs font-bold uppercase tracking-wide">{isHr ? "Total Employees" : "Team Members"}</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{totals.totalEmployees || 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">Active in period</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-emerald-500 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Icons.Clock /> <span className="text-xs font-bold uppercase tracking-wide">Total Hours</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{(totals.totalHours || 0).toFixed(0)}</p>
          <p className="text-xs text-slate-400 mt-0.5">Across all employees</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-emerald-500 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Icons.Folder /> <span className="text-xs font-bold uppercase tracking-wide">Projects</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{totals.totalProjects || 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">Distinct projects</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-amber-500 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Icons.Alert /> <span className="text-xs font-bold uppercase tracking-wide">NSA</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{totals.totalNsaDays || 0}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total days</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 w-fit">
        {VIEWS.map((v) => {
          const Icon = Icons[v.icon];
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${view === v.key ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon /> {v.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${view}...`}
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          />
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold bg-white">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {period === "custom" && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
            />
          </>
        )}
        {view === "employees" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold bg-white">
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
        <span className="text-sm text-slate-500 font-medium">{items.length} {view}</span>
        <button onClick={exportAll} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-sm">
          <Icons.Download /> Export Excel
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : !pageItems.length ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-500">No results.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {view === "projects" && <th className="px-2 py-3 w-8" />}
                  {columns.map((c) => <SortHeader key={c.key} col={c} sort={sort} onSort={onSort} />)}
                  {view === "projects" && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {view === "employees"
                  ? pageItems.map((e) => (
                      <tr
                        key={e.userId}
                        onClick={() => setDrilldownUserId(e.userId)}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40 cursor-pointer"
                      >
                        {employeeColumns.map((c) => (
                          <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right" : "text-left"}`}>
                            {employeeCell(e, c.key)}
                          </td>
                        ))}
                      </tr>
                    ))
                  : pageItems.map((p) => {
                      const expanded = expandedProject === p.projectId;
                      return (
                        <Fragment key={p.projectId}>
                          <tr
                            onClick={() => setExpandedProject(expanded ? null : p.projectId)}
                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40 cursor-pointer"
                          >
                            <td className="px-2 py-3 text-slate-400">
                              {expanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full ${colorFor(p.name)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                                  {initialsOf(p.name)}
                                </div>
                                <span className="font-semibold text-slate-800">{p.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{p.employeeCount}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">{p.totalHours.toFixed(1)}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  exportProject(p.projectId, p.name);
                                }}
                                className="text-slate-400 hover:text-teal-600"
                                title="Download project report"
                              >
                                <Icons.Download />
                              </button>
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="bg-slate-50/60 border-b border-slate-100">
                              <td colSpan={5} className="px-6 py-4">
                                {p.members.length === 0 ? (
                                  <p className="text-sm text-slate-400">No team members on this project.</p>
                                ) : (
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-slate-400 text-xs uppercase font-bold">
                                        <th className="py-1.5 pr-4">Member</th>
                                        <th className="py-1.5 pr-4">Email</th>
                                        <th className="py-1.5 text-right">Hours</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.members.map((m) => (
                                        <tr key={m.userId} className="border-t border-slate-100">
                                          <td className="py-1.5 pr-4 font-medium text-slate-700">{m.userName}</td>
                                          <td className="py-1.5 pr-4 text-slate-500">{m.email}</td>
                                          <td className="py-1.5 text-right tabular-nums text-slate-700">{m.hours}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 flex-wrap gap-3">
            <p className="text-sm text-slate-500">
              Showing {items.length ? (page - 1) * PAGE_SIZE + 1 : 0} to {Math.min(page * PAGE_SIZE, items.length)} of {items.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                <Icons.Back />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold ${n === page ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {n}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                <Icons.Arrow />
              </button>
            </div>
          </div>
        </div>
      )}

      {drilldownUserId && (
        <EmployeeDrilldown userId={drilldownUserId} dateParams={{ ...dateParams, status }} onClose={() => setDrilldownUserId(null)} />
      )}
    </main>
  );
}
