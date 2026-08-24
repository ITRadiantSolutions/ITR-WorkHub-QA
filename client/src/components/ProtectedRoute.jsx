import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";


// moduleRoles gates a per-module role (e.g. { module: "lms", roles: ["manager", "admin"] })
// — allowedRoles only ever compared against the flat tracker role
// (ADMIN/PM/DEVELOPER/QA/BUSINESS_USER), so it can't express "must be an
// lms/pms/vms/hrms/timesheet manager or admin" at all. A super admin always
// passes, mirroring how every module gate elsewhere in the app treats them.
export default function ProtectedRoute({ children, allowedRoles, moduleRoles }) {
  const { user, token, loading } = useAuth();

// Show loading while checking authentication (safer timeout)
  // Simplified: Trust AuthContext loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center p-8 max-w-sm">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-100 border-t-blue-600 mx-auto mb-6 shadow-lg"></div>
          <p className="text-xl font-bold text-slate-800 mb-2">
            Loading Dashboard...
          </p>
          <p className="text-slate-600">Authenticating your session</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  // Role not allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to correct dashboard based on role
    switch (user.role) {
      case "ADMIN":
        return <Navigate to="/admin" replace />;
      case "PM":
        return <Navigate to="/Project-manager" replace />;
      case "DEVELOPER":
        return <Navigate to="/developer" replace />;
      case "QA":
        return <Navigate to="/qa" replace />;
      case "BUSINESS_USER":
        return <Navigate to="/business" replace />;
      default:
        return <Navigate to="/business" replace />;
    }
  }

  // Module role not allowed — send to the hub rather than a per-tracker-role
  // dashboard, since moduleRoles pages aren't part of that flow.
  if (moduleRoles && !user.isSuperAdmin && !moduleRoles.roles.includes(user.roles?.[moduleRoles.module])) {
    return <Navigate to="/hub" replace />;
  }

  // ✅ Authorized - render children
  return children;
}
