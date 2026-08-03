import React from "react";
import RoleProfileCard from "./RoleProfileCard";
import RolePermissionsCard from "./RolePermissionsCard";
import RoleAccessPointsCard from "./RoleAccessPointsCard";

export default function RoleSettingsView({
  user,
  roleConfig,
  roleSettings,
}) {
  const resolvedConfig = roleSettings || roleConfig || null;

  if (!resolvedConfig) {
    return (
      <div className="w-full max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 text-sm text-slate-600">
          No settings configured for this role.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Profile first (full-width, horizontal), then permissions as a
          4-column grid, then access points — a single stacked column
          reads better than a narrow profile card fighting a wide grid. */}
      <div className="flex flex-col gap-5">
        <RoleProfileCard
          user={user}
          roleConfig={resolvedConfig}
        />

        <RolePermissionsCard
          roleConfig={resolvedConfig}
        />

        <RoleAccessPointsCard
          roleConfig={resolvedConfig}
        />
      </div>
    </div>
  );
}