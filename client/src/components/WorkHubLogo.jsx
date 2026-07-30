export default function WorkHubLogo({ size = "md", onDark = false, subtitle = false }) {
  const textSize = { sm: "text-xl", md: "text-2xl", lg: "text-3xl", xl: "text-4xl" }[size];
  const iconSize = { sm: 28, md: 34, lg: 40, xl: 48 }[size];
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <svg width={iconSize} height={iconSize} viewBox="0 0 40 40" fill="none">
          <rect width="40" height="40" rx="10" fill={onDark ? "white" : "#2563eb"} />
          <circle cx="14" cy="24" r="3" fill={onDark ? "#2563eb" : "white"} />
          <circle cx="20" cy="16" r="3" fill={onDark ? "#2563eb" : "white"} />
          <circle cx="26" cy="24" r="3" fill={onDark ? "#2563eb" : "white"} />
          <path d="M14 24 L20 16 L26 24" stroke={onDark ? "#2563eb" : "white"} strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
        <span
          className={`${textSize} font-extrabold tracking-tight`}
          style={{ color: onDark ? "white" : "#1e293b", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.03em" }}
        >
          ITR <span style={{ color: onDark ? "#93c5fd" : "#2563eb" }}>WorkHub</span>
        </span>
      </div>
      {subtitle && (
        <p className={`text-xs mt-1 font-medium ${onDark ? "text-blue-100" : "text-slate-500"}`}>One Platform. All Your Work.</p>
      )}
    </div>
  );
}
