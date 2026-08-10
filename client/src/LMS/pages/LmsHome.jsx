import { Navigate } from "react-router-dom";

// Landing point for the bare /lms route — sends everyone into the course
// catalog, same as VmsHome's role-based redirect pattern.
export default function LmsHome() {
  return <Navigate to="/lms/courses" replace />;
}
