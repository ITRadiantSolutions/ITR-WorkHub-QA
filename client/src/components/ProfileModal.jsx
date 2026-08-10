import { createPortal } from "react-dom";
import Icons from "./Icons";
import getInitials from "../utils/getInitials";

const ROLE_LABELS = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  ADMIN: "Admin",
  PM: "Project Manager",
  DEVELOPER: "Developer",
  QA: "QA",
  BUSINESS_USER: "Business User",
};

const FIELDS = [
  { key: "name", icon: "User", cls: "bg-indigo-50 text-indigo-600" },
  { key: "email", icon: "Mail", cls: "bg-blue-50 text-blue-600" },
  { key: "role", icon: "Briefcase", cls: "bg-emerald-50 text-emerald-600" },
];

// Shared across FlowTrack/Timesheet/PMS sidebars — shows the identity info
// the "View Profile" button promises (name/email/role) instead of the old
// behavior of just redirecting to /hub. `role` is whichever module-specific
// role the caller is currently inside (roles.tracker/timesheet/pms), so the
// same person can see a different role here depending on which app they're in.
export default function ProfileModal({ open, onClose, user, moduleLabel, role, accentClass = "from-indigo-600 to-indigo-500" }) {
  if (!open) return null;
  const initials = getInitials(user?.name);
  const roleLabel = ROLE_LABELS[role] || role || "—";

  const values = {
    name: user?.name || "—",
    email: user?.email || "—",
    role: roleLabel,
  };
  const labels = { name: "Name", email: "Email", role: `${moduleLabel} Role` };

  // Every caller mounts this inside a `position: sticky` sidebar <aside>.
  // `fixed` descendants of a sticky ancestor aren't reliably positioned
  // relative to the viewport in every browser, which let dashboard content
  // (e.g. FlowTrack's task-completion donut) show through un-blurred on top
  // of the backdrop. Portal straight to <body> so it always covers the full
  // viewport regardless of where it's mounted.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center gap-3 pl-5 pr-12 py-4 bg-gradient-to-br ${accentClass} text-white relative`}>
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition">
            <Icons.X />
          </button>
          <div className="w-11 h-11 shrink-0 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-sm border-2 border-white/40">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-tight truncate">{user?.name || "—"}</p>
            <p className="text-xs text-white/70">{moduleLabel} Profile</p>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {FIELDS.map(({ key, icon, cls }) => {
            const Icon = Icons[icon];
            return (
              <div key={key} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100">
                <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${cls}`}>
                  <Icon />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{labels[key]}</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{values[key]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
