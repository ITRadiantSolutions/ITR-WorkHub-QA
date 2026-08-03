import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import getInitials from "../utils/getInitials";
import Icons from "./Icons";

// Shared FlowTrack sidebar shell — same structure/visual language as
// TimesheetLayout/PmsLayout (white sidebar, module accent color, Hub
// back-link, theme toggle, logout), parameterized so each role dashboard
// (Admin/PM/Developer/QA/Business) can plug in its own tab list while
// keeping its existing internal activeTab state (no route restructuring).
export default function TrackerSidebar({ title = "FlowTrack", navItems, activeId, onSelect, onLogout }) {
  const { user, logout } = useAuth();
  const handleLogout = onLogout || (() => logout());
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const initials = getInitials(user?.name);

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col sticky top-0 h-screen">
      <button onClick={() => navigate("/hub")} className="flex items-center gap-2.5 px-5 py-5 shrink-0 group">
        <div className="w-9 h-9 rounded-[14px] bg-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:bg-indigo-400 transition-colors shrink-0">
          <Icons.Zap />
        </div>
        <span className="text-lg font-extrabold tracking-tight text-slate-900 truncate">{title}</span>
      </button>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.Ic;
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <span className="relative inline-flex shrink-0">
                {Icon ? <Icon /> : null}
                {!active && item.dot && (
                  <span className="absolute -right-1 -top-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                )}
              </span>
              {item.label}
              {item.tag && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold uppercase leading-none">
                  {item.tag}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-100 space-y-1 shrink-0">
        <button
          onClick={() => navigate("/hub")}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition"
        >
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
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
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
        >
          <Icons.Logout />
          Logout
        </button>
      </div>
    </aside>
  );
}
