import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import Icons from "../components/Icons";
import WorkHubLogo from "../components/WorkHubLogo";
import getInitials from "../utils/getInitials";

const TRACKER_ROUTES = {
  ADMIN: "/admin",
  PM: "/Project-manager",
  DEVELOPER: "/developer",
  QA: "/qa",
  BUSINESS_USER: "/business",
};

const TILES = [
  {
    key: "flowtrack",
    title: "FlowTrack",
    description: "Plan, organize and track work across projects, sprints, tasks and bugs.",
    icon: "Zap",
    accent: "indigo",
    decor: "flowtrack",
    tags: [
      { icon: "Folder", label: "Projects" },
      { icon: "Sprints", label: "Sprints" },
      { icon: "Tasks", label: "Tasks" },
      { icon: "Bug", label: "Bugs" },
    ],
    go: (user, navigate) => navigate(TRACKER_ROUTES[user?.role] || "/business"),
  },
  {
    key: "timesheet",
    title: "Time Flow",
    description: "Log hours, submit and approve timesheets with ease.",
    icon: "Clock",
    accent: "emerald",
    decor: "timesheet",
    tags: [
      { icon: "Clock", label: "Log Hours" },
      { icon: "Reports", label: "My Timesheets" },
      { icon: "CheckAll", label: "Approvals" },
    ],
    go: (user, navigate) => navigate("/timesheet"),
  },
  {
    key: "pms",
    title: "PMS",
    description: "Manage performance cycles, KRAs and reviews.",
    icon: "Target",
    accent: "violet",
    decor: "pms",
    tags: [
      { icon: "Star", label: "Reviews" },
      { icon: "Target", label: "KRAs" },
      { icon: "Flag", label: "Goals" },
      { icon: "Chat", label: "Feedback" },
    ],
    go: (user, navigate) => navigate("/pms"),
  },
  {
    key: "lms",
    title: "LMS",
    description: "Access courses, track certifications and grow your skills.",
    icon: "Book",
    accent: "amber",
    decor: "lms",
    tags: [
      { icon: "Book", label: "Courses" },
      { icon: "CheckCircle", label: "Certifications" },
      { icon: "BarChart", label: "Progress" },
    ],
    go: (user, navigate) => navigate("/lms"),
  },
  {
    key: "visitors",
    title: "VMS",
    description: "Approve visitors, review host requests and manage check-ins.",
    icon: "UserPlus",
    accent: "rose",
    decor: "visitors",
    tags: [
      { icon: "UserPlus", label: "Check-in/out" },
      { icon: "Calendar", label: "Appointments" },
      { icon: "Shield", label: "Badges" },
    ],
    go: (user, navigate) => navigate("/vms"),
  },
  {
    key: "hrms",
    title: "HRMS",
    description: "Manage employees, job openings and referrals.",
    icon: "Briefcase",
    accent: "cyan",
    decor: "hrms",
    tags: [
      { icon: "Briefcase", label: "Manage Organization" },
      { icon: "Team", label: "Jobs" },
      { icon: "File", label: "Referrals" },
    ],
    go: (user, navigate) => navigate("/hrms"),
  },
];

const FEATURES = [
  { icon: "Shield", title: "Secure & Reliable", description: "Enterprise grade security", accent: "blue" },
  { icon: "Users", title: "One Platform", description: "All your work in one place", accent: "violet" },
  { icon: "TrendUp", title: "Better Productivity", description: "Track, analyze and improve", accent: "emerald" },
  { icon: "Bell", title: "Real-time Updates", description: "Stay informed, always", accent: "amber" },
];

const ACCENTS = {
  blue: {
    iconBg: "bg-gradient-to-br from-blue-600 to-indigo-600",
    text: "text-blue-700",
    tagIcon: "text-blue-500",
    border: "border-blue-600",
    hoverBorder: "hover:border-blue-300",
    ring: "focus-visible:ring-blue-500/40",
    solidBg: "bg-blue-600 hover:bg-blue-700",
    featureBg: "bg-blue-50",
    featureFg: "text-blue-600",
  },
  indigo: {
    iconBg: "bg-gradient-to-br from-indigo-600 to-indigo-500",
    text: "text-indigo-700",
    tagIcon: "text-indigo-500",
    border: "border-indigo-600",
    hoverBorder: "hover:border-indigo-300",
    ring: "focus-visible:ring-indigo-500/40",
    solidBg: "bg-indigo-600 hover:bg-indigo-700",
    featureBg: "bg-indigo-50",
    featureFg: "text-indigo-600",
  },
  emerald: {
    iconBg: "bg-gradient-to-br from-emerald-600 to-teal-600",
    text: "text-emerald-700",
    tagIcon: "text-emerald-500",
    border: "border-emerald-600",
    hoverBorder: "hover:border-emerald-300",
    ring: "focus-visible:ring-emerald-500/40",
    solidBg: "bg-emerald-600 hover:bg-emerald-700",
    featureBg: "bg-emerald-50",
    featureFg: "text-emerald-600",
  },
  violet: {
    iconBg: "bg-gradient-to-br from-violet-600 to-purple-600",
    text: "text-purple-700",
    tagIcon: "text-purple-500",
    border: "border-purple-600",
    hoverBorder: "hover:border-purple-300",
    ring: "focus-visible:ring-purple-500/40",
    solidBg: "bg-purple-600 hover:bg-purple-700",
    featureBg: "bg-violet-50",
    featureFg: "text-violet-600",
  },
  amber: {
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    text: "text-amber-700",
    tagIcon: "text-amber-500",
    border: "border-amber-600",
    hoverBorder: "hover:border-amber-300",
    ring: "focus-visible:ring-amber-500/40",
    solidBg: "bg-amber-600 hover:bg-amber-700",
    featureBg: "bg-amber-50",
    featureFg: "text-amber-600",
  },
  rose: {
    iconBg: "bg-gradient-to-br from-rose-600 to-pink-600",
    text: "text-rose-700",
    tagIcon: "text-rose-500",
    border: "border-rose-600",
    hoverBorder: "hover:border-rose-300",
    ring: "focus-visible:ring-rose-500/40",
    solidBg: "bg-rose-600 hover:bg-rose-700",
    featureBg: "bg-rose-50",
    featureFg: "text-rose-600",
  },
  cyan: {
    iconBg: "bg-gradient-to-br from-cyan-600 to-sky-600",
    text: "text-cyan-700",
    tagIcon: "text-cyan-500",
    border: "border-cyan-600",
    hoverBorder: "hover:border-cyan-300",
    ring: "focus-visible:ring-cyan-500/40",
    solidBg: "bg-cyan-600 hover:bg-cyan-700",
    featureBg: "bg-cyan-50",
    featureFg: "text-cyan-600",
  },
};

// Per-card decorative illustrations — purely visual, sit behind/beside the
// card copy in the empty space toward the right edge.
function FlowTrackDecor() {
  return (
    <div className="pointer-events-none absolute right-2 top-14 w-24 h-20" aria-hidden>
      <div className="absolute right-0 top-1.5 w-16 h-16 rounded-xl bg-indigo-100/70 rotate-6" />
      <div className="absolute right-2 top-0 w-16 h-16 rounded-xl bg-white border border-indigo-100 shadow-md -rotate-3 p-2">
        <div className="w-3.5 h-3.5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500">
          <Icons.Check />
        </div>
        <svg width="42" height="16" viewBox="0 0 52 20" className="mt-1.5 overflow-visible">
          <polyline
            points="1,17 11,10 20,13 30,5 41,8 51,1"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function TimesheetDecor() {
  return (
    <div className="pointer-events-none absolute right-2 top-12 w-24 h-24" aria-hidden>
      <div className="absolute right-1 top-1 w-16 h-16 rounded-2xl bg-emerald-100/70 border border-emerald-100 rotate-2 p-2">
        <div className="flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
        </div>
        <div className="mt-2 space-y-1">
          <div className="h-1 w-10 rounded-full bg-emerald-300/70" />
          <div className="h-1 w-7 rounded-full bg-emerald-300/70" />
        </div>
      </div>
      <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-emerald-200 shadow-md flex items-center justify-center text-emerald-500">
        <Icons.Clock />
      </div>
    </div>
  );
}

function PmsDecor() {
  return (
    <div className="pointer-events-none absolute right-4 top-14 flex items-end gap-1 h-16" aria-hidden>
      <div className="w-3 rounded-t-md bg-purple-200" style={{ height: "35%" }} />
      <div className="w-3 rounded-t-md bg-purple-300" style={{ height: "60%" }} />
      <div className="w-3 rounded-t-md bg-purple-400" style={{ height: "48%" }} />
      <div className="relative w-3 rounded-t-md bg-purple-600" style={{ height: "85%" }}>
        <span className="absolute -top-3.5 -right-1 text-purple-500">
          <Icons.Star />
        </span>
      </div>
    </div>
  );
}

function LmsDecor() {
  return (
    <div className="pointer-events-none absolute right-2 top-12 w-24 h-24" aria-hidden>
      <div className="absolute right-1 top-1 w-16 h-16 rounded-2xl bg-amber-100/70 border border-amber-100 rotate-3 p-2">
        <div className="w-3.5 h-3.5 rounded-full bg-amber-200 flex items-center justify-center text-amber-600">
          <Icons.Book />
        </div>
        <div className="mt-2 space-y-1">
          <div className="h-1 w-10 rounded-full bg-amber-300/70" />
          <div className="h-1 w-7 rounded-full bg-amber-300/70" />
        </div>
      </div>
      <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-amber-200 shadow-md flex items-center justify-center text-amber-500">
        <Icons.Award />
      </div>
    </div>
  );
}

function VmsDecor() {
  return (
    <div className="pointer-events-none absolute right-2 top-14 w-24 h-20" aria-hidden>
      <div className="absolute right-0 top-1.5 w-16 h-16 rounded-xl bg-rose-100/70 rotate-6" />
      <div className="absolute right-2 top-0 w-16 h-16 rounded-xl bg-white border border-rose-100 shadow-md -rotate-3 p-2">
        <div className="w-3.5 h-3.5 rounded-full bg-rose-100 flex items-center justify-center text-rose-500">
          <Icons.Shield />
        </div>
        <div className="mt-2 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-300" />
          <div className="h-1 w-8 rounded-full bg-rose-200" />
        </div>
      </div>
    </div>
  );
}

function HrmsDecor() {
  return (
    <div className="pointer-events-none absolute right-4 top-14 flex items-end gap-1 h-16" aria-hidden>
      <div className="w-3 rounded-t-md bg-cyan-200" style={{ height: "40%" }} />
      <div className="w-3 rounded-t-md bg-cyan-300" style={{ height: "65%" }} />
      <div className="w-3 rounded-t-md bg-cyan-400" style={{ height: "50%" }} />
      <div className="relative w-3 rounded-t-md bg-cyan-600" style={{ height: "90%" }}>
        <span className="absolute -top-3.5 -right-1 text-cyan-500">
          <Icons.Briefcase />
        </span>
      </div>
    </div>
  );
}

const DECORS = {
  flowtrack: FlowTrackDecor,
  timesheet: TimesheetDecor,
  pms: PmsDecor,
  lms: LmsDecor,
  visitors: VmsDecor,
  hrms: HrmsDecor,
};

export default function Hub() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Dark mode is a per-workspace preference (Timesheet/PMS/Tracker) — the Hub
  // landing page always stays on the light theme regardless of that setting.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 flex flex-col">
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6 lg:px-10 py-2.5 bg-white border-b border-slate-100 shrink-0">
        <div className="min-w-0">
          <WorkHubLogo size="sm" subtitle />
        </div>

        <div className="hidden md:flex items-center justify-center gap-2 text-base lg:text-xl font-extrabold tracking-tight text-slate-900 min-w-0 px-2">
          <span className="text-blue-600 shrink-0"><Icons.Sparkle /></span>
          <span className="truncate">Hello {user?.name?.split(" ")[0] || "there"}, choose a workspace</span>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 justify-self-end min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="hidden lg:flex items-center gap-1 min-w-0">
              <div className="leading-tight min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate max-w-[160px]">{user?.name || "there"}</p>
                <p className="text-xs text-slate-500 truncate max-w-[160px]">{user?.email}</p>
              </div>
              <span className="text-slate-400 shrink-0"><Icons.ChevronDown /></span>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 lg:px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shrink-0"
          >
            <Icons.Logout /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex px-6 py-4 min-h-0">
        <div className="m-auto flex flex-col items-center w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px] w-full max-w-[980px] mb-6">
          {TILES.map((tile) => {
            const Icon = Icons[tile.icon];
            const a = ACCENTS[tile.accent];
            const Decor = DECORS[tile.decor];
            const archived = Boolean(user?.archived?.[tile.key]);
            return (
              <button
                key={tile.key}
                onClick={() =>
                  archived
                    ? toast.error(`You don't have access to ${tile.title}. Contact your administrator.`)
                    : tile.go(user, navigate)
                }
                className={`group relative text-left flex flex-col rounded-2xl bg-white border-2 border-slate-100 shadow-sm p-4 pb-0 overflow-hidden transition-all duration-200 focus:outline-none focus-visible:ring-4 ${a.ring} ${
                  archived ? "grayscale opacity-60 cursor-not-allowed" : `hover:-translate-y-1 hover:shadow-xl ${a.hoverBorder}`
                }`}
              >
                {Decor && <Decor />}

                {tile.comingSoon && (
                  <span className="absolute top-3 right-3 z-10 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Coming Soon
                  </span>
                )}
                {archived && (
                  <span className="absolute top-3 right-3 z-10 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    No Access
                  </span>
                )}

                <div
                  className={`relative z-10 w-9 h-9 rounded-xl ${a.iconBg} flex items-center justify-center text-white shadow-lg mb-2.5`}
                >
                  {Icon ? <Icon /> : null}
                </div>

                <h3 className="relative z-10 text-[15px] font-bold text-slate-900 mb-1">{tile.title}</h3>
                <p className="relative z-10 text-[12px] text-slate-600 mb-2.5 leading-snug max-w-[85%] line-clamp-2">{tile.description}</p>

                <div className="relative z-10 flex flex-wrap gap-1.5 mb-2.5">
                  {tile.tags.map((tag) => {
                    const TagIcon = Icons[tag.icon];
                    return (
                      <span
                        key={tag.label}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600"
                      >
                        {TagIcon ? <span className={a.tagIcon}><TagIcon /></span> : null}
                        {tag.label}
                      </span>
                    );
                  })}
                </div>

                <div
                  className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg font-bold text-[12px] py-2 mb-2.5 group-hover:gap-2.5 transition-all ${
                    tile.filled ? `${a.solidBg} text-white` : `border ${a.border} ${a.text}`
                  }`}
                >
                  {archived ? "No Access" : tile.comingSoon ? "Coming Soon" : <>Open {tile.title} <Icons.ArrowRight /></>}
                </div>

                <div className={`relative z-10 h-1 -mx-4 ${a.iconBg}`} />
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-5xl">
          {FEATURES.map((f) => {
            const FIcon = Icons[f.icon];
            const a = ACCENTS[f.accent];
            return (
              <div key={f.title} className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full ${a.featureBg} ${a.featureFg} flex items-center justify-center shrink-0`}>
                  {FIcon ? <FIcon /> : null}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{f.title}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    {f.description}
                    <span className="text-emerald-500"><Icons.CheckCircle /></span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </main>
    </div>
  );
}
