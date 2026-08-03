import React from "react";

export default function RolePermissionsCard({ roleConfig }) {
  const permissions = roleConfig?.permissions || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-800">
          Role Permissions
        </h3>

        <p className="text-[11px] text-slate-500 mt-1">
          Access rights available for your account
        </p>
      </div>

      {/* Permissions Grid */}
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {permissions.map((p, i) => (
          <div
            key={i}
            className={`rounded-xl border p-3.5 hover:shadow-sm transition-all ${
              p.allowed
                ? "bg-indigo-50 border-indigo-100"
                : "bg-slate-50 border-slate-200 opacity-70"
            }`}
          >
            <div className="flex items-start gap-2.5">
              {/* Status Icon */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                  p.allowed
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-300 text-white"
                }`}
              >
                {p.allowed ? "✓" : "✕"}
              </div>

              {/* Permission Content */}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-slate-800 break-words">
                  {p.label}
                </p>

                <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed break-words">
                  {p.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {permissions.length === 0 && (
        <div className="p-8 text-center">
          <p className="text-[12px] text-slate-400">
            No permissions configured.
          </p>
        </div>
      )}
    </div>
  );
}