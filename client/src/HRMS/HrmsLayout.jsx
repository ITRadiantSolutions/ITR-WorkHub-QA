import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Briefcase,
  ArrowLeft,
  LayoutDashboard,
  Send,
  UserPlus,
  Users,
  User,
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
  Network,
  ChevronRight,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import getInitials from "../utils/getInitials";
import ProfileModal from "../components/ProfileModal";
import { isHRMS_HR, isHRMS_Manager } from "../utils/hrmsrolecheck";

// Grouped into a handful of top-level entries (Keka's own left rail is just
// Home/Me/Team/Org/etc.) instead of one long flat list — the flat version
// grew to 16 rows and needed its own scrollbar. Groups collapse/expand;
// individual items still navigate directly.
const NAV = [
  { to: "/hrms", label: "Dashboard", icon: LayoutDashboard },
  { to: "/hrms/announcements", label: "Announcements", icon: Megaphone },
  {
    key: "me",
    label: "Me",
    icon: User,
    children: [
      { to: "/hrms/attendance", label: "Attendance", icon: Fingerprint },
      { to: "/hrms/leave", label: "Leave", icon: CalendarDays },
      { to: "/hrms/payroll", label: "Payroll", icon: Wallet },
      { to: "/hrms/expenses", label: "Expenses", icon: Receipt },
      { to: "/hrms/assets", label: "Assets", icon: Laptop },
      { to: "/hrms/documents", label: "Documents", icon: FileText },
      { to: "/hrms/hr-requests", label: "HR Requests", icon: LifeBuoy },
    ],
  },
  {
    key: "hiring",
    label: "Hiring",
    icon: Briefcase,
    children: [
      { to: "/hrms/jobs", label: "Jobs", icon: Briefcase },
      { to: "/hrms/referrals", label: "Referrals", icon: Send },
    ],
  },
  { to: "/hrms/my-team", label: "My Team", icon: Users, managerOnly: true },
  { to: "/hrms/org-chart", label: "Org Chart", icon: Network },
  {
    key: "admin",
    label: "Admin",
    icon: Building2,
    hrOnly: true,
    children: [
      { to: "/hrms/employees", label: "Employees", icon: UserPlus },
      { to: "/hrms/organization", label: "Organization", icon: Building2 },
      { to: "/hrms/lifecycle", label: "Lifecycle", icon: UserCog },
    ],
  },
  // Role/access assignment now happens only via the super-admin-gated
  // Access Grants page — see client/src/pages/AccessGrants.jsx.
];

const ROLE_LABELS = { hr: "HR", manager: "Manager", employee: "Employee" };

const isRouteActive = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

export default function HrmsLayout() {
  const { user, confirmLogout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = getInitials(user?.name);
  const hr = isHRMS_HR(user);
  const manager = isHRMS_Manager(user);
  const [showProfile, setShowProfile] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const roleLabel = ROLE_LABELS[user?.roles?.hrms] || "Employee";

  const visibleNav = NAV.filter((item) => {
    if (item.hrOnly) return hr;
    if (item.managerOnly) return manager;
    return true;
  });

  // Every navigable "to" across both flat items and group children, so the
  // active route is the single longest match (otherwise "/hrms" — Dashboard
  // — would also match every other page as a prefix).
  const allRoutes = visibleNav.flatMap((item) => (item.children ? item.children.map((c) => c.to) : [item.to]));
  const activeTo = allRoutes
    .filter((to) => isRouteActive(location.pathname, to))
    .sort((a, b) => b.length - a.length)[0];

  // Auto-expand whichever group contains the active route — doesn't collapse
  // a group the user opened manually elsewhere.
  useEffect(() => {
    const activeGroup = visibleNav.find((item) => item.children?.some((c) => c.to === activeTo));
    if (activeGroup) setExpanded((prev) => (prev.has(activeGroup.key) ? prev : new Set(prev).add(activeGroup.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTo]);

  const toggleGroup = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          {visibleNav.map((item) => {
            if (item.children) {
              const isOpen = expanded.has(item.key);
              const GroupIcon = item.icon;
              const hasActiveChild = item.children.some((c) => c.to === activeTo);
              return (
                <div key={item.key}>
                  <button
                    onClick={() => toggleGroup(item.key)}
                    className={`w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      hasActiveChild ? "text-cyan-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                    }`}
                  >
                    <GroupIcon className="w-5 h-5 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="ml-[18px] pl-3 border-l border-gray-100 space-y-0.5 mt-0.5 mb-1">
                      {item.children.map((c) => {
                        const ChildIcon = c.icon;
                        const active = c.to === activeTo;
                        return (
                          <button
                            key={c.to}
                            onClick={() => navigate(c.to)}
                            className={`w-full flex items-center gap-2.5 pl-3 pr-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              active ? "bg-cyan-50 text-cyan-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                            }`}
                          >
                            <ChildIcon className="w-4 h-4 shrink-0" />
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const Icon = item.icon;
            const active = item.to === activeTo;
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  active ? "bg-cyan-50 text-cyan-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}
              >
                {active && <span className="absolute left-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-cyan-700" />}
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-2.5 py-2 border-t border-gray-100 shrink-0">
          <button
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition"
          >
            <div className="w-7 h-7 rounded-full bg-cyan-700 text-white font-bold flex items-center justify-center text-[11px] shrink-0 shadow-sm">
              {initials}
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-800 truncate leading-tight">{user?.name || "User"}</p>
              <p className="text-[11px] text-gray-400 leading-tight">{roleLabel}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
          </button>

          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition"
            >
              {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              {isDark ? "Dark" : "Light"}
            </button>
            <button
              onClick={() => confirmLogout()}
              title="Logout"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
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
