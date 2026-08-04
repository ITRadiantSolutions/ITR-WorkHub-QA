import ITR_LOGO from "/ITR_MINI.png";

export default function WorkHubLogo({ size = "md", onDark = false, subtitle = false }) {
  const textSize = { sm: "text-xl", md: "text-2xl", lg: "text-3xl", xl: "text-4xl" }[size];
  const iconSize = { sm: 28, md: 34, lg: 40, xl: 48 }[size];
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <img src={ITR_LOGO} alt="ITR Radiant" width={iconSize} height={iconSize} className="shrink-0 rounded-[10px]" />
        <span
          className={`${textSize} font-extrabold tracking-tight`}
          style={{ color: onDark ? "white" : "#1e293b", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.03em" }}
        >
          ITR <span style={{ color: onDark ? "#93c5fd" : "#2563eb" }}>One</span>
        </span>
      </div>
      {subtitle && (
        <p className={`text-xs mt-1 font-medium ${onDark ? "text-blue-100" : "text-slate-500"}`}>One Platform. All Your Work.</p>
      )}
    </div>
  );
}
