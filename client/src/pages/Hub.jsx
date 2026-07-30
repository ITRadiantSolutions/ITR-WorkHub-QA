import { useNavigate } from "react-router-dom";
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
    accent: "blue",
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
    title: "Timesheet",
    description: "Log hours, submit and approve timesheets with ease.",
    icon: "Clock",
    accent: "emerald",
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
    tags: [
      { icon: "Star", label: "Reviews" },
      { icon: "Target", label: "KRAs" },
      { icon: "Flag", label: "Goals" },
      { icon: "Chat", label: "Feedback" },
    ],
    go: (user, navigate) => navigate("/pms"),
  },
];

const FEATURES = [
  { icon: "Shield", title: "Secure & Reliable", description: "Enterprise grade security" },
  { icon: "Users", title: "One Platform", description: "All your work in one place" },
  { icon: "TrendUp", title: "Better Productivity", description: "Track, analyze and improve" },
  { icon: "Bell", title: "Real-time Updates", description: "Stay informed, always" },
];

const ACCENTS = {
  blue: {
    iconBg: "bg-gradient-to-br from-blue-600 to-indigo-600",
    text: "text-blue-700",
    border: "border-blue-600",
    hoverBorder: "hover:border-blue-300",
    ring: "focus-visible:ring-blue-500/40",
  },
  emerald: {
    iconBg: "bg-gradient-to-br from-emerald-600 to-teal-600",
    text: "text-emerald-700",
    border: "border-emerald-600",
    hoverBorder: "hover:border-emerald-300",
    ring: "focus-visible:ring-emerald-500/40",
  },
  violet: {
    iconBg: "bg-gradient-to-br from-violet-600 to-purple-600",
    text: "text-purple-700",
    border: "border-purple-600",
    hoverBorder: "hover:border-purple-300",
    ring: "focus-visible:ring-purple-500/40",
  },
};

export default function Hub() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50 flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-10 py-3 bg-white border-b border-slate-100 shrink-0">
        <WorkHubLogo size="sm" subtitle />

        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0">
            {getInitials(user?.name)}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-bold text-slate-900">{user?.name || "there"}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-slate-200" />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
          >
            <Icons.Logout /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-4 min-h-0">
        <div className="w-full max-w-4xl mb-3">
          <p className="text-sm text-slate-500">Welcome back,</p>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            {user?.name || "there"} <span aria-hidden>👋</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 text-blue-300 mb-1">
          <Icons.Sparkle />
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 text-center">Choose a workspace</h2>
          <Icons.Sparkle />
        </div>
        <p className="text-sm text-slate-600 mb-6 text-center">Select a workspace to continue your work</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-5xl">
          {TILES.map((tile) => {
            const Icon = Icons[tile.icon];
            const a = ACCENTS[tile.accent];
            return (
              <button
                key={tile.key}
                onClick={() => tile.go(user, navigate)}
                className={`group text-left flex flex-col rounded-2xl bg-white border-2 border-slate-100 shadow-sm p-5 pb-0 overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-200 ${a.hoverBorder} focus:outline-none focus-visible:ring-4 ${a.ring}`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${a.iconBg} flex items-center justify-center text-white shadow-lg mb-3`}
                >
                  {Icon ? <Icon /> : null}
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-1">{tile.title}</h3>
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">{tile.description}</p>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tile.tags.map((tag) => {
                    const TagIcon = Icons[tag.icon];
                    return (
                      <span
                        key={tag.label}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600"
                      >
                        {TagIcon ? <TagIcon /> : null}
                        {tag.label}
                      </span>
                    );
                  })}
                </div>

                <div className={`flex items-center justify-center gap-1.5 rounded-xl border ${a.border} ${a.text} font-bold text-xs py-2.5 mb-3 group-hover:gap-2.5 transition-all`}>
                  Open {tile.title} <Icons.ArrowRight />
                </div>

                <div className={`h-1 -mx-5 ${a.iconBg}`} />
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-5xl mt-6">
          {FEATURES.map((f) => {
            const FIcon = Icons[f.icon];
            return (
              <div key={f.title} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  {FIcon ? <FIcon /> : null}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">{f.title}</p>
                  <p className="text-[11px] text-slate-500">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
