import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import getInitials from "../utils/getInitials";
import Icons from "../components/Icons";
import { isPMS_HR, isPMS_Manager } from "../utils/pmsrolecheck";

const TABS = [
  { to: "/pms", label: "Overview", icon: "Dashboard" },
  { to: "/mytemplate", label: "My KRAs", icon: "Book" },
  { to: "/employeetemplate", label: "Create KRA & KPI", icon: "Layers", managerOrHr: true },
  { to: "/available_template", label: "KPI Templates", icon: "FolderLg", hrOnly: true },
  { to: "/assign-individual", label: "Assign KRAs", icon: "UserPlus", hrOnly: true },
  { to: "/pms/cycles", label: "Review Cycles", icon: "Calendar", managerOrHr: true },
  { to: "/PMS-userGroup", label: "User Groups", icon: "Users", managerOrHr: true },
  { to: "/user-kra-search", label: "User KRA Search", icon: "Search", managerOrHr: true },
  { to: "/PMS-reports", label: "Reports", icon: "Reports" },
];

export default function PmsLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = getInitials(user?.name);
  const hr = isPMS_HR(user);
  const manager = isPMS_Manager(user);

  return (
    <div className="min-h-screen flex bg-[#F5F7FB]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col sticky top-0 h-screen">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2.5 px-5 py-5 shrink-0 group">
          <div className="w-9 h-9 rounded-[14px] bg-violet-700 flex items-center justify-center text-white shadow-sm group-hover:bg-violet-600 transition-colors shrink-0">
            <Icons.Target />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            <span className="text-violet-700">PMS</span>
          </span>
        </button>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {TABS.filter((t) => {
            if (t.hrOnly) return hr;
            if (t.managerOrHr) return hr || manager;
            return true;
          }).map((t) => {
            const Icon = Icons[t.icon];
            const active = location.pathname === t.to || location.pathname.startsWith(`${t.to}/`);
            return (
              <button
                key={t.to}
                onClick={() => navigate(t.to)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-violet-700 to-violet-500 text-white shadow-sm"
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
            <div className="w-9 h-9 rounded-full bg-violet-700 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
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
