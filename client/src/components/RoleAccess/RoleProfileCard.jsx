import React from "react";
import Icons from "../Icons";


function FieldRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </span>

      <span className="text-xs font-semibold text-slate-800 break-words sm:text-right">
        {value || "—"}
      </span>
    </div>
  );
}

export default function RoleProfileCard({ user, roleConfig }) {
  const fields = roleConfig?.profile?.fields || [];
  const badgeLabel = roleConfig?.profile?.badgeLabel;
  const title = roleConfig?.profile?.title || "Profile";
  const badgeColor = roleConfig?.profile?.badgeColor || "blue";

  const badgeCls =
    {
      blue: "bg-blue-50 text-blue-700 border-blue-200",
      violet: "bg-violet-50 text-violet-700 border-violet-200",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
      red: "bg-red-50 text-red-700 border-red-200",
      amber: "bg-amber-50 text-amber-700 border-amber-200",
    }[badgeColor] || "bg-blue-50 text-blue-700 border-blue-200";

  return (
    <div

  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full"
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
    >
      {/* Header */}
<div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center text-white shrink-0">
          <Icons.Shield />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Account and access information
          </p>
        </div>
      </div>

      <div className=" p-4 sm:p-5">
        {/* User identity block */}
       <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
          {/* Avatar */}
<div className="w-12 h-12 mx-auto sm:mx-0 rounded-xl bg-blue-700 text-white flex items-center justify-center text-lg font-bold shrink-0 shadow-sm">            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>

       <div className="flex-1 min-w-0 text-center sm:text-left">
    <p className="text-sm sm:text-base font-bold text-slate-900 break-words">
              {user?.name || "—"}
            </p>
         <p className="text-[11px] text-slate-500 break-all mt-0.5">
              {user?.email || "—"}
            </p>
            {badgeLabel && (
              <span
             className={`inline-flex items-center gap-1 mt-2 text-[10px] font-bold px-2 py-1 rounded-full border ${badgeCls}`}
              >
                <Icons.Check />
                {badgeLabel}
              </span>
            )}
          </div>
        </div>

        {/* Field rows */}
        <div className="space-y-0 divide-y divide-slate-50">
          {fields.map((f, i) => {
            const value =
              f.valueKey && user ? user?.[f.valueKey] : (f.value ?? "—");
            return <FieldRow key={i} label={f.label} value={value || "—"} />;
          })}
        </div>
      </div>
    </div>
  );
}
