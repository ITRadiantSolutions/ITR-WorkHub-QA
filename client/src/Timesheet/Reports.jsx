import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "../components/Icons";

const PAGE_SIZE = 10;

const PERIODS = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_6_months", label: "Last 6 Months" },
];

const STATUSES = [
  { value: "all", label: "All Status" },
  { value: "approved", label: "Approved" },
  { value: "submitted", label: "Submitted & Not Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "needs_edit", label: "Needs Edit" },
  { value: "not_submitted", label: "Not submitted" },
];

const VIEWS = [
  { key: "employees", label: "Employees", icon: "Users" },
  { key: "projects", label: "Projects", icon: "Folder" },
];

const EMPLOYEE_COLUMNS = [
  { key: "userName", label: "Employee", align: "left" },
  { key: "totalHours", label: "Total Hours", align: "right" },
  { key: "projectCount", label: "Projects", align: "right" },
  { key: "avgPerDay", label: "Avg/Day", align: "right" },
  { key: "nsaDays", label: "NSA", align: "right" },
  { key: "weeksCount", label: "Weeks", align: "right" },
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

export default function Reports() {
  const [view, setView] = useState("employees");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("last_week");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState({ key: "totalHours", dir: "desc" });
  const [page, setPage] = useState(1);

  const [employees, setEmployees] = useState([]);
  const [totals, setTotals] = useState({ totalEmployees: 0, totalHours: 0, totalProjects: 0, totalNsaDays: 0 });
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      API.get("/hr/employee-report", { params: { range: period, status } }),
      API.get("/hr/project-summary", { params: { range: period, status } }),
      API.get("/projects"),
    ])
      .then(([empRes, projSummaryRes, projRes]) => {
        setEmployees(empRes.data.employees || []);
        setTotals(empRes.data.totals || {});
        const hoursByProject = new Map((projSummaryRes.data || []).map((p) => [p.projectId, p.totalHours]));
        setProjects(
          (projRes.data || []).map((p) => ({
            projectId: p._id,
            name: p.name,
            employeeCount: p.teamMembers?.length || 0,
            totalHours: hoursByProject.get(p._id) || 0,
          })),
        );
      })
      .catch(() => toast.error("Failed to load report"))
      .finally(() => setLoading(false));
  }, [period, status]);

  useEffect(() => setPage(1), [view, search, period, status]);

  const onSort = (key) => setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? employees.filter((e) => e.userName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) : employees;
    const sorted = [...rows].sort((a, b) => {
      const cmp = typeof a[sort.key] === "string" ? a[sort.key].localeCompare(b[sort.key]) : a[sort.key] - b[sort.key];
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
  const columns = view === "employees" ? EMPLOYEE_COLUMNS : PROJECT_COLUMNS;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportAll = async () => {
    try {
      const res = await API.get("/hr/report/export", { params: { range: period, status }, responseType: "blob" });
      downloadBlob(res.data, "timesheet-report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch {
      toast.error("Failed to export report");
    }
  };

  const exportProject = async (projectId, name) => {
    try {
      const res = await API.get("/hr/project-report/download", { params: { projectId, range: period, status }, responseType: "blob" });
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
          <p className="text-sm text-slate-500">Employee time analytics & project overview</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-slate-100 border-l-4 border-l-teal-500 shadow-sm p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <Icons.Users /> <span className="text-xs font-bold uppercase tracking-wide">Total Employees</span>
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
                  {columns.map((c) => <SortHeader key={c.key} col={c} sort={sort} onSort={onSort} />)}
                  {view === "projects" && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {view === "employees"
                  ? pageItems.map((e) => (
                      <tr key={e.userId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full ${colorFor(e.userName)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                              {initialsOf(e.userName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{e.userName}</p>
                              <p className="text-xs text-slate-400 truncate">{e.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">{e.totalHours}</td>
                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{e.projectCount}</td>
                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{e.avgPerDay}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${e.nsaDays > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                            {e.nsaDays}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{e.weeksCount}</td>
                      </tr>
                    ))
                  : pageItems.map((p) => (
                      <tr key={p.projectId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
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
                          <button onClick={() => exportProject(p.projectId, p.name)} className="text-slate-400 hover:text-teal-600" title="Download project report">
                            <Icons.Download />
                          </button>
                        </td>
                      </tr>
                    ))}
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
    </main>
  );
}
