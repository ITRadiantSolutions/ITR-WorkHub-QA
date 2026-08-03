// Split out from BugComponents.jsx — a component file mixing component and
// non-component exports breaks Vite's Fast Refresh (react-refresh/only-export-components).

export const SEVERITY = {
  CRITICAL: {
    label: "Critical",
    bar: "bg-red-600",
    badge: "bg-red-50 text-red-700 border-red-200",
    accent: "border-red-500",
    bg: "bg-red-50",
  },
  HIGH: {
    label: "High",
    bar: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    accent: "border-orange-400",
    bg: "bg-orange-50",
  },
  MEDIUM: {
    label: "Medium",
    bar: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    accent: "border-amber-400",
    bg: "bg-amber-50",
  },
  LOW: {
    label: "Low",
    bar: "bg-green-500",
    badge: "bg-green-50 text-green-700 border-green-200",
    accent: "border-green-400",
    bg: "bg-green-50",
  },
};

export const STATUS_STYLES = {
  OPEN: "bg-red-50 text-red-700 border border-red-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  WONT_FIX: "bg-slate-100 text-slate-600 border border-slate-200",
};

export const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";
