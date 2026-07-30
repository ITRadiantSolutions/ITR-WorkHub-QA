import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Icons from "../components/Icons";

const RANGE_OPTIONS = [
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_6_months", label: "Last 6 Months" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SEGMENT_COLORS = ["#4f46e5", "#10b981", "#cbd5e1"]; // top project, leaves/2nd, other

function ActivityDonut({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = 62,
    cx = 84,
    cy = 84,
    circ = 2 * Math.PI * r,
    gap = 3; // degrees of visual gap between segments

  const arcs = segments.reduce((acc, s) => {
    const cursor = acc.length ? acc[acc.length - 1].cursor : 0;
    const pct = total > 0 ? s.value / total : 0;
    const length = Math.max(pct * circ - gap, 0);
    acc.push({ ...s, pct: Math.round(pct * 100), dasharray: `${length} ${circ - length}`, dashoffset: circ - cursor, cursor: cursor + pct * circ });
    return acc;
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <svg width="132" height="132" viewBox="0 0 168 168" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth="18"
            strokeDasharray={a.dasharray}
            strokeDashoffset={a.dashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.6s ease", cursor: "pointer" }}
          >
            <title>{`${a.label}: ${a.value.toFixed(1)}h (${a.pct}%)`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex-1 w-full space-y-2">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
            <span className="text-sm font-semibold text-slate-700 truncate flex-1">{a.label}</span>
            <span className="text-sm font-bold text-slate-500 tabular-nums shrink-0">
              {a.value.toFixed(1)}h ({a.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoursLineChart({ series, totalHours }) {
  const width = 560,
    height = 150,
    padL = 36,
    padB = 20,
    padT = 10,
    padR = 16;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxVal = Math.max(...series.map((s) => s.hours), 6);
  const yMax = Math.ceil(maxVal / 6) * 6 || 6;
  const ticks = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax];

  const points = series.map((s, i) => ({
    x: padL + (series.length > 1 ? (i / (series.length - 1)) * plotW : plotW / 2),
    y: padT + plotH - (s.hours / yMax) * plotH,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {ticks.map((t, i) => {
          const y = padT + plotH - (t / yMax) * plotH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8" className="tabular-nums">
                {t}
              </text>
            </g>
          );
        })}
        {series.length > 0 && <path d={path} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />}
        {points.map((p, i) => (
          <g key={i} style={{ cursor: "pointer" }}>
            <circle cx={p.x} cy={p.y} r="9" fill="transparent">
              <title>{`${series[i].name}: ${series[i].hours.toFixed(1)}h`}</title>
            </circle>
            <circle cx={p.x} cy={p.y} r="4" fill="#4f46e5" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#4f46e5" className="tabular-nums">
              {series[i].hours.toFixed(1)}
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <text key={i} x={points[i]?.x} y={height - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {s.name}
          </text>
        ))}
      </svg>
      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500 font-medium">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#4f46e5" }} />
        Total hours <span className="font-bold text-slate-700 tabular-nums">({totalHours.toFixed(1)}h)</span>
      </div>
    </div>
  );
}

function RecentActivityItem({ ts }) {
  const style =
    {
      submitted: { icon: "Clock", cls: "bg-amber-50 text-amber-600" },
      approved: { icon: "CheckCircle", cls: "bg-emerald-50 text-emerald-600" },
      rejected: { icon: "X", cls: "bg-red-50 text-red-600" },
      needs_edit: { icon: "Edit", cls: "bg-amber-50 text-amber-600" },
    }[ts.status] || { icon: "Clock", cls: "bg-slate-100 text-slate-500" };
  const Icon = Icons[style.icon];
  const fmt = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.cls}`}>
        <Icon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate">
          Timesheet {ts.status.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-slate-400">
          Week {fmt(ts.weekStart)} – {fmt(ts.weekEnd)}
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState("last_week");
  const [entries, setEntries] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([API.get("/entries", { params: { range } }), API.get("/timesheets")])
      .then(([eRes, tRes]) => {
        if (cancelled) return;
        setEntries(eRes.data || []);
        setTimesheets(tRes.data || []);
        const counts = {};
        (tRes.data || []).forEach((t) => (counts[t.status] = (counts[t.status] || 0) + 1));
        setStatusCounts(counts);
      })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const { donutSegments, lineSeries, totalHours } = useMemo(() => {
    const byProject = new Map();
    const byDay = Array(7).fill(0);
    entries.forEach((e) => {
      const key = e.projectName || "Unassigned";
      byProject.set(key, (byProject.get(key) || 0) + e.hours);
      const dayIdx = (new Date(e.date).getDay() + 6) % 7; // Monday-start
      byDay[dayIdx] += e.hours;
    });
    const sorted = Array.from(byProject.entries()).sort((a, b) => b[1] - a[1]);

    const top = sorted[0];
    const leavesEntry = sorted.find(([name], i) => i > 0 && name.toLowerCase() === "leaves");
    const second = leavesEntry || sorted[1];
    const otherTotal = sorted
      .filter(([name]) => name !== top?.[0] && name !== second?.[0])
      .reduce((sum, [, v]) => sum + v, 0);

    const segments = [
      { label: top ? top[0] : "Top Project", value: top ? top[1] : 0, color: SEGMENT_COLORS[0] },
      { label: second ? second[0] : "Other Projects", value: second ? second[1] : 0, color: SEGMENT_COLORS[1] },
      { label: "Other Projects", value: otherTotal, color: SEGMENT_COLORS[2] },
    ].filter((s) => s.value > 0);

    const lineSeries = DAY_LABELS.map((name, i) => ({ name, hours: byDay[i] }));
    const totalHours = sorted.reduce((sum, [, v]) => sum + v, 0);

    return { donutSegments: segments, lineSeries, totalHours };
  }, [entries]);

  const recentActivity = useMemo(
    () =>
      [...timesheets]
        .sort((a, b) => new Date(b.submittedAt || b.weekStart) - new Date(a.submittedAt || a.weekStart))
        .slice(0, 4),
    [timesheets]
  );

  const firstName = user?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="w-full px-6 xl:px-10 py-4">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's what's happening with your time tracking</p>
        </div>
        <div className="relative">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2.5 text-sm font-semibold text-slate-700 shadow-sm cursor-pointer"
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow p-4 overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-indigo-50 opacity-60 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
              <Icons.BarChart />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Hours Logged</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight leading-tight">
                {totalHours.toFixed(1)}
              </p>
            </div>
          </div>
          <p className="relative text-xs text-slate-400 font-medium mt-2">Total hours this period</p>
        </div>

        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow p-4 overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-amber-50 opacity-60 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-200 shrink-0">
              <Icons.Clock />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pending Approval</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight leading-tight">{statusCounts.submitted || 0}</p>
            </div>
          </div>
          <p className="relative text-xs text-slate-400 font-medium mt-2">
            Timesheet{statusCounts.submitted === 1 ? "" : "s"} awaiting review
          </p>
        </div>

        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow p-4 overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-emerald-50 opacity-60 group-hover:scale-110 transition-transform" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
              <Icons.CheckCircle />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Approved Timesheets</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight leading-tight">{statusCounts.approved || 0}</p>
            </div>
          </div>
          <p className="relative text-xs text-slate-400 font-medium mt-2">Timesheets this period</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Icons.Layers />
                  </div>
                  <h3 className="font-bold text-slate-900">Activity Distribution</h3>
                </div>
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500">
                  By Project <Icons.ChevronDown />
                </span>
              </div>
              {donutSegments.length ? (
                <ActivityDonut segments={donutSegments} />
              ) : (
                <div className="text-center py-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-2">
                    <Icons.Empty />
                  </div>
                  <p className="font-bold text-slate-700">No data yet</p>
                  <p className="text-sm text-slate-400 mt-1">No logged hours in this period.</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Icons.TrendUp />
                  </div>
                  <h3 className="font-bold text-slate-900">Hours Logged</h3>
                </div>
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500">
                  By Day <Icons.ChevronDown />
                </span>
              </div>
              <HoursLineChart series={lineSeries} totalHours={totalHours} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Icons.Clock />
                </div>
                <h3 className="font-bold text-slate-900">Recent Activity</h3>
              </div>
              {recentActivity.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recentActivity.map((ts) => (
                    <RecentActivityItem key={ts._id} ts={ts} />
                  ))}
                </div>
              ) : (
                <div className="bg-indigo-50/40 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white text-indigo-300 flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <Icons.Reports />
                  </div>
                  <p className="font-bold text-slate-700">No recent activity</p>
                  <p className="text-sm text-slate-400 mt-1">Your timesheet activities will appear here.</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Icons.Zap />
                </div>
                <h3 className="font-bold text-slate-900">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => navigate("/timesheet/new")}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <Icons.Plus />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">New Timesheet</p>
                    <p className="text-xs text-slate-400">Log your hours</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/timesheet/new")}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Icons.Calendar />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">View Timesheet</p>
                    <p className="text-xs text-slate-400">Manage entries</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/timesheet/history")}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition text-left sm:col-span-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Icons.Reports />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">View History</p>
                    <p className="text-xs text-slate-400">Past records</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
