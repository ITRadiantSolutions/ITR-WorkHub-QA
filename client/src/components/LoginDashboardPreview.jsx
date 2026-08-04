// Static decorative mockup for the login page's marketing panel — no real
// data, just a visual echo of the actual dashboard's layout.
const NAV_ITEMS = [
  { label: "Dashboard", active: true },
  { label: "Projects" },
  { label: "Tasks" },
  { label: "Timesheets" },
  { label: "PMS" },
  { label: "Reports" },
  { label: "Team" },
  { label: "Calendar" },
  { label: "Settings" },
];

const STATS = [
  { label: "Active Projects", value: "24", sub: "Projects", color: "from-blue-500 to-blue-600" },
  { label: "Open Tasks", value: "63", sub: "Tasks", color: "from-teal-500 to-emerald-600" },
  { label: "Hours This Week", value: "32.5", sub: "Timesheets", color: "from-indigo-500 to-violet-600" },
  { label: "Pending Reviews", value: "4", sub: "PMS Reviews", color: "from-orange-500 to-amber-600" },
];

const TASKS = [
  { label: "UI Design for Dashboard", status: "In Progress", tone: "bg-blue-100 text-blue-700" },
  { label: "API Integration", status: "In Progress", tone: "bg-blue-100 text-blue-700" },
  { label: "Fix Timesheet Bugs", status: "Review", tone: "bg-amber-100 text-amber-700" },
  { label: "Performance Module Testing", status: "To Do", tone: "bg-slate-100 text-slate-500" },
];

const BARS = [70, 55, 60, 45, 65, 30, 15];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function LoginDashboardPreview() {
  return (
    <div className="hidden md:block w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden select-none">
      <div className="flex">
        <div className="w-28 shrink-0 bg-slate-900 text-slate-300 py-3 px-2 space-y-0.5">
          <div className="flex items-center gap-1.5 px-1.5 pb-3 mb-1 border-b border-white/10">
            <div className="w-5 h-5 rounded bg-blue-500" />
            <span className="text-[10px] font-bold text-white truncate">ITR One</span>
          </div>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`text-[10px] font-medium rounded-md px-2 py-1.5 truncate ${
                item.active ? "bg-blue-600 text-white" : "text-slate-400"
              }`}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="flex-1 bg-slate-50 p-3.5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-bold text-slate-800">Dashboard</span>
            <div className="flex items-center gap-2">
              <div className="hidden lg:block h-5 w-20 rounded-full bg-white border border-slate-200" />
              <div className="w-5 h-5 rounded-full bg-slate-200" />
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {STATS.map((s) => (
              <div key={s.label} className={`rounded-lg p-2 bg-gradient-to-br ${s.color} text-white`}>
                <p className="text-sm font-extrabold leading-none">{s.value}</p>
                <p className="text-[8px] font-semibold opacity-90 mt-1 truncate">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white border border-slate-100 p-2">
              <p className="text-[9px] font-bold text-slate-700 mb-1.5">My Tasks</p>
              <div className="space-y-1">
                {TASKS.map((t) => (
                  <div key={t.label} className="flex items-center justify-between gap-1">
                    <span className="text-[8px] text-slate-500 truncate">{t.label}</span>
                    <span className={`text-[7px] font-semibold px-1 py-0.5 rounded-full shrink-0 ${t.tone}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white border border-slate-100 p-2">
              <p className="text-[9px] font-bold text-slate-700 mb-1.5">Timesheet Overview</p>
              <div className="flex items-end gap-1 h-9">
                {BARS.map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-blue-400" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {DAYS.map((d) => (
                  <span key={d} className="flex-1 text-[6px] text-center text-slate-400">{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
