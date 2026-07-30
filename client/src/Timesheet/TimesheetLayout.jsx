import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import getInitials from "../utils/getInitials";
import Icons from "../components/Icons";

const TABS = [
  { to: "/timesheet/dashboard", label: "Dashboard", icon: "Dashboard" },
  { to: "/timesheet/new", label: "Timesheet", icon: "Calendar" },
  { to: "/timesheet/history", label: "History", icon: "Clock" },
  { to: "/timesheet/review", label: "Review", icon: "Team", managerOrHr: true },
  { to: "/timesheet/manage", label: "Manage", icon: "Settings", managerOrHr: true },
  { to: "/timesheet/guide", label: "Guide", icon: "Book" },
];

export default function TimesheetLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = getInitials(user?.name);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col sticky top-0 h-screen">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2.5 px-5 py-5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform shrink-0">
            <Icons.Clock />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            Time<span className="text-indigo-600">Flow</span>
          </span>
        </button>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {TABS.filter((t) => !t.managerOrHr || ["manager", "hr"].includes(user?.roles?.timesheet)).map((t) => {
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
                    ? "bg-indigo-50 text-indigo-600"
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
            onClick={() => navigate("/hub")}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-md shadow-indigo-200">
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
            onClick={() => logout()}
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
    </div>
  );
}
