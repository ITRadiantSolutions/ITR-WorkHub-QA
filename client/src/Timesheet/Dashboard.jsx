import { Fragment, useEffect, useMemo, useState } from "react";
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
// top project (brand gradient), second/leaves (blue), everything else (neutral)
const SEGMENT_COLORS = ["url(#donutPrimary)", "#2563eb", "#e2e8f0"];
const SEGMENT_LEGEND_COLORS = ["linear-gradient(135deg,#4338ca,#6366f1)", "#2563eb", "#e2e8f0"];

// Card shell shared by every panel on this page — soft shadow + 20px radius per brand spec.
const CARD = "bg-white rounded-[20px] border border-slate-200 shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-[0_12px_30px_rgba(79,70,229,0.12)] transition-shadow";

function Sparkline({ values, color, width = 90, height = 36 }) {
  if (!values.length) return <div style={{ width, height }} className="shrink-0" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: values.length > 1 ? (i / (values.length - 1)) * width : width / 2,
    y: height - 4 - ((v - min) / range) * (height - 8),
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const isGradient = Array.isArray(color);
  const gradId = isGradient ? `spark-${color[0].replace("#", "")}-${color[1].replace("#", "")}` : null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible shrink-0">
      {isGradient && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color[0]} />
            <stop offset="100%" stopColor={color[1]} />
          </linearGradient>
        </defs>
      )}
      <path d={path} fill="none" stroke={isGradient ? `url(#${gradId})` : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActivityDonut({ segments }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = 80,
    cx = 110,
    cy = 110,
    circ = 2 * Math.PI * r,
    gap = 3; // degrees of visual gap between segments
  const [hovered, setHovered] = useState(null);

  const arcs = segments.reduce((acc, s) => {
    const cursor = acc.length ? acc[acc.length - 1].cursor : 0;
    const pct = total > 0 ? s.value / total : 0;
    const length = Math.max(pct * circ - gap, 0);
    acc.push({ ...s, pct: Math.round(pct * 100), dasharray: `${length} ${circ - length}`, dashoffset: circ - cursor, cursor: cursor + pct * circ });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <defs>
            <linearGradient id="donutPrimary" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4338ca" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2ff" strokeWidth="24" />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth="24"
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{
                transition: "stroke-dasharray 0.6s ease, opacity 0.15s ease",
                cursor: "pointer",
                opacity: hovered && hovered.label !== a.label ? 0.35 : 1,
              }}
              onMouseEnter={() => setHovered(a)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hovered ? (
            <>
              <span className="text-2xl font-bold text-slate-800 tabular-nums">{hovered.value.toFixed(1)}h</span>
              <span className="mt-1 max-w-[120px] truncate text-xs font-semibold text-slate-500">{hovered.label}</span>
              <span className="text-xs font-semibold text-slate-400">{hovered.pct}%</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold text-slate-800 tabular-nums">{total.toFixed(1)}h</span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Total</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {arcs.map((a, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 cursor-pointer"
            onMouseEnter={() => setHovered(a)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.legendColor }} />
            <span className="text-sm font-semibold text-slate-700">{a.label}</span>
          </span>
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
  const areaPath = points.length
    ? `${path} L ${points[points.length - 1].x} ${padT + plotH} L ${points[0].x} ${padT + plotH} Z`
    : "";

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {ticks.map((t, i) => {
          const y = padT + plotH - (t / yMax) * plotH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="11" fill="#94a3b8" className="tabular-nums">
                {t}
              </text>
            </g>
          );
        })}
        {series.length > 0 && <path d={areaPath} fill="rgba(99,102,241,.12)" stroke="none" />}
        {series.length > 0 && <path d={path} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />}
        {points.map((p, i) => (
          <g key={i} style={{ cursor: "pointer" }}>
            <circle cx={p.x} cy={p.y} r="9" fill="transparent">
              <title>{`${series[i].name}: ${series[i].hours.toFixed(1)}h`}</title>
            </circle>
            <circle cx={p.x} cy={p.y} r="4" fill="#4338ca" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#4338ca" className="tabular-nums">
              {series[i].hours.toFixed(1)}
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <text key={i} x={points[i]?.x} y={height - 4} textAnchor="middle" fontSize="11" fill="#94a3b8">
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
      submitted: { icon: "Clock", cls: "bg-orange-50 text-orange-600" },
      approved: { icon: "CheckCircle", cls: "bg-emerald-50 text-emerald-600" },
      rejected: { icon: "X", cls: "bg-red-50 text-red-600" },
      needs_edit: { icon: "Edit", cls: "bg-orange-50 text-orange-600" },
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

  const isManagerOrHr = ["manager", "hr"].includes(user?.roles?.timesheet);
  const [teamMembers, setTeamMembers] = useState([]);
  const [viewUser, setViewUser] = useState(null); // null = viewing your own dashboard
  const [employeeQuery, setEmployeeQuery] = useState("");

  useEffect(() => {
    if (!isManagerOrHr) return;
    API.get(user.roles.timesheet === "hr" ? "/users" : "/users/my-reports")
      .then((res) => setTeamMembers((res.data || []).filter((u) => !u.archived?.timesheet)))
      .catch(() => toast.error("Failed to load team list"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManagerOrHr]);

  const matchingEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return [];
    return teamMembers.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 8);
  }, [teamMembers, employeeQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { range, ...(viewUser ? { userId: viewUser._id } : {}) };
    Promise.all([API.get("/entries", { params }), API.get("/timesheets", { params: viewUser ? { userId: viewUser._id } : {} })])
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
  }, [range, viewUser]);

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
      { label: top ? top[0] : "Top Project", value: top ? top[1] : 0, color: SEGMENT_COLORS[0], legendColor: SEGMENT_LEGEND_COLORS[0] },
      { label: second ? second[0] : "Other Projects", value: second ? second[1] : 0, color: SEGMENT_COLORS[1], legendColor: SEGMENT_LEGEND_COLORS[1] },
      { label: "Other Projects", value: otherTotal, color: SEGMENT_COLORS[2], legendColor: SEGMENT_LEGEND_COLORS[2] },
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

  // Last few weeks of submitted/approved counts, purely to feed the KPI card sparklines.
  const weeklyTrend = useMemo(() => {
    const byWeek = new Map();
    timesheets.forEach((t) => {
      const key = new Date(t.weekStart).toISOString().slice(0, 10);
      const cur = byWeek.get(key) || { submitted: 0, approved: 0 };
      if (t.status === "submitted") cur.submitted += 1;
      if (t.status === "approved") cur.approved += 1;
      byWeek.set(key, cur);
    });
    const weeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);
    return {
      submitted: weeks.map(([, v]) => v.submitted),
      approved: weeks.map(([, v]) => v.approved),
    };
  }, [timesheets]);

  // ── Team Timesheet Status (manager/HR only) — a per-week submission grid ──
  const [statusRange, setStatusRange] = useState("this_month");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusGrid, setStatusGrid] = useState({ weeks: [], rows: [] });
  const [statusLoading, setStatusLoading] = useState(false);
  const [expandedStatusRow, setExpandedStatusRow] = useState(null);

  useEffect(() => {
    if (!isManagerOrHr) return;
    let cancelled = false;
    setStatusLoading(true);
    API.get("/hr/timesheet-status", { params: { range: statusRange, status: statusFilter } })
      .then((res) => !cancelled && setStatusGrid(res.data || { weeks: [], rows: [] }))
      .catch(() => toast.error("Failed to load team timesheet status"))
      .finally(() => !cancelled && setStatusLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isManagerOrHr, statusRange, statusFilter]);

  const STATUS_DOT = {
    approved: "bg-emerald-500",
    submitted: "bg-orange-400",
    needs_edit: "bg-amber-500",
    rejected: "bg-red-500",
    draft: "bg-slate-300",
    not_submitted: "bg-slate-200",
  };

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
          <p className="text-sm text-slate-500 mt-0.5">
            {viewUser ? (
              <>
                Viewing <span className="font-semibold text-slate-700">{viewUser.name}</span>'s time tracking —{" "}
                <button onClick={() => setViewUser(null)} className="font-semibold text-teal-600 hover:text-teal-700 underline">
                  back to mine
                </button>
              </>
            ) : (
              "Here's what's happening with your time tracking"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isManagerOrHr && (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search /></span>
              <input
                value={employeeQuery}
                onChange={(e) => setEmployeeQuery(e.target.value)}
                placeholder="View an employee's dashboard..."
                className="rounded-[14px] border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm shadow-sm w-64"
              />
              {matchingEmployees.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                  {matchingEmployees.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => {
                        setViewUser(u);
                        setEmployeeQuery("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 flex flex-col"
                    >
                      <span className="font-semibold text-slate-800">{u.name}</span>
                      <span className="text-xs text-slate-400">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
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
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[14px] bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <Icons.BarChart />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Hours Logged</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight leading-tight">
                  {totalHours.toFixed(1)}
                </p>
              </div>
            </div>
            <Sparkline values={lineSeries.map((s) => s.hours)} color={["#4338ca", "#6366f1"]} />
          </div>
          <p className="text-xs text-slate-400 font-medium mt-2">Total hours this period</p>
        </div>

        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[14px] bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <Icons.Clock />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Pending Approval</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight leading-tight">{statusCounts.submitted || 0}</p>
              </div>
            </div>
            <Sparkline values={weeklyTrend.submitted} color="#f97316" />
          </div>
          <p className="text-xs text-slate-400 font-medium mt-2">
            Timesheet{statusCounts.submitted === 1 ? "" : "s"} awaiting review
          </p>
        </div>

        <div className={`${CARD} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[14px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Icons.CheckCircle />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Approved Timesheets</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight leading-tight">{statusCounts.approved || 0}</p>
              </div>
            </div>
            <Sparkline values={weeklyTrend.approved} color="#10b981" />
          </div>
          <p className="text-xs text-slate-400 font-medium mt-2">Timesheets this period</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className={`${CARD} p-4 flex flex-col`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[14px] bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Icons.Layers />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Activity Distribution</h3>
                </div>
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500">
                  By Project <Icons.ChevronDown />
                </span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                {donutSegments.length ? (
                  <ActivityDonut segments={donutSegments} />
                ) : (
                  <div className="text-center py-4">
                    <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-300 flex items-center justify-center mx-auto mb-2">
                      <Icons.Empty />
                    </div>
                    <p className="font-bold text-slate-700">No data yet</p>
                    <p className="text-sm text-slate-400 mt-1">No logged hours in this period.</p>
                  </div>
                )}
              </div>
            </div>

            <div className={`${CARD} p-4 flex flex-col`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[14px] bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Icons.TrendUp />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Hours Logged</h3>
                </div>
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500">
                  By Day <Icons.ChevronDown />
                </span>
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <HoursLineChart series={lineSeries} totalHours={totalHours} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-[14px] bg-teal-50 text-teal-700 flex items-center justify-center">
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
                <div className="bg-teal-50/60 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white text-teal-300 flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <Icons.Reports />
                  </div>
                  <p className="font-bold text-slate-700">No recent activity</p>
                  <p className="text-sm text-slate-400 mt-1">Your timesheet activities will appear here.</p>
                </div>
              )}
            </div>

            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-[14px] bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Icons.Zap />
                </div>
                <h3 className="font-bold text-slate-900">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => navigate("/timesheet/new")}
                  className="flex items-center gap-3 p-3 rounded-[14px] border border-slate-100 hover:border-violet-200 hover:bg-violet-50 transition text-left"
                >
                  <div className="w-9 h-9 rounded-[14px] bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Icons.Plus />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">New Timesheet</p>
                    <p className="text-xs text-slate-400">Log your hours</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/timesheet/new")}
                  className="flex items-center gap-3 p-3 rounded-[14px] border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition text-left"
                >
                  <div className="w-9 h-9 rounded-[14px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Icons.Calendar />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">View Timesheet</p>
                    <p className="text-xs text-slate-400">Manage entries</p>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/timesheet/history")}
                  className="flex items-center gap-3 p-3 rounded-[14px] border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition text-left sm:col-span-2"
                >
                  <div className="w-9 h-9 rounded-[14px] bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
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

          {isManagerOrHr && !viewUser && (
            <div className={`${CARD} p-4 mt-4`}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[14px] bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Icons.Users />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Team Timesheet Status</h3>
                    <p className="text-xs text-slate-400">Submission status per week for {user.roles.timesheet === "hr" ? "everyone" : "your direct reports"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold"
                  >
                    <option value="all">All statuses</option>
                    <option value="approved">Approved</option>
                    <option value="submitted">Submitted</option>
                    <option value="needs_edit">Needs Edit</option>
                    <option value="rejected">Rejected</option>
                    <option value="not_submitted">Not submitted</option>
                  </select>
                  <select
                    value={statusRange}
                    onChange={(e) => setStatusRange(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold"
                  >
                    {RANGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {statusLoading ? (
                <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : !statusGrid.rows.length ? (
                <div className="py-8 text-center text-slate-400 text-sm">No matching employees for this filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left py-1.5 pr-3 font-bold uppercase tracking-wide text-slate-400">Employee</th>
                        {statusGrid.weeks.map((w) => (
                          <th key={w.weekStart} className="py-1.5 px-1.5 font-bold uppercase tracking-wide text-slate-400 text-center whitespace-nowrap">
                            {new Date(w.weekStart).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statusGrid.rows.map((row) => {
                        const weekEntries = Object.entries(row.weeks);
                        const missing = weekEntries.filter(([, w]) => w.status === "not_submitted");
                        const isExpanded = expandedStatusRow === row.userId;
                        return (
                          <Fragment key={row.userId}>
                            <tr className="border-t border-slate-50">
                              <td className="py-2 pr-3">
                                <button
                                  onClick={() => setExpandedStatusRow(isExpanded ? null : row.userId)}
                                  className="font-semibold text-slate-700 hover:text-teal-700 text-left"
                                >
                                  {row.userName}
                                  {missing.length > 0 && (
                                    <span className="ml-1.5 text-[10px] font-bold text-red-500">({missing.length} missing)</span>
                                  )}
                                </button>
                              </td>
                              {weekEntries.map(([weekStart, w]) => (
                                <td key={weekStart} className="py-2 px-1.5 text-center">
                                  <span
                                    className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[w.status] || "bg-slate-200"}`}
                                    title={`${weekStart}: ${w.status.replace("_", " ")} (${w.total.toFixed(1)}h)`}
                                  />
                                </td>
                              ))}
                            </tr>
                            {isExpanded && (
                              <tr key={`${row.userId}-detail`} className="bg-slate-50/60">
                                <td colSpan={weekEntries.length + 1} className="px-3 py-3">
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
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
