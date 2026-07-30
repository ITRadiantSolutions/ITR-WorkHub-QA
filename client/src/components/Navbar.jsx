import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSonner } from "sonner";
import NotificationBell from "./NotificationBell";

export default function Navbar({ activeTab, setActiveTab, tabs }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useSonner();
  const handleLogout = () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");

    if (!confirmLogout) return;

    toast.success("Logged out successfully");

    setTimeout(() => {
      logout();
      navigate("/");
    }, 700);
  };
  // Role badge colors
  const roleColors = {
    ADMIN: "bg-red-100 text-red-800",
    PM: "bg-blue-100 text-blue-800",
    DEVELOPER: "bg-emerald-100 text-emerald-800",
    QA: "bg-purple-100 text-purple-800",
    BUSINESS_USER: "bg-indigo-100 text-indigo-800",
  };

  // Role labels
  const roleLabels = {
    ADMIN: "👨‍💼 Admin",
    PM: "📊 PM",
    DEVELOPER: "💻 Developer",
    QA: "🧪 QA",
    BUSINESS_USER: "💼 Business User",
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* ✅ Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h2 className="text-2xl font-bold">PM System</h2>
          <p className="text-blue-100 text-xs mt-1">Project Management</p>
        </div>

        {/* User Info */}
        <div className="p-6 border-b">
          <div
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${roleColors[user?.role] || "bg-gray-100"}`}
          >
            {roleLabels[user?.role] || "User"}
          </div>
          <p className="font-semibold text-gray-800">{user?.name}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center"
          >
            <span className="mr-2">🚪</span>
            Logout
          </button>
        </div>
      </div>

      {/* ✅ Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <div className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 capitalize">
              {tabs.find((t) => t.id === activeTab)?.label || "Dashboard"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Welcome back, {user?.name}! 👋
            </p>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right text-gray-600 text-sm">
              <p>
                Role: <span className="font-semibold">{user?.role}</span>
              </p>
              <p>Last login: Today</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {/* Slot for child content */}
          <slot></slot>
        </div>
      </div>
    </div>
  );
}
