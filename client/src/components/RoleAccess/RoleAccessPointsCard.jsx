import React from "react";

export default function RoleAccessPointsCard({ roleConfig }) {
  const accessPoints = roleConfig?.accessPoints || [];

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-bold text-slate-800">
          Access Points
        </h3>

        <p className="text-[11px] text-slate-500 mt-1">
          Main tools available inside the dashboard
        </p>
      </div>

      {/* Access Points */}
      <div className="p-4 sm:p-5">
        {accessPoints.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {accessPoints.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition px-3 py-3"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                  ✓
                </div>

                <span className="text-[12px] font-medium text-slate-700 break-words">
                  {item}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-[12px] text-slate-400">
              No access points configured.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}