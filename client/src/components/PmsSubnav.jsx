import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isPMS_HR, isPMS_Manager } from "../utils/pmsrolecheck";
import Icons from "./Icons";

const LINKS = [
  { to: "/pms", label: "Overview", icon: "Dashboard", match: (p) => p === "/pms" },
  { to: "/pms/cycles", label: "Cycles", icon: "Calendar", hrOnly: true },
  { to: "/mytemplate", label: "My KRAs", icon: "Book" },
  { to: "/pms/templates", label: "KPI Studio", icon: "Layers", hrOnly: true },
  { to: "/pms/reviews", label: "Reviews", icon: "CheckAll", managerOrHr: true },
  { to: "/pms/reports", label: "Reports", icon: "BarChart", hrOnly: true },
  { to: "/pms/groups", label: "Groups", icon: "Users", hrOnly: true },
  { to: "/pms/admin", label: "Admin", icon: "Settings", hrOnly: true },
];

export default function PmsSubnav() {
  const { user, confirmLogout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hr = isPMS_HR(user);
  const manager = isPMS_Manager(user);

  const visibleLinks = LINKS.filter((l) => {
    if (l.hrOnly) return hr;
    if (l.managerOrHr) return hr || manager;
    return true;
  });

  return (
    <header className="bg-white border-b border-slate-100">
      <div className="flex items-center justify-between px-6 sm:px-8 py-4">
        <button
          onClick={() => navigate("/hub")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <Icons.Back /> Hub
        </button>
        <h1 className="text-lg font-bold text-slate-900">Performance Management</h1>
        <button onClick={() => confirmLogout()} className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700">
          <Icons.Logout /> Sign out
        </button>
      </div>

      <nav className="flex items-center gap-1 px-6 sm:px-8 pb-3 overflow-x-auto">
        {visibleLinks.map((l) => {
          const Icon = Icons[l.icon];
          const active = l.match ? l.match(location.pathname) : location.pathname.startsWith(l.to);
          return (
            <button
              key={l.to}
              onClick={() => navigate(l.to)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                active ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {Icon ? <Icon /> : null}
              {l.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
