import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "../components/Icons";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAGE_SIZE = 10;

const TABS = [
  { key: "submitted", label: "Submitted" },
  { key: "needs_edit", label: "Needs Edit" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const STATUS_STYLES = {
  submitted: "bg-emerald-100 text-emerald-700",
  needs_edit: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  draft: "bg-slate-100 text-slate-600",
};

const fmtShort = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-");
const hasNsa = (ts) => (ts.rows || []).some((r) => (r.nsa || []).some(Boolean));

function ReasonModal({ action, count, onCancel, onConfirm }) {
  const [comment, setComment] = useState("");
  const label = action === "reject" ? "Reject" : "Request Edit";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">{label} {count > 1 ? `${count} timesheets` : "timesheet"}</h3>
        <p className="text-sm text-slate-500 mb-4">This reason is included in the email sent to the employee.</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Explain what needs to change..."
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
        />
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => comment.trim() && onConfirm(comment.trim())}
            disabled={!comment.trim()}
            className={`px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${action === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"}`}
          >
            Confirm {label}
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-slate-500 text-sm font-semibold hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Review() {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("submitted");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(new Set());
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null); // { ids, action }
  const [busyIds, setBusyIds] = useState(new Set());

  const load = () => {
    setLoading(true);
    API.get("/timesheets/manager")
      .then((res) => setTimesheets(res.data || []))
      .catch(() => toast.error("Failed to load timesheets for review"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = t.key === "all" ? timesheets.length : timesheets.filter((ts) => ts.status === t.key).length;
    return acc;
  }, {});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return timesheets
      .filter((ts) => tab === "all" || ts.status === tab)
      .filter((ts) => !q || ts.userId?.name?.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.submittedAt || b.weekStart) - new Date(a.submittedAt || a.weekStart));
  }, [timesheets, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageActionableIds = pageRows.filter((ts) => ts.status === "submitted").map((ts) => ts._id);
  const allPageSelected = pageActionableIds.length > 0 && pageActionableIds.every((id) => selected.has(id));

  useEffect(() => setPage(1), [tab, search]);
  useEffect(() => setSelected(new Set()), [tab, search, page]);

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelected = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAllPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageActionableIds.forEach((id) => next.delete(id));
      else pageActionableIds.forEach((id) => next.add(id));
      return next;
    });

  const actionVerb = (action) => (action === "approve" ? "approved" : action === "reject" ? "rejected" : "sent back for edits");

  const runAction = async (ids, action, comment) => {
    setBusyIds(new Set(ids));
    try {
      if (ids.length === 1) {
        await API.post(`/timesheets/${ids[0]}/${action}`, comment ? { comment } : {});
        toast.success(`Timesheet ${actionVerb(action)}`);
      } else {
        const res = await API.post("/timesheets/bulk-action", { ids, action, comment });
        const failed = (res.data.results || []).filter((r) => !r.ok);
        if (failed.length) toast.error(`${failed.length} of ${ids.length} couldn't be updated (${failed[0].message})`);
        if (failed.length < ids.length) toast.success(`${ids.length - failed.length} timesheet(s) ${actionVerb(action)}`);
      }
      setModal(null);
      setSelected(new Set());
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update timesheet(s)");
    } finally {
      setBusyIds(new Set());
    }
  };

  return (
    <main className="w-[92%] max-w-[1600px] mx-auto px-2 py-8">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-extrabold text-slate-900">Timesheets for Review</h2>
        <div className="relative w-full sm:w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === t.key ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
            <span className={`text-xs rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center font-bold ${tab === t.key ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
              {counts[t.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-4 bg-teal-50 border border-teal-100 rounded-2xl px-4 py-2.5 flex-wrap">
          <span className="text-sm font-semibold text-teal-700">{selected.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => runAction([...selected], "approve")}
            disabled={busyIds.size > 0}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve Selected
          </button>
          <button
            onClick={() => setModal({ ids: [...selected], action: "reject" })}
            disabled={busyIds.size > 0}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
          >
            Reject Selected
          </button>
          <button
            onClick={() => setModal({ ids: [...selected], action: "needs_edit" })}
            disabled={busyIds.size > 0}
            className="px-3 py-1.5 rounded-lg border-2 border-amber-400 text-amber-600 text-xs font-bold hover:bg-amber-50 disabled:opacity-50"
          >
            Request Edit
          </button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg text-slate-500 text-xs font-semibold hover:bg-white">
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : !pageRows.length ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-500">Nothing here.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-teal-50/60 border-b border-slate-100">
                  <th className="w-8 px-2">
                    {pageActionableIds.length > 0 && (
                      <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllPage} className="accent-teal-600" />
                    )}
                  </th>
                  <th className="w-8" />
                  <th className="text-left px-3 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">NSA</th>
                  <th className="text-left px-3 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Employee</th>
                  <th className="text-left px-3 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Week Start</th>
                  <th className="text-left px-3 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Week End</th>
                  <th className="text-left px-3 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-3 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Submitted At</th>
                  <th className="text-left px-3 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Comment</th>
                  <th className="text-left px-3 py-3 font-bold text-slate-600 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((ts) => {
                  const actionable = ts.status === "submitted";
                  const isExpanded = expanded.has(ts._id);
                  return (
                    <Fragment key={ts._id}>
                      <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40">
                        <td className="px-2 py-3 text-center">
                          {actionable && (
                            <input type="checkbox" checked={selected.has(ts._id)} onChange={() => toggleSelected(ts._id)} className="accent-teal-600" />
                          )}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={() => toggleExpand(ts._id)} className={`text-slate-400 hover:text-teal-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                            <Icons.ChevronRight />
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hasNsa(ts) ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"}`}>
                            {hasNsa(ts) ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{ts.userId?.name || "Employee"}</td>
                        <td className="px-3 py-3 text-slate-600">{fmtShort(ts.weekStart)}</td>
                        <td className="px-3 py-3 text-slate-600">{fmtShort(ts.weekEnd)}</td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[ts.status] || "bg-slate-100 text-slate-600"}`}>
                            {ts.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs">{fmtDateTime(ts.submittedAt)}</td>
                        <td className="px-3 py-3 text-slate-500 text-xs max-w-[160px] truncate" title={ts.managerComment}>
                          {ts.managerComment || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => runAction([ts._id], "approve")}
                              disabled={!actionable || busyIds.has(ts._id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setModal({ ids: [ts._id], action: "reject" })}
                              disabled={!actionable || busyIds.has(ts._id)}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => setModal({ ids: [ts._id], action: "needs_edit" })}
                              disabled={!actionable || busyIds.has(ts._id)}
                              className="px-3 py-1.5 rounded-lg border-2 border-amber-400 text-amber-600 text-xs font-bold hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Request Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={10} className="px-6 py-4">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-500">
                                  <th className="text-left py-1.5 font-bold uppercase tracking-wide">Project</th>
                                  {DAY_LABELS.map((d) => (
                                    <th key={d} className="py-1.5 font-bold uppercase tracking-wide text-center">{d}</th>
                                  ))}
                                  <th className="py-1.5 font-bold uppercase tracking-wide text-center">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(ts.rows || []).map((row, i) => {
                                  const total = (row.secs || []).reduce((sum, s) => sum + (s || 0), 0) / 3600;
                                  return (
                                    <tr key={i} className="border-t border-slate-100">
                                      <td className="py-2 font-medium text-slate-700">{row.projectId?.name || "Project"}</td>
                                      {(row.secs || Array(7).fill(0)).map((s, d) => (
                                        <td key={d} className="py-2 text-center tabular-nums text-slate-600">
                                          {s ? (s / 3600).toFixed(1) : "—"}
                                        </td>
                                      ))}
                                      <td className="py-2 text-center font-bold text-teal-700 tabular-nums">{total.toFixed(1)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-slate-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
            >
              <Icons.Back />
            </button>
            <span className="text-sm font-semibold text-slate-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
            >
              <Icons.Arrow />
            </button>
          </div>
        </div>
      )}

      {modal && (
        <ReasonModal
          action={modal.action}
          count={modal.ids.length}
          onCancel={() => setModal(null)}
          onConfirm={(comment) => runAction(modal.ids, modal.action, comment)}
        />
      )}
    </main>
  );
}
