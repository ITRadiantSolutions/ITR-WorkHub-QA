import { Clock, Target, BookOpen, ShieldCheck, Zap, Briefcase } from "lucide-react";

// Used by AccessGrants.jsx to list the modules a super admin can grant
// manage-access to. Mirrors server/src/models/User.js `roles`/`archived` enums.
export const MANAGE_MODULES = [
  { key: "timesheet", label: "Time Flow", icon: Clock, accent: "emerald", roles: ["employee", "manager", "hr"], defaultRole: "employee", hasArchive: true },
  { key: "pms", label: "PMS", icon: Target, accent: "violet", roles: ["employee", "manager", "hr"], defaultRole: "employee", hasArchive: true },
  { key: "lms", label: "LMS", icon: BookOpen, accent: "amber", roles: ["employee", "manager", "admin"], defaultRole: "employee", hasArchive: true },
  { key: "vms", label: "VMS", icon: ShieldCheck, accent: "rose", roles: ["host", "receptionist", "admin"], defaultRole: "host", hasArchive: true },
  { key: "tracker", label: "FlowTrack", icon: Zap, accent: "indigo", roles: ["ADMIN", "PM", "DEVELOPER", "QA", "BUSINESS_USER"], defaultRole: "BUSINESS_USER", hasArchive: true },
  { key: "hrms", label: "HRMS", icon: Briefcase, accent: "cyan", roles: ["employee", "manager", "hr", "recruiter"], defaultRole: "employee", hasArchive: true },
];

// A manager can grant/revoke access for their direct reports, but capped
// below each module's top tier (ADMIN/admin/hr) — only HR can hand out that
// level. Mirrors MANAGER_ROLE_CEILING in server/src/controllers/userController.js.
export const MANAGER_ROLE_CEILING = {
  timesheet: ["employee", "manager"],
  pms: ["employee", "manager"],
  lms: ["employee", "manager"],
  vms: ["host", "receptionist"],
  tracker: ["BUSINESS_USER", "DEVELOPER", "QA", "PM"],
  hrms: ["employee", "manager"],
};
