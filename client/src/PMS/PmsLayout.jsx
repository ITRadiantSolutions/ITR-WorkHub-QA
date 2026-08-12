import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Target,
  ArrowLeft,
  LayoutDashboard,
  BookOpen,
  FolderOpen,
  Calendar,
  ListChecks,
  Users,
  Search,
  FileText,
  ChevronRight,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import getInitials from "../utils/getInitials";
import ProfileModal from "../components/ProfileModal";
import { isPMS_HR, isPMS_Manager } from "../utils/pmsrolecheck";

const TABS = [
  { to: "/pms", label: "Overview", icon: LayoutDashboard },
  { to: "/mytemplate", label: "My KRAs", icon: BookOpen },
  { to: "/pms/templates", label: "KPI Templates", icon: FolderOpen, hrOnly: true },
  { to: "/pms/cycles", label: "Review Cycles", icon: Calendar, managerOrHr: true },
  { to: "/pms/reviews", label: "Reviews", icon: ListChecks, managerOrHr: true },
  { to: "/PMS-userGroup", label: "User Groups", icon: Users, managerOrHr: true },
  { to: "/user-kra-search", label: "User KRA Search", icon: Search, managerOrHr: true },
  { to: "/PMS-reports", label: "Reports", icon: FileText },
];

const ROLE_LABELS = { hr: "HR", manager: "Manager", employee: "Employee" };

export default function PmsLayout() {
  const { user, confirmLogout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = getInitials(user?.name);
  const hr = isPMS_HR(user);
  const manager = isPMS_Manager(user);
  const [showProfile, setShowProfile] = useState(false);
  const roleLabel = ROLE_LABELS[user?.roles?.pms] || "Employee";

  return (
    <div className="min-h-screen flex bg-[#F5F7FB]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col sticky top-0 h-screen">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2.5 px-5 py-5 shrink-0 group">
          <div className="w-9 h-9 rounded-[14px] bg-violet-800 flex items-center justify-center text-white shadow-sm group-hover:bg-violet-900 transition-colors shrink-0">
            <Target className="w-4.5 h-4.5" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-gray-900">
            <span className="text-violet-800">PMS</span>
          </span>
        </button>

        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => navigate("/hub")}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-violet-800 transition"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
            Back to Hub
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {(() => {
            const visibleTabs = TABS.filter((t) => {
              if (t.hrOnly) return hr;
              if (t.managerOrHr) return hr || manager;
              return true;
            });
            // Pick the single most-specific tab whose `to` matches the current
            // path, so a parent route (e.g. "/pms") doesn't also light up
            // alongside a more specific child route (e.g. "/pms/cycles").
            const activeTo = visibleTabs
              .filter((t) => location.pathname === t.to || location.pathname.startsWith(`${t.to}/`))
              .sort((a, b) => b.to.length - a.to.length)[0]?.to;

            return visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = t.to === activeTo;
              return (
                <button
                  key={t.to}
                  onClick={() => navigate(t.to)}
                  className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    active ? "bg-violet-50 text-violet-800" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  }`}
                >
                  {active && <span className="absolute left-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-violet-800" />}
                  <Icon className="w-5 h-5 shrink-0" />
                  {t.label}
                </button>
              );
            });
          })()}
        </nav>

        <div className="px-3 py-3 border-t border-gray-100 space-y-1 shrink-0">
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition"
          >
            <div className="w-9 h-9 rounded-full bg-violet-800 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
              {initials}
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-800 truncate">{user?.name || "User"}</p>
              <p className="text-xs text-gray-400">{roleLabel}</p>
            </div>
            <span className="text-gray-300 shrink-0">
              <ChevronRight className="w-4 h-4" />
            </span>
          </button>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition"
          >
            {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            <span className="flex-1 text-left">Theme</span>
            <span className="text-xs font-bold text-gray-400">{isDark ? "Dark" : "Light"}</span>
          </button>
          <button
            onClick={() => confirmLogout()}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut className="w-5 h-5" />
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
        moduleLabel="PM"
        role={user?.roles?.pms}
        accentClass="from-violet-800 to-violet-600"
      />
    </div>
  );
}
