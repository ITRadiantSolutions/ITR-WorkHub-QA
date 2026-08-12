import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import getInitials from "../utils/getInitials";
import Icons from "../components/Icons";
import ProfileModal from "../components/ProfileModal";

const TABS = [
  { to: "/timesheet/dashboard", label: "Dashboard", icon: "Dashboard" },
  { to: "/timesheet/new", label: "Timesheet", icon: "Calendar" },
  { to: "/timesheet/history", label: "History", icon: "Clock" },
  { to: "/timesheet/review", label: "Review", icon: "Team", managerOrHr: true },
  { to: "/timesheet/team-status", label: "Team Status", icon: "Users", managerOrHr: true },
  { to: "/timesheet/nsa-report", label: "NSA Report", icon: "BarChart", hrOnly: true },
  { to: "/timesheet/manage", label: "Manage", icon: "Settings", managerOrHr: true },
  { to: "/timesheet/reports", label: "Reports", icon: "Reports", managerOrHr: true },
  { to: "/timesheet/guide", label: "Guide", icon: "Book" },
];

export default function TimesheetLayout() {
  const { user, confirmLogout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = getInitials(user?.name);
  const [showProfile, setShowProfile] = useState(false);
  const archivedFromTimesheet = Boolean(user?.archived?.timesheet);

  // Archiving only hides the Hub tile — a stale tab, bookmark, or someone
  // archived mid-session can still land here, so re-check on every render
  // and kick them out before the shell (or any API call) loads.
  useEffect(() => {
    if (archivedFromTimesheet) {
      toast.error("Your Time Flow access has been archived. Contact HR to restore it.");
    }
  }, [archivedFromTimesheet]);

  if (archivedFromTimesheet) {
    return <Navigate to="/hub" replace />;
  }

  return (
    <div className="min-h-screen flex bg-[#F5F7FB]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col sticky top-0 h-screen">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2.5 px-5 py-5 shrink-0 group">
          <div className="w-9 h-9 rounded-[14px] bg-teal-700 flex items-center justify-center text-white shadow-sm group-hover:bg-teal-600 transition-colors shrink-0">
            <Icons.Clock />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            Time<span className="text-teal-700">Flow</span>
          </span>
        </button>

        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => navigate("/hub")}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-teal-700 transition"
          >
            <Icons.Back />
            Back to Hub
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {TABS.filter((t) => {
            if (t.hrOnly) return user?.roles?.timesheet === "hr";
            if (t.managerOrHr) return ["manager", "hr"].includes(user?.roles?.timesheet);
            return true;
          }).map((t) => {
            const Icon = Icons[t.icon];
            const active =
              location.pathname === t.to ||
              (t.to === "/timesheet/new" && location.pathname.startsWith("/timesheet/new"));
            return (
              <button
                key={t.to}
                onClick={() => navigate(t.to)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-teal-700 to-teal-500 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {Icon ? <Icon /> : null}
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-slate-100 space-y-1 shrink-0">
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition"
          >
            <div className="w-9 h-9 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
              {initials}
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.name || "User"}</p>
              <p className="text-xs text-slate-400">View Profile</p>
            </div>
            <span className="text-slate-300 shrink-0">
              <Icons.ChevronRight />
            </span>
          </button>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
          >
            {isDark ? <Icons.Moon /> : <Icons.Sun />}
            <span className="flex-1 text-left">Theme</span>
            <span className="text-xs font-bold text-slate-400">{isDark ? "Dark" : "Light"}</span>
          </button>
          <button
            onClick={() => confirmLogout()}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
          >
            <Icons.Logout />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>

      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        user={user}
        moduleLabel="Timesheet"
        role={user?.roles?.timesheet}
        accentClass="from-teal-700 to-teal-500"
      />
    </div>
  );
}
