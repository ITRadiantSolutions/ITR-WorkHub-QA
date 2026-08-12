import { ChevronRight } from "lucide-react";

const ACCENTS = {
  violet: { icon: "bg-violet-100 text-violet-700", activeBg: "bg-violet-50/70 border-violet-100", bar: "from-violet-400 to-violet-600" },
  emerald: { icon: "bg-emerald-100 text-emerald-700", activeBg: "bg-emerald-50/70 border-emerald-100", bar: "from-emerald-400 to-emerald-500" },
  amber: { icon: "bg-amber-100 text-amber-700", activeBg: "bg-amber-50/70 border-amber-100", bar: "from-amber-400 to-amber-500" },
  red: { icon: "bg-red-100 text-red-700", activeBg: "bg-red-50/70 border-red-100", bar: "from-red-400 to-red-500" },
  blue: { icon: "bg-blue-100 text-blue-700", activeBg: "bg-blue-50/70 border-blue-100", bar: "from-blue-400 to-blue-500" },
};

export default function StatsCard({
  icon: Icon,
  label,
  value,
  caption,
  comparison,
  accent = "violet",
  progress,
  active = false,
  onClick,
  chevron = false,
}) {
  const a = ACCENTS[accent] || ACCENTS.violet;
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      onClick={onClick}
      className={`text-left rounded-2xl border p-4 flex items-center gap-3 transition ${
        active ? a.activeBg : "bg-white border-gray-100 hover:shadow-md hover:-translate-y-0.5"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${a.icon}`}>
        {Icon && <Icon className="w-5 h-5" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-extrabold text-gray-900 leading-tight tabular-nums">{value}</p>
          {comparison && <span className="text-xs font-semibold text-emerald-600">{comparison}</span>}
        </div>
        {caption && <p className="text-xs text-gray-400 mt-0.5">{caption}</p>}
        {progress != null && (
          <div className="h-1 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${a.bar} rounded-full`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
      {chevron && (
        <span className="text-gray-300 shrink-0">
          <ChevronRight className="w-4 h-4" />
        </span>
      )}
    </Comp>
  );
}
