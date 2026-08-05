const TONE_STYLES = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  neutral: "bg-gray-100 text-gray-600",
};

const DOT_STYLES = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  violet: "bg-violet-500",
  neutral: "bg-gray-400",
};

export default function StatusBadge({ tone = "neutral", label, dot = false, size = "sm" }) {
  const sizeCls = size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${sizeCls} ${TONE_STYLES[tone] || TONE_STYLES.neutral}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_STYLES[tone] || DOT_STYLES.neutral}`} />}
      {label}
    </span>
  );
}
