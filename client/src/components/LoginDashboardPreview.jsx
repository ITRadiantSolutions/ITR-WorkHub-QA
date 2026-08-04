import Icons from "./Icons";

// Static decorative mockup for the login page's marketing panel — a compact
// echo of the Hub workspace cards (FlowTrack / Time Flow / PMS), not real data.
const TILES = [
  {
    key: "flowtrack",
    title: "FlowTrack",
    description: "Plan, organize and track work across projects, sprints, tasks and milestones.",
    icon: "Zap",
    iconBg: "bg-gradient-to-br from-indigo-600 to-indigo-500",
    text: "text-indigo-700",
    tagIcon: "text-indigo-500",
    border: "border-indigo-600",
    tags: [
      { icon: "Folder", label: "Projects" },
      { icon: "Sprints", label: "Sprints" },
      { icon: "Tasks", label: "Tasks" },
      { icon: "Layers", label: "Tags" },
    ],
  },
  {
    key: "timesheet",
    title: "Time Flow",
    description: "Log hours, submit timesheets and approve time with ease.",
    icon: "Clock",
    iconBg: "bg-gradient-to-br from-emerald-600 to-teal-600",
    filled: true,
    solidBg: "bg-emerald-600",
    tags: [
      { icon: "Clock", label: "Log Hours" },
      { icon: "Reports", label: "My Timesheets" },
      { icon: "CheckAll", label: "Approvals" },
    ],
  },
  {
    key: "pms",
    title: "PMS",
    description: "Manage performance cycles, 1:1s and reviews.",
    icon: "Star",
    iconBg: "bg-gradient-to-br from-violet-600 to-purple-600",
    text: "text-purple-700",
    tagIcon: "text-purple-500",
    border: "border-purple-600",
    tags: [
      { icon: "Star", label: "Reviews" },
      { icon: "Target", label: "KPIs" },
      { icon: "Flag", label: "Goals" },
      { icon: "Chat", label: "Feedback" },
    ],
  },
];

export default function LoginDashboardPreview() {
  return (
    <div className="hidden md:grid grid-cols-3 gap-4 w-full select-none">
      {TILES.map((tile) => {
        const Icon = Icons[tile.icon];
        return (
          <div
            key={tile.key}
            className="flex flex-col rounded-2xl bg-white border border-slate-200 shadow-sm p-4"
          >
            <div className={`w-10 h-10 rounded-xl ${tile.iconBg} flex items-center justify-center text-white shrink-0 mb-2.5`}>
              {Icon ? <Icon /> : null}
            </div>
            <p className="text-[13px] font-bold text-slate-900 leading-tight">{tile.title}</p>
            <p className="text-[10px] text-slate-500 mt-1 mb-2.5 leading-snug">{tile.description}</p>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {tile.tags.map((tag) => {
                const TagIcon = Icons[tag.icon];
                return (
                  <span
                    key={tag.label}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-1 text-[9px] font-medium text-slate-600"
                  >
                    {TagIcon ? <span className={tile.tagIcon}><TagIcon /></span> : null}
                    {tag.label}
                  </span>
                );
              })}
            </div>

            <div
              className={`flex items-center justify-center gap-1.5 rounded-xl font-bold text-[10px] py-2 ${
                tile.filled ? `${tile.solidBg} text-white` : `border ${tile.border} ${tile.text}`
              }`}
            >
              Open {tile.title} <Icons.ArrowRight />
            </div>
          </div>
        );
      })}
    </div>
  );
}
