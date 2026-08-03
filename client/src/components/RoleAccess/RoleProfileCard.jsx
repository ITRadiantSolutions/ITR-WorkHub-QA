import React from "react";
import Icons from "../Icons";

export default function RoleProfileCard({ user, roleConfig }) {
  const fields = roleConfig?.profile?.fields || [];
  const badgeLabel = roleConfig?.profile?.badgeLabel;
  const title = roleConfig?.profile?.title || "Profile";
  const badgeColor = roleConfig?.profile?.badgeColor || "indigo";

  const badgeCls =
    {
      indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
      blue: "bg-blue-50 text-blue-700 border-blue-200",
      violet: "bg-violet-50 text-violet-700 border-violet-200",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
      red: "bg-red-50 text-red-700 border-red-200",
      amber: "bg-amber-50 text-amber-700 border-amber-200",
    }[badgeColor] || "bg-indigo-50 text-indigo-700 border-indigo-200";

  return (
    <div

  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full"
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
    >
      {/* Header */}
<div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
          <Icons.Shield />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Account and access information
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Identity */}
        <div className="flex items-center gap-3 shrink-0 lg:w-64">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shrink-0 shadow-sm">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-bold text-slate-900 break-words">
              {user?.name || "—"}
            </p>
            <p className="text-[11px] text-slate-500 break-all mt-0.5">
              {user?.email || "—"}
            </p>
            {badgeLabel && (
              <span
                className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-1 rounded-full border ${badgeCls}`}
              >
                <Icons.Check />
                {badgeLabel}
              </span>
            )}
          </div>
        </div>

        <div className="hidden lg:block w-px self-stretch bg-slate-100" />

        {/* Field values, laid out horizontally alongside the identity block */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {fields.map((f, i) => {
            const value =
              f.valueKey && user ? user?.[f.valueKey] : (f.value ?? "—");
            return (
              <div key={i} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {f.label}
                </p>
                <p className="text-xs font-semibold text-slate-800 break-words mt-1">
                  {value || "—"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
