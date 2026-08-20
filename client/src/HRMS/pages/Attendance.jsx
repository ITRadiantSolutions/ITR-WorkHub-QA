import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Fingerprint, X, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { attendanceApi, employeesApi } from "../hrmsApi";
import { isHRMS_HR, isHRMS_Manager } from "../../utils/hrmsrolecheck";
import { useAuth } from "../../context/AuthContext";

const PAGE_SIZE = 25;

const STATUS_TONE = {
  present: "bg-emerald-50 text-emerald-700",
  half_day: "bg-amber-50 text-amber-700",
  absent: "bg-red-50 text-red-700",
  on_leave: "bg-blue-50 text-blue-700",
  holiday: "bg-purple-50 text-purple-700",
  weekend: "bg-slate-100 text-slate-500",
};
const STATUS_LABELS = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  on_leave: "On leave",
  holiday: "Holiday",
  weekend: "Weekend",
};
const STATUS_OPTIONS = Object.keys(STATUS_TONE);

const Badge = ({ status }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {STATUS_LABELS[status] || status}
  </span>
);

const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtHours = (secs) => (secs > 0 ? `${(secs / 3600).toFixed(1)}h` : "—");

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => toISODate(new Date());
const currentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toISODate(start), to: toISODate(end) };
};

function SummaryStrip({ summary }) {
  if (!summary) return null;
  const cards = [
    { label: "Present", value: summary.byStatus?.present || 0, tone: "text-emerald-600" },
    { label: "Half day", value: summary.byStatus?.half_day || 0, tone: "text-amber-600" },
    { label: "On leave", value: summary.byStatus?.on_leave || 0, tone: "text-blue-600" },
    { label: "Absent", value: summary.byStatus?.absent || 0, tone: "text-red-600" },
    { label: "Not yet recorded", value: summary.notYetRecorded || 0, tone: "text-slate-500" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500">{c.label}</p>
          <p className={`text-xl font-extrabold mt-1 ${c.tone}`}>{c.value}</p>
        </div>
      ))}
      <p className="col-span-full text-[11px] text-slate-400">As of today, {fmtDate(summary.date)}.</p>
    </div>
  );
}

function DayDetailsModal({ day, onClose, canRegularize, onRegularized }) {
  const [punches, setPunches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(day.status);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    attendanceApi
      .punchesFor(day.employee._id, { date: day.date })
      .then((r) => setPunches(r.data || []))
      .catch(() => toast.error("Failed to load punches"))
      .finally(() => setLoading(false));
  }, [day.employee._id, day.date]);

  const submitRegularize = async () => {
    setSaving(true);
    try {
      await attendanceApi.regularize(day._id, { status, note });
      toast.success("Attendance updated");
      onRegularized();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update attendance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{day.employee?.name}</h2>
            <p className="text-xs text-slate-400">{fmtDate(day.date)}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5">
          <div className="flex items-center gap-3">
            <Badge status={day.status} />
            {day.isLate && <span className="text-xs font-semibold text-amber-600">Late arrival</span>}
            {day.isRegularized && <span className="text-xs font-semibold text-slate-400">Regularized by HR</span>}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Raw punches</p>
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
            ) : punches.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-2">No device punches recorded for this day.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="text-left py-1.5">Time</th>
                    <th className="text-left py-1.5">Direction</th>
                    <th className="text-left py-1.5">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {punches.map((p) => (
                    <tr key={p._id}>
                      <td className="py-1.5 text-slate-600">{fmtTime(p.timestamp)}</td>
                      <td className="py-1.5 text-slate-600">{p.direction}</td>
                      <td className="py-1.5 text-slate-400">{p.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {canRegularize && (
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Regularize</p>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason (e.g. device offline, forgot to swipe)"
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <button
                onClick={submitRegularize}
                disabled={saving}
                className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save correction"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MyAttendance() {
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Refetch when the selected month changes — not an initial-mount-only effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    attendanceApi
      .mine({ month })
      .then((r) => setDays(r.data || []))
      .catch(() => toast.error("Failed to load attendance"))
      .finally(() => setLoading(false));
  }, [month]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">First in</th>
              <th className="text-left px-4 py-2.5">Last out</th>
              <th className="text-left px-4 py-2.5">Worked</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : days.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400 italic">
                  No attendance recorded this month yet.
                </td>
              </tr>
            ) : (
              days.map((d) => (
                <tr key={d._id}>
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{fmtDate(d.date)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtTime(d.firstIn)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtTime(d.lastOut)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtHours(d.workedSeconds)}</td>
                  <td className="px-4 py-2.5">
                    <Badge status={d.status} />
                    {d.isLate && <span className="ml-2 text-[11px] font-semibold text-amber-600">Late</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamAttendance({ isHr }) {
  const [{ from, to }, setRange] = useState(currentMonthRange());
  const [status, setStatus] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (isHr) employeesApi.list().then((r) => setEmployees(r.data || [])).catch(() => {});
  }, [isHr]);

  useEffect(() => {
    attendanceApi.summary({ date: todayStr() }).then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = { from, to, page, limit: PAGE_SIZE };
    if (status) params.status = status;
    if (employeeId) params.employeeId = employeeId;
    attendanceApi
      .list(params)
      .then((r) => {
        setRows(r.data || []);
        setTotal(Number(r.headers?.["x-total-count"] ?? r.data?.length ?? 0));
      })
      .catch(() => toast.error("Failed to load attendance"))
      .finally(() => setLoading(false));
  }, [from, to, status, employeeId, page]);

  useEffect(() => {
    // Refetch whenever the date range/status/employee/page filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const rangeChanged = (field) => (e) => {
    setPage(1);
    setRange((r) => ({ ...r, [field]: e.target.value }));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <SummaryStrip summary={summary} />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
          <input type="date" value={from} onChange={rangeChanged("from")} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
          <input type="date" value={to} onChange={rangeChanged("to")} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {isHr && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => {
                setPage(1);
                setEmployeeId(e.target.value);
              }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm max-w-[220px]"
            >
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="text-left px-4 py-2.5">Employee</th>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">First in</th>
              <th className="text-left px-4 py-2.5">Last out</th>
              <th className="text-left px-4 py-2.5">Worked</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400 italic">
                  No attendance records for this range.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d._id} onClick={() => setSelectedDay(d)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{d.employee?.name || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtDate(d.date)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtTime(d.firstIn)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtTime(d.lastOut)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtHours(d.workedSeconds)}</td>
                  <td className="px-4 py-2.5">
                    <Badge status={d.status} />
                    {d.isLate && <span className="ml-2 text-[11px] font-semibold text-amber-600">Late</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedDay && (
        <DayDetailsModal
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          canRegularize={isHr}
          onRegularized={load}
        />
      )}
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const hr = isHRMS_HR(user);
  const manager = isHRMS_Manager(user);
  const canMonitor = hr || manager;
  const [tab, setTab] = useState(canMonitor ? "team" : "mine");

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <Fingerprint className="w-6 h-6 text-cyan-700" />
        <h1 className="text-2xl font-extrabold text-slate-900">Attendance</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        {canMonitor ? "Monitor check-ins, check-outs, and worked hours across the team." : "Track your check-ins, check-outs, and worked hours."}
      </p>

      {canMonitor && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("mine")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${tab === "mine" ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            My Attendance
          </button>
          <button
            onClick={() => setTab("team")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${tab === "team" ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {hr ? "All Employees" : "My Team"}
          </button>
        </div>
      )}

      {tab === "mine" ? <MyAttendance /> : <TeamAttendance isHr={hr} />}
    </div>
  );
}
