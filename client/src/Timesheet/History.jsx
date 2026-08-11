import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "../components/Icons";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TABS = [
  { key: "submitted", label: "Pending", icon: "Clock" },
  { key: "approved", label: "Approved", icon: "CheckCircle" },
  { key: "rejected", label: "Rejected", icon: "X" },
  { key: "needs_edit", label: "Modifications", icon: "Edit" },
];

const STATUS_STYLES = {
  submitted: { badge: "bg-amber-100 text-amber-800" },
  approved: { badge: "bg-emerald-100 text-emerald-800" },
  rejected: { badge: "bg-red-100 text-red-800" },
  needs_edit: { badge: "bg-amber-100 text-amber-800" },
  draft: { badge: "bg-slate-100 text-slate-700" },
};

const fmtShort = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const fmtDateTime = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-");

const PAGE_SIZE_OPTIONS = [9, 18, 27, 36];

// Read-only — "View" (submitted/approved weeks) opens this instead of
// navigating away, so the History page (tab/page/scroll) never has to
// unmount. "Edit" (needs_edit/rejected) still navigates to the full
// Timesheet page below, since editing needs the full save/submit toolset.
function ViewTimesheetModal({ timesheet, onClose }) {
  const style = STATUS_STYLES[timesheet.status] || STATUS_STYLES.draft;
  const rows = timesheet.rows || [];
  const grandTotal = rows.reduce((sum, r) => sum + (r.secs || []).reduce((s, v) => s + (v || 0), 0), 0) / 3600;
  const comments = rows.filter((r) => r.comment?.trim());

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Week {fmtShort(timesheet.weekStart)} – {fmtShort(timesheet.weekEnd)}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Submitted {fmtDateTime(timesheet.submittedAt)} · Action by: {timesheet.managerActionBy?.name || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${style.badge}`}>
              {timesheet.status.replace(/_/g, " ")}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icons.X /></button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="text-left px-3 py-2 font-bold uppercase tracking-wide">Project</th>
                {DAY_LABELS.map((d) => (
                  <th key={d} className="px-2 py-2 font-bold uppercase tracking-wide text-center">{d}</th>
                ))}
                <th className="px-2 py-2 font-bold uppercase tracking-wide text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const total = (row.secs || []).reduce((sum, s) => sum + (s || 0), 0) / 3600;
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{row.projectId?.name || "Project"}</td>
                    {(row.secs || Array(7).fill(0)).map((s, d) => (
                      <td key={d} className="px-2 py-2 text-center tabular-nums text-slate-600">
                        {s ? (s / 3600).toFixed(1) : "—"}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-bold text-teal-700 tabular-nums">{total.toFixed(1)}</td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">No entries logged.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end mt-3">
          <span className="text-sm font-bold text-slate-800">
            Week total: <span className="text-teal-700 tabular-nums">{grandTotal.toFixed(1)}h</span>
          </span>
        </div>

        {comments.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Comments</p>
            {comments.map((r, i) => (
              <p key={i} className="text-xs text-slate-600">
                <span className="font-semibold">{r.projectId?.name || "Project"}:</span> {r.comment}
              </p>
            ))}
          </div>
        )}

        {timesheet.managerComment && (
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wide text-slate-400">Reviewer note: </span>
            {timesheet.managerComment}
          </p>
        )}
      </div>
    </div>
  );
}

// Clicking "View"/"Edit" navigates away and unmounts this component — coming
// back (browser back or the sidebar link) remounts it from scratch, so plain
// useState would always reset to tab 1 / page "submitted". Persisting the
// view (not the fetched data — that's refetched fresh) across that remount.
const VIEW_STATE_KEY = "timesheet_history_view";
const loadViewState = () => {
  try {
    return JSON.parse(sessionStorage.getItem(VIEW_STATE_KEY) || "null") || {};
  } catch {
    return {};
  }
};

export default function History() {
  const navigate = useNavigate();
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => loadViewState().tab || "submitted");
  const [page, setPage] = useState(() => loadViewState().page || 1);
  const [pageSize, setPageSize] = useState(() => loadViewState().pageSize || 9);
  const [restoringPage, setRestoringPage] = useState(true);
  const [viewingTs, setViewingTs] = useState(null);

  useEffect(() => {
    API.get("/timesheets")
      .then((res) => setTimesheets(res.data || []))
      .catch(() => toast.error("Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    sessionStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ tab, page, pageSize }));
  }, [tab, page, pageSize]);

  // Skip the very first "tab/pageSize changed" reset-to-page-1 — it fires on
  // mount from the restored values and would immediately undo them.
  useEffect(() => {
    if (restoringPage) {
      setRestoringPage(false);
      return;
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, pageSize]);

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = timesheets.filter((ts) => ts.status === t.key).length;
    return acc;
  }, {});

  const filtered = timesheets
    .filter((ts) => ts.status === tab)
    .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
          <Icons.Clock />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">My Submitted Timesheets</h2>
          <p className="text-sm text-slate-500">Track approvals and revisit past weeks</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 w-fit flex-wrap">
        {TABS.map((t) => {
          const Icon = Icons[t.icon];
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {Icon ? <Icon /> : null}
              {t.label}
              <span className={`text-xs rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center font-bold ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                {counts[t.key] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : !filtered.length ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-3">
            <Icons.Empty />
          </div>
          <p className="text-slate-500 font-medium">No timesheets in this category.</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((ts) => {
            const style = STATUS_STYLES[ts.status] || STATUS_STYLES.draft;
            const canEdit = ts.status === "needs_edit" || ts.status === "rejected";
            return (
              <div key={ts._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-bold text-slate-800 text-sm leading-snug">
                    Week {fmtShort(ts.weekStart)} – {fmtShort(ts.weekEnd)}
                  </p>
                  <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${style.badge}`}>
                    {ts.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Submitted {fmtDateTime(ts.submittedAt)}
                  <br />
                  Action by: {ts.managerActionBy?.name || "—"}
                </p>
                <button
                  onClick={() => {
                    if (canEdit) {
                      toast.info("You can now edit this week's timesheet and save your changes.");
                      navigate(`/timesheet/new/${ts._id}`);
                    } else {
                      setViewingTs(ts);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition"
                >
                  {canEdit ? <>Edit <Icons.Edit /></> : <>View <Icons.ChevronRight /></>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-slate-500">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
              >
                <Icons.Back />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition ${
                    p === page ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
              >
                <Icons.ChevronRight />
              </button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </div>
        </div>
        </>
      )}

      {viewingTs && <ViewTimesheetModal timesheet={viewingTs} onClose={() => setViewingTs(null)} />}
    </main>
  );
}
