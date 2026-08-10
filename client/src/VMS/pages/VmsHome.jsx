import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";

// Landing point for the bare /vms route — redirects into the right
// role-specific screen so the sidebar (VmsLayout) always has a real page to
// highlight as active, matching how PmsHome/TimesheetLayout's index route work.
export default function VmsHome() {
  const { user } = useAuth();
  const vmsRole = user?.roles?.vms || "host";
  if (vmsRole === "host") return <Navigate to="/vms/host" replace />;
  if (vmsRole === "admin") return <Navigate to="/vms/admin" replace />;
  return <Navigate to="/vms/admin/visitors" replace />;
}
