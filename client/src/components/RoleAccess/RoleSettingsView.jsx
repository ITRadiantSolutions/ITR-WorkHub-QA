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
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* Profile */}
        <div className="xl:col-span-4">
          <RoleProfileCard
            user={user}
            roleConfig={resolvedConfig}
          />
        </div>

        {/* Permissions */}
        <div className="xl:col-span-8">
          <RolePermissionsCard
            roleConfig={resolvedConfig}
          />
        </div>

        {/* Access Points */}
        <div className="xl:col-span-12">
          <RoleAccessPointsCard
            roleConfig={resolvedConfig}
          />
        </div>

      </div>
    </div>
  );
}