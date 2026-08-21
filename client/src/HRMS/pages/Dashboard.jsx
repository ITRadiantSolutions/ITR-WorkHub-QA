import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Briefcase, Send, Clock, Users, UserCheck, Building2, CalendarClock, Receipt,
  LifeBuoy, Fingerprint, Wallet, Cake, PartyPopper, Award, ChevronLeft, ChevronRight, X, Laptop, FileText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { dashboardApi, holidaysApi } from "../hrmsApi";

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const HOLIDAY_BADGE_COLORS = [
  "bg-sky-100 text-sky-700", "bg-blue-100 text-blue-700", "bg-stone-100 text-stone-600",
  "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-violet-100 text-violet-700",
  "bg-lime-100 text-lime-700", "bg-cyan-100 text-cyan-700", "bg-teal-100 text-teal-700",
  "bg-rose-100 text-rose-700", "bg-orange-100 text-orange-700", "bg-indigo-100 text-indigo-700",
];

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        {Icon && <Icon className="w-5 h-5" />}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900">{value ?? "—"}</p>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function AttendanceStrip({ attendanceToday }) {
  if (!attendanceToday) return null;
  const items = [
    { key: "present", label: "Present" },
    { key: "half_day", label: "Half day" },
    { key: "on_leave", label: "On leave" },
    { key: "absent", label: "Absent" },
  ];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5"><Fingerprint className="w-4 h-4 text-cyan-700" /> Today's attendance</p>
      <div className="grid grid-cols-4 gap-3">
        {items.map((i) => (
          <div key={i.key}>
            <p className="text-xl font-extrabold text-slate-900">{attendanceToday[i.key] || 0}</p>
            <p className="text-xs text-slate-500">{i.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BirthdaysCard({ birthdays }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5"><Cake className="w-4 h-4 text-pink-600" /> Upcoming birthdays</p>
      {!birthdays?.length ? (
        <p className="text-xs text-slate-400 italic">None in the next 7 days.</p>
      ) : (
        <div className="space-y-2">
          {birthdays.map((b, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-700">{b.name}</span>
              <span className="text-slate-400 text-xs">{b.daysAway === 0 ? "Today" : `in ${b.daysAway}d`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Full-year holiday list (Keka-style): month/day badge + name + weekday +
// a floater badge, with past dates greyed out. HR can add/remove holidays
// inline here — this is the only place that manages the shared CompanyHoliday
// calendar from within HRMS (see hrmsHolidayController.js).
function AllHolidaysModal({ isHr, onClose }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: "", label: "", isFloater: false });
  const [saving, setSaving] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    setLoading(true);
    holidaysApi
      .list(year)
      .then((res) => setHolidays(res.data || []))
      .catch(() => toast.error("Failed to load holidays"))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.date) return;
    setSaving(true);
    try {
      await holidaysApi.add(form);
      toast.success("Holiday added");
      setForm({ date: "", label: "", isFloater: false });
      setShowAdd(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (date) => {
    try {
      await holidaysApi.remove(date);
      toast.success("Holiday removed");
      load();
    } catch {
      toast.error("Failed to remove holiday");
    }
  };

  // Body scroll lock while open — without this the page behind the overlay
  // still scrolls (and shows its own scrollbar), which reads as the modal
  // itself being oversized/broken.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keka-style layout: chronologically first half of the year straight down
  // the left column, second half down the right — not interleaved row by
  // row — so each column reads as a continuous timeline.
  const half = Math.ceil(holidays.length / 2);
  const columns = [holidays.slice(0, half), holidays.slice(half)];

  const renderRow = (h) => {
    const isPast = h.date < todayStr;
    const [, m, d] = h.date.split("-");
    const monthIdx = Number(m) - 1;
    const weekday = new Date(`${h.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" });
    return (
      <div key={h._id} className={`flex items-center gap-2.5 py-1.5 ${isPast ? "opacity-40" : ""}`}>
        <div className={`w-10 h-10 rounded-lg shrink-0 flex flex-col items-center justify-center ${isPast ? "bg-slate-100 text-slate-400" : HOLIDAY_BADGE_COLORS[monthIdx]}`}>
          <span className="text-[8px] font-bold tracking-wide">{MONTH_ABBR[monthIdx]}</span>
          <span className="text-sm font-extrabold leading-none">{d}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 uppercase leading-tight">{h.label || "Holiday"}</p>
          <p className="text-[11px] text-slate-400">{weekday}</p>
        </div>
        {h.isFloater && (
          <span className="shrink-0 px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 text-[9px] font-bold uppercase tracking-wide">Floater leave</span>
        )}
        {isHr && (
          <button onClick={() => handleRemove(h.date)} className="shrink-0 text-slate-300 hover:text-red-500">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 pb-3 flex-wrap gap-3 shrink-0">
          <h2 className="text-base font-bold text-slate-900">Holidays</h2>
          <div className="flex items-center gap-2.5">
            <button onClick={() => setYear((y) => y - 1)} className="text-slate-400 hover:text-slate-700"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-slate-700 w-10 text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="text-slate-400 hover:text-slate-700"><ChevronRight className="w-4 h-4" /></button>
            {isHr && (
              <button onClick={() => setShowAdd((s) => !s)} className="ml-1 px-2.5 py-1 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-[11px] font-semibold">
                + Add holiday
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 ml-1"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {showAdd && (
          <div className="flex flex-wrap items-end gap-3 mx-5 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Name</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 pb-2">
              <input
                type="checkbox"
                checked={form.isFloater}
                onChange={(e) => setForm((f) => ({ ...f, isFloater: e.target.checked }))}
                className="rounded border-slate-300"
              />
              Floater
            </label>
            <button
              disabled={saving || !form.date}
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-slate-400">Loading...</div>
        ) : holidays.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-6 text-center">No holidays set for {year}.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0 overflow-y-auto px-5 pb-5">
            <div>{columns[0].map(renderRow)}</div>
            <div>{columns[1].map(renderRow)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function HolidaysCard({ holidays, isHr }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><PartyPopper className="w-4 h-4 text-violet-600" /> Upcoming holidays</p>
        <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-cyan-700 hover:underline">View all</button>
      </div>
      {!holidays?.length ? (
        <p className="text-xs text-slate-400 italic">No upcoming holidays.</p>
      ) : (
        <div className="space-y-2">
          {holidays.map((h) => (
            <div key={h._id} className="flex justify-between text-sm">
              <span className="text-slate-700">{h.label || "Holiday"}</span>
              <span className="text-slate-400 text-xs">{new Date(`${h.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
            </div>
          ))}
        </div>
      )}
      {showAll && <AllHolidaysModal isHr={isHr} onClose={() => setShowAll(false)} />}
    </div>
  );
}

function WorkAnniversariesCard({ workAnniversaries }) {
  const ordinal = (n) => {
    if (n % 10 === 1 && n % 100 !== 11) return `${n}st`;
    if (n % 10 === 2 && n % 100 !== 12) return `${n}nd`;
    if (n % 10 === 3 && n % 100 !== 13) return `${n}rd`;
    return `${n}th`;
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5"><Award className="w-4 h-4 text-amber-600" /> Work anniversaries</p>
      {!workAnniversaries?.length ? (
        <p className="text-xs text-slate-400 italic">None in the next 7 days.</p>
      ) : (
        <div className="space-y-2">
          {workAnniversaries.map((w, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-700">{w.name} · {ordinal(w.years)} year</span>
              <span className="text-slate-400 text-xs">{w.daysAway === 0 ? "Today" : `in ${w.daysAway}d`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const humanize = (value) => (value || "").replace(/_/g, " ");

function MyAssetsCard({ myAssets }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5"><Laptop className="w-4 h-4 text-cyan-700" /> My assets</p>
      {!myAssets?.length ? (
        <p className="text-xs text-slate-400 italic">Nothing assigned to you.</p>
      ) : (
        <div className="space-y-2">
          {myAssets.map((a) => (
            <div key={a.id} className="flex justify-between text-sm">
              <span className="text-slate-700">{a.name}</span>
              <span className="text-slate-400 text-xs capitalize">{humanize(a.category)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyDocumentsCard({ myDocuments }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5"><FileText className="w-4 h-4 text-emerald-700" /> My documents</p>
      {!myDocuments?.length ? (
        <p className="text-xs text-slate-400 italic">No documents on file.</p>
      ) : (
        <div className="space-y-2">
          {myDocuments.map((d) => (
            <div key={d._id} className="flex justify-between text-sm">
              <span className="text-slate-700 truncate">{d.title}</span>
              <span className="text-slate-400 text-xs capitalize shrink-0 ml-2">{humanize(d.category)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .stats()
      .then((res) => !cancelled && setStats(res.data))
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Welcome, {user?.name || "there"}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.roles?.hrms === "hr"
            ? "Here's what's happening across the organization."
            : "Here's your HRMS overview."}
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : stats?.role === "hr" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Employees" value={stats.totalEmployees} accent="bg-cyan-50 text-cyan-700" />
            <StatCard icon={UserCheck} label="Active Employees" value={stats.activeEmployees} accent="bg-emerald-50 text-emerald-700" />
            <StatCard icon={CalendarClock} label="Pending Leave Approvals" value={stats.pendingLeaveApprovals} accent="bg-amber-50 text-amber-700" />
            <StatCard icon={Receipt} label="Pending Expense Approvals" value={stats.pendingExpenseApprovals} accent="bg-red-50 text-red-700" />
            <StatCard icon={LifeBuoy} label="Open HR Requests" value={stats.openHrRequests} accent="bg-blue-50 text-blue-700" />
            <StatCard icon={Fingerprint} label="Pending Regularizations" value={stats.pendingRegularizations} accent="bg-purple-50 text-purple-700" />
            <StatCard icon={Wallet} label="Payslips This Month" value={`${stats.payrollStatus?.generated ?? 0}/${stats.payrollStatus?.totalStructures ?? 0}`} accent="bg-teal-50 text-teal-700" />
            <StatCard icon={Briefcase} label="Open Positions" value={stats.openJobPosts} accent="bg-violet-50 text-violet-700" />
            <StatCard icon={Clock} label="Pending Job Requests" value={stats.pendingJobRequests} accent="bg-amber-50 text-amber-700" />
            <StatCard icon={Send} label="Total Referrals" value={stats.totalReferrals} accent="bg-blue-50 text-blue-700" />
            <StatCard icon={Building2} label="Referrals In Pipeline" value={stats.pendingReferrals} accent="bg-pink-50 text-pink-700" />
          </div>
          <AttendanceStrip attendanceToday={stats.attendanceToday} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <WorkAnniversariesCard workAnniversaries={stats.workAnniversaries} />
            <BirthdaysCard birthdays={stats.birthdays} />
            <HolidaysCard holidays={stats.holidays} isHr />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Briefcase} label="Open Jobs" value={stats?.openJobs} accent="bg-violet-50 text-violet-700" />
            <StatCard icon={Send} label="My Referrals" value={stats?.myReferrals} accent="bg-blue-50 text-blue-700" />
            {stats?.role === "manager" ? (
              <>
                <StatCard icon={CalendarClock} label="Team Pending Leave" value={stats?.pendingLeaveApprovals} accent="bg-amber-50 text-amber-700" />
                <StatCard icon={Receipt} label="Team Pending Expenses" value={stats?.pendingExpenseApprovals} accent="bg-red-50 text-red-700" />
                <StatCard icon={Users} label="Team Size" value={stats?.teamSize} accent="bg-cyan-50 text-cyan-700" />
              </>
            ) : (
              <StatCard icon={Clock} label="My Pending Requests" value={stats?.myPendingRequests} accent="bg-amber-50 text-amber-700" />
            )}
          </div>
          {stats?.role === "manager" && <AttendanceStrip attendanceToday={stats.attendanceToday} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <WorkAnniversariesCard workAnniversaries={stats?.workAnniversaries} />
            <BirthdaysCard birthdays={stats?.birthdays} />
            <HolidaysCard holidays={stats?.holidays} />
          </div>
          {stats?.role === "employee" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MyAssetsCard myAssets={stats?.myAssets} />
              <MyDocumentsCard myDocuments={stats?.myDocuments} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
