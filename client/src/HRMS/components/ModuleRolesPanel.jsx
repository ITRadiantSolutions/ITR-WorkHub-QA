import { useState } from "react";
import { toast } from "sonner";
import { employeesApi } from "../hrmsApi";

// Every module's role lives on the same User document (roles.<module>) —
// see server/src/models/User.js. This just gives HR one place to view/edit
// all of them for a given employee instead of hopping between each module's
// own admin screen (Timesheet > Manage, PMS > User KRA Search, etc.).
const MODULES = [
  { key: "tracker", label: "FlowTrack", roles: ["ADMIN", "PM", "DEVELOPER", "QA", "BUSINESS_USER"] },
  { key: "pms", label: "PMS", roles: ["employee", "manager", "hr"] },
  { key: "timesheet", label: "Time Flow", roles: ["employee", "manager", "hr"] },
  { key: "vms", label: "VMS", roles: ["host", "receptionist", "admin"] },
  { key: "lms", label: "LMS", roles: ["employee", "manager", "admin"] },
  { key: "hrms", label: "HRMS", roles: ["employee", "manager", "hr"] },
];

export default function ModuleRolesPanel({ employee, onChanged }) {
  const [savingModule, setSavingModule] = useState(null);

  const setRole = async (moduleKey, role) => {
    setSavingModule(moduleKey);
    try {
      await employeesApi.setRole(employee._id, role, moduleKey);
      toast.success(`${MODULES.find((m) => m.key === moduleKey)?.label} role updated`);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update role");
    } finally {
      setSavingModule(null);
    }
  };

  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
      {MODULES.map((m) => (
        <div key={m.key} className="flex items-center justify-between px-4 py-2.5 bg-white">
          <p className="text-sm font-semibold text-slate-800">{m.label}</p>
          <select
            value={employee.roles?.[m.key] || m.roles[0]}
            disabled={savingModule === m.key}
            onChange={(e) => setRole(m.key, e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs capitalize disabled:opacity-50"
          >
            {m.roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
