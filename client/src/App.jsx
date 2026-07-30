import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogs from "./pages/AdminLogs";

import QADashboard from "./pages/QADashboard";
import BusinessUserDashboard from "./pages/BusinessUserDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import ManagerDashboard from "./pages/PManagerDashboard";
import DeveloperDashboard from "./pages/DeveloperDashboard";
import EmployeesPage from "./pages/EmployeePage";
import ProjectsPage from "./pages/ProjectPage";
import ProjectDetail from "./pages/ProjectDetail";
import SprintDetail from "./pages/SprintDetail";
import TasksPage from "./pages/TaskPage";
import WaitingApproval from "./pages/WaitingApproval";
import Rejected from "./pages/Rejected";
import Hub from "./pages/Hub";
import TimesheetLayout from "./Timesheet/TimesheetLayout";
import TimesheetDashboard from "./Timesheet/Dashboard";
import TimesheetEntry from "./Timesheet/TimesheetEntry";
import TimesheetHistory from "./Timesheet/History";
import TimesheetGuide from "./Timesheet/Guide";
import PmsHome from "./pages/PmsHome";
import PmsCycles from "./PMS/cycles/Cycle";
import MyTemplate from "./PMS/templates/MyTemplate";
import EmployeeTemplate from "./PMS/templates/EmployeeTemplate";
import EmployeeKraBuilder from "./PMS/templates/EmployeeKraBuilder";
import PMSReport from "./PMS/reports/PMSReport";
import PMSUserGroup from "./PMS/UserGroup";
import { CreateTemplete as CreateTemplate } from "./PMS/kpi/CreateTemplate";
import AvailableTemplates from "./PMS/kpi/AvailableTemplates";
import AssignIndividual from "./PMS/kpi/AssignIndividual";
import EditTemplate from "./PMS/EditTemplate";
import UserKraSearch from "./PMS/UserKraSearch";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { NotificationProvider } from "./context/NotificationContext";
import { ThemeProvider } from "./context/ThemeContext";

// ✅ AuthSuccess - UX countdown (AuthContext handles login)
function AuthSuccess() {
  const [countdown, setCountdown] = useState(3);
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    console.log("🎬AuthSuccess - user ready:", user?.name, user?.role);

    if (!user) {
      console.log("❌ AuthSuccess no user - to login");
      window.location.href = "/";
      return;
    }

    if (countdown > 0) {
      console.log("⏱️ AuthSuccess countdown:", countdown);
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }

    console.log("🎯 AuthSuccess final redirect: /hub");
    window.location.href = "/hub";
  }, [countdown, user, loading]);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4">
      {/* Animated Background Blur */}
      <div className="absolute top-[-120px] left-[-80px] w-72 h-72 bg-blue-400/20 blur-3xl rounded-full animate-pulse" />
      <div className="absolute bottom-[-120px] right-[-80px] w-80 h-80 bg-indigo-500/20 blur-3xl rounded-full animate-pulse delay-700" />

      {/* Main Card */}
      <div className="relative w-full max-w-md rounded-[32px] bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_20px_80px_rgba(15,23,42,0.12)] overflow-hidden">
        {/* Top Glow Line */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 animate-pulse" />

        <div className="p-8 text-center">
          {/* Success Icon */}
          <div className="relative w-24 h-24 mx-auto mb-7">
            <div className="absolute inset-0 rounded-[28px] bg-blue-500/20 blur-xl animate-pulse" />

            <div className="relative w-full h-full rounded-[28px] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-[float_3s_ease-in-out_infinite]">
              <svg
                className="w-11 h-11 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-black tracking-tight text-slate-900">
            Login Successful
          </h2>

          <p className="mt-3 text-slate-600 text-[15px]">
            Welcome back,
            <span className="font-semibold text-slate-900 ml-1">
              {user?.name || "User"}
            </span>
          </p>

          {/* Smooth Dashboard Line */}
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/70 px-4 py-2 text-sm text-indigo-700 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
            </span>

            <span className="font-medium">
              Preparing your{" "}
              <span className="font-bold capitalize text-indigo-900">
                {user?.role}
              </span>{" "}
              Dashboard
            </span>
          </div>

          {/* Loader */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full border-[3px] border-blue-100"></div>

              <div className="absolute inset-0 w-9 h-9 rounded-full border-[3px] border-transparent border-t-blue-600 border-r-indigo-600 animate-spin"></div>
            </div>

            <span className="text-sm font-medium text-slate-600 tracking-wide">
              Redirecting in{" "}
              <span className="font-bold text-slate-900">{countdown}s</span>
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-7">
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 transition-all duration-1000 ease-out"
                style={{
                  width: `${((3 - countdown) / 3) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Status Pills */}
          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-200/40 backdrop-blur">
              {/* Microsoft */}
              <div className="flex items-center gap-2 px-4 py-3 text-[11px] font-semibold text-blue-700 bg-blue-50">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                Microsoft
              </div>

              <div className="h-8 w-px bg-slate-200" />

              {/* Verified */}
              <div className="flex items-center gap-2 px-4 py-3 text-[11px] font-semibold text-emerald-700 bg-emerald-50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Verified
              </div>

              <div className="h-8 w-px bg-slate-200" />

              {/* Dashboard */}
              <div className="flex items-center gap-2 px-4 py-3 text-[11px] font-semibold text-indigo-700 bg-indigo-50">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
                </svg>
                Dashboard Ready
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* 🔓 Public Routes */}
            <Route path="/" element={<Login />} />
            <Route path="/waiting" element={<WaitingApproval />} />
            <Route path="/waiting-approval" element={<WaitingApproval />} />
            <Route path="/rejected" element={<Rejected />} />
            <Route path="/auth-success" element={<AuthSuccess />} />

            {/* 🔐 Protected Routes */}
            <Route
              path="/hub"
              element={
                <ProtectedRoute>
                  <Hub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timesheet"
              element={
                <ProtectedRoute>
                  <TimesheetLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<TimesheetDashboard />} />
              <Route path="new" element={<TimesheetEntry />} />
              <Route path="new/:id" element={<TimesheetEntry />} />
              <Route path="history" element={<TimesheetHistory />} />
              <Route path="guide" element={<TimesheetGuide />} />
            </Route>
            <Route
              path="/pms"
              element={
                <ProtectedRoute>
                  <PmsHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pms/cycles"
              element={
                <ProtectedRoute>
                  <PmsCycles />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mytemplate"
              element={
                <ProtectedRoute>
                  <MyTemplate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employeetemplate"
              element={
                <ProtectedRoute>
                  <EmployeeTemplate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kra-builder"
              element={
                <ProtectedRoute>
                  <EmployeeKraBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/kra-builder/:kraId"
              element={
                <ProtectedRoute>
                  <EmployeeKraBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/PMS-reports"
              element={
                <ProtectedRoute>
                  <PMSReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/:employeeId"
              element={
                <ProtectedRoute>
                  <PMSReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/PMS-userGroup"
              element={
                <ProtectedRoute>
                  <PMSUserGroup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create_template"
              element={
                <ProtectedRoute>
                  <CreateTemplate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/available_template"
              element={
                <ProtectedRoute>
                  <AvailableTemplates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assign-individual"
              element={
                <ProtectedRoute>
                  <AssignIndividual />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-template/:id"
              element={
                <ProtectedRoute>
                  <EditTemplate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-kra-search"
              element={
                <ProtectedRoute>
                  <UserKraSearch />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <AdminLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/Project-manager"
              element={
                <ProtectedRoute allowedRoles={["PM"]}>
                  <ManagerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/developer"
              element={
                <ProtectedRoute allowedRoles={["DEVELOPER"]}>
                  <DeveloperDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/qa"
              element={
                <ProtectedRoute allowedRoles={["QA"]}>
                  <QADashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/business"
              element={
                <ProtectedRoute allowedRoles={["BUSINESS_USER"]}>
                  <BusinessUserDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/projects"
              element={
                <ProtectedRoute
                  allowedRoles={["PM", "ADMIN", "DEVELOPER", "QA"]}
                >
                  <ProjectsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute
                  allowedRoles={["PM", "ADMIN", "DEVELOPER", "QA"]}
                >
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sprints/:id"
              element={
                <ProtectedRoute
                  allowedRoles={["PM", "ADMIN", "DEVELOPER", "QA"]}
                >
                  <SprintDetail />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tasks"
              element={
                <ProtectedRoute
                  allowedRoles={["PM", "ADMIN", "DEVELOPER", "QA"]}
                >
                  <TasksPage />
                </ProtectedRoute>
              }
            />

            {/* 404 Route */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Toaster richColors position="bottom-right" />
        </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
