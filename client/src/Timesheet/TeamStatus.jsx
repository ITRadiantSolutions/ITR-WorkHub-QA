import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icons from "../components/Icons";

const RANGE_OPTIONS = [
  // This Week / Last Week disabled — the grid defaults to This Month.
  // { value: "this_week", label: "This Week" },
  // { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "custom", label: "Custom Range" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);
// Custom range can't reach into the future or span more than 6 months —
// mirrors the clamp the server applies, so the pickers never offer a value
// the API would reject.
const addMonthsISO = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "submitted", label: "Submitted" },
  { value: "needs_edit", label: "Needs Edit" },
  { value: "rejected", label: "Rejected" },
  { value: "not_submitted", label: "Not submitted" },
];

const STATUS_DOT = {
  approved: "bg-emerald-500",
  submitted: "bg-orange-400",
  needs_edit: "bg-amber-500",
  rejected: "bg-red-500",
  draft: "bg-slate-300",
  not_submitted: "bg-slate-300",
};

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-green-100 text-green-700",
  "bg-teal-100 text-teal-700",
  "bg-lime-100 text-lime-700",
  "bg-emerald-200 text-emerald-800",
  "bg-green-200 text-green-800",
  "bg-teal-200 text-teal-800",
  "bg-lime-200 text-lime-800",
];
const colorFor = (str) => AVATAR_COLORS[Math.abs([...(str || "")].reduce((h, c) => h * 31 + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];
const initialsFor = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

export default function TeamStatus() {
  const { user } = useAuth();
  const [statusRange, setStatusRange] = useState("this_month");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statusGrid, setStatusGrid] = useState({ weeks: [], rows: [] });
  const [statusLoading, setStatusLoading] = useState(false);
  const [expandedStatusRow, setExpandedStatusRow] = useState(null);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Seed the custom pickers with the current month the first time "Custom
  // Range" is selected, so the two date inputs never start out empty.
  useEffect(() => {
    if (statusRange !== "custom" || customStart || customEnd) return;
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    setCustomStart(start.toISOString().slice(0, 10));
    setCustomEnd(end.toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusRange]);

  useEffect(() => {
    if (statusRange === "custom" && (!customStart || !customEnd)) return;
    let cancelled = false;
    setStatusLoading(true);
    const params =
      statusRange === "custom"
        ? { startDate: customStart, endDate: customEnd, status: statusFilter }
        : { range: statusRange, status: statusFilter };
    API.get("/hr/timesheet-status", { params })
      .then((res) => !cancelled && setStatusGrid(res.data || { weeks: [], rows: [] }))
      .catch(() => toast.error("Failed to load team timesheet status"))
      .finally(() => !cancelled && setStatusLoading(false));
    return () => {
      cancelled = true;
    };
  }, [statusRange, statusFilter, customStart, customEnd]);

  useEffect(() => setPage(1), [statusRange, statusFilter, customStart, customEnd, rowsPerPage]);

  const totalRows = statusGrid.rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const pageRows = useMemo(
    () => statusGrid.rows.slice((page - 1) * rowsPerPage, page * rowsPerPage),
    [statusGrid.rows, page, rowsPerPage]
  );

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm shrink-0">
            <Icons.Users />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Team Timesheet Status</h1>
            <p className="text-sm text-slate-500">
              Submission status per week for {user?.roles?.timesheet === "hr" ? "everyone" : "your direct reports"}
              {statusGrid.weeks.length > 0 && (
                <span className="text-slate-400"> · {statusGrid.weeks.length} week{statusGrid.weeks.length === 1 ? "" : "s"}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none rounded-[14px] border border-slate-200 bg-white pl-8 pr-8 py-2.5 text-sm font-semibold text-slate-700 shadow-sm cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <span className={`block w-2.5 h-2.5 rounded-full ${STATUS_DOT[statusFilter] || "bg-slate-300"}`} />
            </span>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icons.ChevronDown />
            </span>
          </div>

          <div className="relative">
            <select
              value={statusRange}
              onChange={(e) => setStatusRange(e.target.value)}
              className="appearance-none rounded-[14px] border border-slate-200 bg-white pl-9 pr-8 py-2.5 text-sm font-semibold text-slate-700 shadow-sm cursor-pointer"
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icons.Calendar />
            </span>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icons.ChevronDown />
            </span>
          </div>

          {statusRange === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                max={customEnd || todayISO()}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm"
              />
              <span className="text-slate-400 text-sm">–</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={customStart ? (addMonthsISO(customStart, 6) < todayISO() ? addMonthsISO(customStart, 6) : todayISO()) : todayISO()}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm"
              />
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[20px] border border-slate-200 shadow-[0_4px_20px_rgba(15,23,42,0.06)] overflow-hidden">
        {statusLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading...</div>
        ) : !totalRows ? (
          <div className="py-16 text-center text-slate-400 text-sm">No matching employees for this filter.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-white text-left px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap border-r border-slate-100">Employee</th>
                    {statusGrid.weeks.map((w, i) => (
                      <th key={w.weekStart} className="px-1.5 py-1.5 align-middle">
                        <div className="mx-auto flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 whitespace-nowrap">
                          <span className="text-slate-400 shrink-0"><Icons.Calendar /></span>
                          <span className="text-left leading-tight">
                            <span className="block text-[11px] font-bold text-slate-600">
                              {new Date(w.weekStart).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              {" – "}
                              {new Date(w.weekEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </span>
                            <span className="block text-[10px] font-semibold text-slate-400">Week {i + 1}</span>
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const weekEntries = Object.entries(row.weeks);
                    const missing = weekEntries.filter(([, w]) => w.status === "not_submitted");
                    const isExpanded = expandedStatusRow === row.userId;
                    return (
                      <Fragment key={row.userId}>
                        <tr className="group border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                          <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50/60 px-6 py-2 border-r border-slate-100 transition-colors">
                            <button
                              onClick={() => setExpandedStatusRow(isExpanded ? null : row.userId)}
                              className="flex items-center gap-2.5 text-left"
                            >
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${colorFor(row.userName)}`}>
                                {initialsFor(row.userName)}
                              </span>
                              <span className="whitespace-nowrap">
                                <span className="text-sm font-bold text-slate-800 hover:text-teal-700">{row.userName}</span>
                                {missing.length > 0 && (
                                  <span className="ml-2 text-xs font-bold text-red-500">({missing.length} missing)</span>
                                )}
                              </span>
                            </button>
                          </td>
                          {weekEntries.map(([weekStart, w]) => (
                            <td key={weekStart} className="px-2 py-2 text-center">
                              <span
                                className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[w.status] || "bg-slate-200"}`}
                                title={`${weekStart}: ${w.status.replace("_", " ")} (${w.total.toFixed(1)}h)`}
                              />
                            </td>
                          ))}
                        </tr>
                        {isExpanded && (
                          <tr key={`${row.userId}-detail`} className="bg-slate-50/60">
                            <td colSpan={weekEntries.length + 1} className="px-6 py-2">
                              <div className="flex flex-wrap gap-2">
                                {weekEntries.map(([weekStart, w]) => (
                                  <span
                                    key={weekStart}
                                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      w.status === "not_submitted" ? "bg-red-50 text-red-600" : "bg-white border border-slate-200 text-slate-600"
                                    }`}
                                  >
                                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[w.status] || "bg-slate-200"}`} />
                                    {new Date(weekStart).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} — {w.status.replace("_", " ")}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 flex-wrap gap-3">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, totalRows)} of {totalRows} employees
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                >
                  <Icons.Back />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(0, 7)
                  .map((n) => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-8 h-8 rounded-lg text-sm font-semibold ${
                        n === page ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                {totalPages > 7 && <span className="px-1 text-slate-400">…</span>}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                >
                  <Icons.Arrow />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="font-medium">Rows per page</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700"
                >
                  {ROWS_PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
