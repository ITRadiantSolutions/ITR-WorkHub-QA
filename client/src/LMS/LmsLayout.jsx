import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import getInitials from "../utils/getInitials";
import Icons from "../components/Icons";
import ProfileModal from "../components/ProfileModal";

// Same shell as VmsLayout.jsx/TimesheetLayout.jsx (sidebar, back-to-hub,
// profile/theme/logout) — amber/orange accent, matching the Hub tile.
const EMPLOYEE_TABS = [
  { to: "/lms/courses", label: "Courses", icon: "Book" },
  { to: "/lms/my-learning", label: "My Learning", icon: "Award" },
  { to: "/lms/skill-tests", label: "Tests", icon: "Target" },
];
const MANAGER_TABS = [
  ...EMPLOYEE_TABS,
  { to: "/lms/manage", label: "Manage Courses", icon: "Dashboard" },
  { to: "/lms/assign", label: "Assign Courses", icon: "Users" },
  { to: "/lms/skill-groups", label: "Skill Groups", icon: "Layers" },
  { to: "/lms/manage-skill-tests", label: "Manage Tests", icon: "Shield" },
  { to: "/lms/badges-skills", label: "Badges & Skills", icon: "Star" },
  { to: "/lms/reports", label: "Reports", icon: "Reports" },
];
const ADMIN_TABS = MANAGER_TABS;

export default function LmsLayout() {
  const { user, confirmLogout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const lmsRole = user?.roles?.lms || "employee";
  const tabs = lmsRole === "admin" ? ADMIN_TABS : lmsRole === "manager" ? MANAGER_TABS : EMPLOYEE_TABS;

  const initials = getInitials(user?.name);
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#F5F7FB]">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col sticky top-0 h-screen">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2.5 px-5 py-5 shrink-0 group">
          <div className="w-9 h-9 rounded-[14px] bg-amber-600 flex items-center justify-center text-white shadow-sm group-hover:bg-amber-500 transition-colors shrink-0">
            <Icons.Book />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            <span className="text-amber-600">LMS</span>
          </span>
        </button>

        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => navigate("/hub")}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-amber-600 transition"
          >
            <Icons.Back />
            Back to Hub
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {tabs.map((t) => {
            const Icon = Icons[t.icon];
            const active = location.pathname === t.to || location.pathname.startsWith(`${t.to}/`);
            return (
              <button
                key={t.to}
                onClick={() => navigate(t.to)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  active ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {Icon ? <Icon /> : null}
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-slate-100 space-y-1 shrink-0">
          <button onClick={() => setShowProfile(true)} className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">{initials}</div>
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

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>

      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        user={user}
        moduleLabel="LMS"
        role={lmsRole}
        accentClass="from-amber-600 to-orange-600"
      />
    </div>
  );
}
