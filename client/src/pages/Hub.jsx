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
    filled: true,
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
    tags: [
      { icon: "UserPlus", label: "Check-in" },
      { icon: "Calendar", label: "Appointments" },
      { icon: "Shield", label: "Badges" },
    ],
    go: (user, navigate) => navigate("/vms"),
  },
  {
    key: "hrms",
    title: "HRMS",
    description: "Handle employee records, onboarding and HR documents.",
    icon: "Briefcase",
    accent: "cyan",
    comingSoon: true,
    tags: [
      { icon: "Briefcase", label: "Employees" },
      { icon: "Team", label: "Onboarding" },
      { icon: "File", label: "Documents" },
    ],
    go: () => toast.info("HRMS is coming soon."),
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
    <div className="pointer-events-none absolute right-2 top-24 w-28 h-24" aria-hidden>
      <div className="absolute right-0 top-2 w-20 h-20 rounded-xl bg-indigo-100/70 rotate-6" />
      <div className="absolute right-3 top-0 w-20 h-20 rounded-xl bg-white border border-indigo-100 shadow-md -rotate-3 p-2.5">
        <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500">
          <Icons.Check />
        </div>
        <svg width="52" height="20" viewBox="0 0 52 20" className="mt-2 overflow-visible">
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
    <div className="pointer-events-none absolute right-2 top-20 w-28 h-28" aria-hidden>
      <div className="absolute right-1 top-1 w-20 h-20 rounded-2xl bg-emerald-100/70 border border-emerald-100 rotate-2 p-2.5">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="w-2 h-2 rounded-full bg-emerald-300" />
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-12 rounded-full bg-emerald-300/70" />
          <div className="h-1.5 w-8 rounded-full bg-emerald-300/70" />
        </div>
      </div>
      <div className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-white border border-emerald-200 shadow-md flex items-center justify-center text-emerald-500">
        <Icons.Clock />
      </div>
    </div>
  );
}

function PmsDecor() {
  return (
    <div className="pointer-events-none absolute right-4 top-24 flex items-end gap-1.5 h-20" aria-hidden>
      <div className="w-3.5 rounded-t-md bg-purple-200" style={{ height: "35%" }} />
      <div className="w-3.5 rounded-t-md bg-purple-300" style={{ height: "60%" }} />
      <div className="w-3.5 rounded-t-md bg-purple-400" style={{ height: "48%" }} />
      <div className="relative w-3.5 rounded-t-md bg-purple-600" style={{ height: "85%" }}>
        <span className="absolute -top-4 -right-1 text-purple-500">
          <Icons.Star />
        </span>
      </div>
    </div>
  );
}

const DECORS = { flowtrack: FlowTrackDecor, timesheet: TimesheetDecor, pms: PmsDecor };

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
      <header className="flex items-center justify-between px-6 sm:px-10 py-2.5 bg-white border-b border-slate-100 shrink-0">
        <WorkHubLogo size="sm" subtitle />

        <div className="hidden md:block text-center">
          <p className="text-sm font-bold text-slate-900">
            Welcome back, {user?.name || "there"} <span aria-hidden>👋</span>
          </p>
          {/* <p className="text-xs text-slate-500">Choose a workspace to continue</p> */}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <div className="leading-tight">
                <p className="text-sm font-bold text-slate-900">{user?.name || "there"}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
              <span className="text-slate-400"><Icons.ChevronDown /></span>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <Icons.Logout /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-3 min-h-0">
        <h1 className="w-full max-w-5xl text-2xl sm:text-[1.7rem] font-black text-slate-900 mb-4 flex items-center justify-center gap-2">
          <Icons.Sparkle /> Choose a workspace
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px] w-full max-w-[921px]">
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
                className={`group relative text-left flex flex-col rounded-2xl bg-white border-2 border-slate-100 shadow-sm p-[18px] pb-0 overflow-hidden transition-all duration-200 focus:outline-none focus-visible:ring-4 ${a.ring} ${
                  archived ? "grayscale opacity-60 cursor-not-allowed" : `hover:-translate-y-1 hover:shadow-xl ${a.hoverBorder}`
                }`}
              >
                {Decor && <Decor />}

                {tile.comingSoon && (
                  <span className="absolute top-[14px] right-[14px] z-10 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    Coming Soon
                  </span>
                )}
                {archived && (
                  <span className="absolute top-[14px] right-[14px] z-10 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    No Access
                  </span>
                )}

                <div
                  className={`relative z-10 w-[41px] h-[41px] rounded-xl ${a.iconBg} flex items-center justify-center text-white shadow-lg mb-[11px]`}
                >
                  {Icon ? <Icon /> : null}
                </div>

                <h3 className="relative z-10 text-[14px] font-bold text-slate-900 mb-[5px]">{tile.title}</h3>
                <p className="relative z-10 text-[11px] text-slate-600 mb-[11px] leading-relaxed max-w-[80%] line-clamp-2">{tile.description}</p>

                <div className="relative z-10 flex flex-wrap gap-[5px] mb-[11px]">
                  {tile.tags.map((tag) => {
                    const TagIcon = Icons[tag.icon];
                    return (
                      <span
                        key={tag.label}
                        className="inline-flex items-center gap-[5px] rounded-full bg-slate-50 border border-slate-200 px-[9px] py-[3px] text-[10px] font-medium text-slate-600"
                      >
                        {TagIcon ? <span className={a.tagIcon}><TagIcon /></span> : null}
                        {tag.label}
                      </span>
                    );
                  })}
                </div>

                <div
                  className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg font-bold text-[11px] py-[9px] mb-[11px] group-hover:gap-2.5 transition-all ${
                    tile.filled ? `${a.solidBg} text-white` : `border ${a.border} ${a.text}`
                  }`}
                >
                  {archived ? "No Access" : tile.comingSoon ? "Coming Soon" : <>Open {tile.title} <Icons.ArrowRight /></>}
                </div>

                <div className={`relative z-10 h-1 -mx-[18px] ${a.iconBg}`} />
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 w-full max-w-5xl mt-5">
          {FEATURES.map((f) => {
            const FIcon = Icons[f.icon];
            const a = ACCENTS[f.accent];
            return (
              <div key={f.title} className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full ${a.featureBg} ${a.featureFg} flex items-center justify-center shrink-0`}>
                  {FIcon ? <FIcon /> : null}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{f.title}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    {f.description}
                    <span className="text-emerald-500"><Icons.CheckCircle /></span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4 mb-1">
          © {new Date().getFullYear()} <span className="font-semibold text-slate-500">ITR One</span>. All rights reserved.
        </p>
      </main>
    </div>
  );
}
