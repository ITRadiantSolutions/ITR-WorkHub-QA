import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { CalendarDays, Plus, X, Check, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { leaveTypesApi, leaveRequestsApi } from "../hrmsApi";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_TONE = {
  pending_manager: "bg-amber-50 text-amber-700",
  pending_skip_level: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const STATUS_LABELS = {
  pending_manager: "Pending manager",
  pending_skip_level: "Pending final approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {STATUS_LABELS[status] || status}
  </span>
);

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function BalanceStrip({ balance, onSelect }) {
  if (!balance.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {balance.map((b) => (
        <button
          key={b.leaveType._id}
          onClick={() => onSelect(b)}
          className="text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md hover:border-cyan-100 transition"
        >
          <p className="text-xs font-semibold text-slate-500 truncate">{b.leaveType.name}</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{b.remaining}</p>
          <p className="text-[11px] text-slate-400">
            of {b.allocated} days{b.carriedForward > 0 && ` (incl. ${b.carriedForward} carried forward)`}
          </p>
        </button>
      ))}
    </div>
  );
}

function LeaveDetailsModal({ balance, onClose }) {
  const { leaveType } = balance;
  const [tab, setTab] = useState("history");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaveRequestsApi.ledger(leaveType._id)
      .then((r) => setEntries(r.data.entries || []))
      .catch(() => toast.error("Failed to load balance history"))
      .finally(() => setLoading(false));
  }, [leaveType._id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{leaveType.name}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-2 px-6 pt-4 shrink-0">
          <button onClick={() => setTab("history")} className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${tab === "history" ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600"}`}>
            Balance history
          </button>
          <button onClick={() => setTab("policy")} className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${tab === "policy" ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600"}`}>
            Policy
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          {tab === "history" && (
            loading ? (
              <p className="text-sm text-slate-400 text-center py-8">Loading...</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="text-left py-2">Transaction date</th>
                    <th className="text-left py-2">Change</th>
                    <th className="text-left py-2">Balance</th>
                    <th className="text-left py-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-400 italic">No transactions yet this year.</td></tr>
                  )}
                  {entries.map((e, i) => (
                    <tr key={i}>
                      <td className="py-2.5 text-slate-600">{fmtDate(e.date)}</td>
                      <td className="py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${e.change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {e.change >= 0 ? "+" : ""}{e.change}
                        </span>
                      </td>
                      <td className="py-2.5 font-semibold text-slate-800">{e.balance}</td>
                      <td className="py-2.5 text-slate-500">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === "policy" && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Annual quota</span>
                <span className="font-semibold text-slate-800">{leaveType.defaultDaysPerYear} days/year</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Accrual</span>
                <span className="font-semibold text-slate-800">{leaveType.accrualType === "yearly" ? "Full quota on Jan 1" : "Monthly, pro-rata"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Carry-forward</span>
                <span className="font-semibold text-slate-800">
                  {leaveType.carryForwardCap > 0 ? `Up to ${leaveType.carryForwardCap} days` : "Not allowed"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Beyond balance</span>
                <span className="font-semibold text-slate-800">Applied as unpaid (loss of pay)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ApplyLeaveModal({ leaveTypes, onClose, onSubmit, saving }) {
  const [form, setForm] = useState({ leaveType: leaveTypes[0]?._id || "", startDate: "", endDate: "", isHalfDay: false, halfDaySession: "first_half", reason: "" });
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const valid = form.leaveType && form.startDate && (form.isHalfDay ? true : form.endDate);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Apply for leave</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.leaveType} onChange={set("leaveType")}>
          {leaveTypes.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-3">
          <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.startDate} onChange={set("startDate")} />
          <input
            type="date"
            disabled={form.isHalfDay}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            value={form.isHalfDay ? form.startDate : form.endDate}
            onChange={set("endDate")}
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={form.isHalfDay} onChange={set("isHalfDay")} className="rounded border-slate-300" />
          Half-day
        </label>
        {form.isHalfDay && (
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.halfDaySession} onChange={set("halfDaySession")}>
            <option value="first_half">First half</option>
            <option value="second_half">Second half</option>
          </select>
        )}

        <textarea placeholder="Reason (optional)" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.reason} onChange={set("reason")} />
        <p className="text-xs text-slate-400">
          Weekends and company holidays don't count toward the day total. If a request goes beyond your balance, the extra days are applied as unpaid (loss of pay) rather than blocked.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button
            disabled={saving || !valid}
            onClick={() => onSubmit({ ...form, endDate: form.isHalfDay ? form.startDate : form.endDate })}
            className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ request, onClose, onReview }) {
  const [comment, setComment] = useState("");
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{request.employee?.name}'s leave request</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-slate-600">
          <span className="font-semibold">{request.leaveType?.name}</span> · {fmtDate(request.startDate)}
          {request.startDate !== request.endDate && ` – ${fmtDate(request.endDate)}`} · {request.totalDays} day{request.totalDays === 1 ? "" : "s"}
        </p>
        {request.reason && <p className="text-sm text-slate-500">{request.reason}</p>}
        {request.status === "pending_manager" && (
          <p className="text-xs text-slate-400">Your approval routes this to a final sign-off — it won't be confirmed yet.</p>
        )}
        {request.status === "pending_skip_level" && (
          <p className="text-xs text-slate-400">This is the final approval step.</p>
        )}

        {showReject ? (
          <div className="space-y-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason for rejection" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReject(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Back</button>
              <button onClick={() => onReview("reject", comment)} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">Confirm reject</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowReject(true)} className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button onClick={() => onReview("approve", "")} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestTable({ rows, showEmployee, onReview, onCancel }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {showEmployee && <th className="text-left px-4 py-3">Employee</th>}
            <th className="text-left px-4 py-3">Type</th>
            <th className="text-left px-4 py-3">Dates</th>
            <th className="text-left px-4 py-3">Days</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr><td colSpan={showEmployee ? 6 : 5} className="px-4 py-8 text-center text-slate-400 italic">Nothing here yet.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r._id}>
              {showEmployee && <td className="px-4 py-3 font-semibold text-slate-800">{r.employee?.name}</td>}
              <td className="px-4 py-3">{r.leaveType?.name}</td>
              <td className="px-4 py-3 text-slate-600">
                {fmtDate(r.startDate)}{r.startDate !== r.endDate && ` – ${fmtDate(r.endDate)}`}
                {r.isHalfDay && <span className="text-slate-400"> (half-day)</span>}
              </td>
              <td className="px-4 py-3">
                {r.totalDays}
                {r.lopDays > 0 && <span className="text-red-600 text-xs font-semibold"> ({r.lopDays} LOP)</span>}
              </td>
              <td className="px-4 py-3"><Badge status={r.status} /></td>
              <td className="px-4 py-3">
                {onReview && ["pending_manager", "pending_skip_level"].includes(r.status) && (
                  <button onClick={() => onReview(r)} className="text-cyan-700 font-semibold hover:underline text-xs">Review</button>
                )}
                {onCancel && ["pending_manager", "pending_skip_level", "approved"].includes(r.status) && (
                  <button onClick={() => onCancel(r)} className="text-slate-500 font-semibold hover:underline text-xs">Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaveCalendar() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const month = cursor.getMonth() + 1;
  const year = cursor.getFullYear();

  const load = useCallback(() => {
    setLoading(true);
    leaveRequestsApi.calendar(month, year)
      .then((r) => setEvents(r.data || []))
      .catch(() => toast.error("Failed to load the leave calendar"))
      .finally(() => setLoading(false));
  }, [month, year]);

  // Refetching when the displayed month changes is the intended behavior here,
  // not an accidental cascade — the rule can't tell those apart.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingBlanks = firstOfMonth.getDay();
    const list = Array.from({ length: leadingBlanks }, () => null);
    for (let day = 1; day <= daysInMonth; day++) list.push(new Date(year, month - 1, day));
    return list;
  }, [month, year]);

  const eventsForDay = (day) => {
    if (!day) return [];
    return events.filter((e) => new Date(e.startDate) <= day && day <= new Date(e.endDate));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCursor(new Date(year, month - 2, 1))} className="p-1.5 rounded-lg hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
        <p className="font-bold text-slate-900">{MONTH_NAMES[month - 1]} {year}</p>
        <button onClick={() => setCursor(new Date(year, month, 1))} className="p-1.5 rounded-lg hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((w) => <div key={w} className="text-[11px] font-bold text-slate-400 uppercase text-center py-1">{w}</div>)}
          {cells.map((day, i) => {
            const dayEvents = eventsForDay(day);
            return (
              <div key={i} className={`min-h-[72px] rounded-xl border p-1.5 ${day ? "border-slate-100" : "border-transparent"}`}>
                {day && (
                  <>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1">{day.getDate()}</p>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <p key={e._id} className="text-[10px] leading-tight px-1 py-0.5 rounded bg-cyan-50 text-cyan-700 truncate" title={`${e.employee?.name} · ${e.leaveType?.name}`}>
                          {e.employee?.name}
                        </p>
                      ))}
                      {dayEvents.length > 2 && <p className="text-[10px] text-slate-400">+{dayEvents.length - 2} more</p>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Leave() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";
  const isManager = user?.roles?.hrms === "manager";

  const [tab, setTab] = useState("mine");
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balance, setBalance] = useState([]);
  const [mine, setMine] = useState([]);
  const [team, setTeam] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [detailsFor, setDetailsFor] = useState(null);
  const [saving, setSaving] = useState(false);

  const tabs = useMemo(() => [
    { key: "mine", label: "My Requests" },
    ...(isManager ? [{ key: "team", label: "Team" }] : []),
    ...(isHr ? [{ key: "all", label: "All Requests" }] : []),
    { key: "calendar", label: "Calendar" },
  ], [isManager, isHr]);

  const loadAll = useCallback(() => {
    setLoading(true);
    const calls = [
      leaveTypesApi.list().then((r) => setLeaveTypes(r.data || [])),
      leaveRequestsApi.balance().then((r) => setBalance(r.data || [])),
      leaveRequestsApi.mine().then((r) => setMine(r.data || [])),
    ];
    if (isManager) calls.push(leaveRequestsApi.team().then((r) => setTeam(r.data || [])));
    if (isHr) calls.push(leaveRequestsApi.all().then((r) => setAll(r.data || [])));
    Promise.all(calls).catch(() => toast.error("Failed to load leave data")).finally(() => setLoading(false));
  }, [isManager, isHr]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleApply = async (form) => {
    setSaving(true);
    try {
      await leaveRequestsApi.create(form);
      toast.success("Leave request submitted");
      setShowApply(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (action, comment) => {
    try {
      await leaveRequestsApi.review(reviewing._id, action, comment);
      toast.success(`Request ${action}d`);
      setReviewing(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to review request");
    }
  };

  const handleCancel = async (r) => {
    try {
      await leaveRequestsApi.cancel(r._id);
      toast.success("Request cancelled");
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel request");
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-cyan-700" /> Leave
          </h1>
          <p className="text-sm text-slate-500 mt-1">Apply for time off and track your balance.</p>
        </div>
        <button onClick={() => setShowApply(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
          <Plus className="w-4 h-4" /> Apply for leave
        </button>
      </div>

      <BalanceStrip balance={balance} onSelect={setDetailsFor} />

      {tabs.length > 1 && (
        <div className="flex gap-2 mb-5">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === t.key ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          {tab === "mine" && <RequestTable rows={mine} showEmployee={false} onCancel={handleCancel} />}
          {tab === "team" && <RequestTable rows={team} showEmployee onReview={setReviewing} />}
          {tab === "all" && <RequestTable rows={all} showEmployee onReview={setReviewing} />}
          {tab === "calendar" && <LeaveCalendar />}
        </>
      )}

      {showApply && (
        <ApplyLeaveModal leaveTypes={leaveTypes} saving={saving} onClose={() => setShowApply(false)} onSubmit={handleApply} />
      )}
      {reviewing && (
        <ReviewModal request={reviewing} onClose={() => setReviewing(null)} onReview={handleReview} />
      )}
      {detailsFor && (
        <LeaveDetailsModal balance={detailsFor} onClose={() => setDetailsFor(null)} />
      )}
    </main>
  );
}
