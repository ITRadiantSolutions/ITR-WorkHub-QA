import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Briefcase,
  ArrowLeft,
  LayoutDashboard,
  Send,
  UserPlus,
  Users,
  Building2,
  CalendarDays,
  LifeBuoy,
  Wallet,
  Receipt,
  Laptop,
  UserCog,
  Megaphone,
  FileText,
  Fingerprint,
  ChevronRight,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import getInitials from "../utils/getInitials";
import ProfileModal from "../components/ProfileModal";
import { isHRMS_HR, isHRMS_Manager } from "../utils/hrmsrolecheck";

const TABS = [
  { to: "/hrms", label: "Dashboard", icon: LayoutDashboard },
  { to: "/hrms/announcements", label: "Announcements", icon: Megaphone },
  { to: "/hrms/attendance", label: "Attendance", icon: Fingerprint },
  { to: "/hrms/leave", label: "Leave", icon: CalendarDays },
  { to: "/hrms/payroll", label: "Payroll", icon: Wallet },
  { to: "/hrms/expenses", label: "Expenses", icon: Receipt },
  { to: "/hrms/assets", label: "Assets", icon: Laptop },
  { to: "/hrms/documents", label: "Documents", icon: FileText },
  { to: "/hrms/hr-requests", label: "HR Requests", icon: LifeBuoy },
  { to: "/hrms/jobs", label: "Jobs", icon: Briefcase },
  { to: "/hrms/referrals", label: "Referrals", icon: Send },
  { to: "/hrms/my-team", label: "My Team", icon: Users, managerOnly: true },
  { to: "/hrms/employees", label: "Employees", icon: UserPlus, hrOnly: true },
  { to: "/hrms/organization", label: "Organization", icon: Building2, hrOnly: true },
  { to: "/hrms/lifecycle", label: "Lifecycle", icon: UserCog, hrOnly: true },
  // Role/access assignment now happens only via the super-admin-gated
  // Access Grants page — see client/src/pages/AccessGrants.jsx.
];

const ROLE_LABELS = { hr: "HR", manager: "Manager", employee: "Employee" };

export default function HrmsLayout() {
  const { user, confirmLogout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = getInitials(user?.name);
  const hr = isHRMS_HR(user);
  const manager = isHRMS_Manager(user);
  const [showProfile, setShowProfile] = useState(false);
  const roleLabel = ROLE_LABELS[user?.roles?.hrms] || "Employee";

  return (
    <div className="min-h-screen flex bg-[#F5F7FB]">
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col sticky top-0 h-screen">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2.5 px-5 py-5 shrink-0 group">
          <div className="w-9 h-9 rounded-[14px] bg-cyan-700 flex items-center justify-center text-white shadow-sm group-hover:bg-cyan-800 transition-colors shrink-0">
            <Briefcase className="w-4.5 h-4.5" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-gray-900">
            <span className="text-cyan-700">HRMS</span>
          </span>
        </button>

        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => navigate("/hub")}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-cyan-700 transition"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
            Back to Hub
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {(() => {
            const visibleTabs = TABS.filter((t) => {
              if (t.hrOnly) return hr;
              if (t.managerOnly) return manager;
              return true;
            });
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
                    active ? "bg-cyan-50 text-cyan-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  }`}
                >
                  {active && <span className="absolute left-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-cyan-700" />}
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
            <div className="w-9 h-9 rounded-full bg-cyan-700 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
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

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>

      <ProfileModal
        open={showProfile}
        onClose={() => setShowProfile(false)}
        user={user}
        moduleLabel="HRMS"
        role={user?.roles?.hrms}
        accentClass="from-cyan-700 to-cyan-600"
      />
    </div>
  );
}
