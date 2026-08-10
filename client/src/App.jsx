import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import TimesheetReview from "./Timesheet/Review";
import TimesheetTeamStatus from "./Timesheet/TeamStatus";
import TimesheetManage from "./Timesheet/Manage";
import TimesheetNsaReport from "./Timesheet/NsaReport";
import TimesheetReports from "./Timesheet/Reports";
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
import PmsLayout from "./PMS/PmsLayout";
import ReviewQueue from "./PMS/reports/ReviewQueue";
import SubmissionDetail from "./PMS/reports/SubmissionDetail";
import VmsVisitorKiosk from "./VMS/pages/VisitorKiosk";
import VmsHome from "./VMS/pages/VmsHome";
import VmsLayout from "./VMS/VmsLayout";
import VmsHostDashboard from "./VMS/pages/HostDashboard";
import VmsAdminPanel from "./VMS/pages/AdminPanel";
import LmsLayout from "./LMS/LmsLayout";
import LmsHome from "./LMS/pages/LmsHome";
import CourseCatalog from "./LMS/pages/CourseCatalog";
import CoursePlayer from "./LMS/pages/CoursePlayer";
import AssessmentPlayer from "./LMS/pages/AssessmentPlayer";
import MyLearning from "./LMS/pages/MyLearning";
import ManageCourses from "./LMS/pages/ManageCourses";
import CourseBuilder from "./LMS/pages/CourseBuilder";
import AssignCourses from "./LMS/pages/AssignCourses";
import BadgesSkills from "./LMS/pages/BadgesSkills";
import LmsReports from "./LMS/pages/Reports";
import { Toaster } from "sonner";
import { ConfirmDialogHost } from "./components/ConfirmDialog";
import { NotificationProvider } from "./context/NotificationContext";
import { ThemeProvider } from "./context/ThemeContext";

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
            {/* Public kiosk — no ItrOne login; runs on an unattended reception device */}
            <Route path="/vms/kiosk" element={<VmsVisitorKiosk />} />

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
              <Route path="review" element={<TimesheetReview />} />
              <Route path="team-status" element={<TimesheetTeamStatus />} />
              <Route path="nsa-report" element={<TimesheetNsaReport />} />
              <Route path="manage" element={<TimesheetManage />} />
              <Route path="reports" element={<TimesheetReports />} />
              <Route path="guide" element={<TimesheetGuide />} />
            </Route>
            <Route element={<PmsLayout />}>
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
                path="/pms/reviews"
                element={
                  <ProtectedRoute>
                    <ReviewQueue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pms/submissions/:id"
                element={
                  <ProtectedRoute>
                    <SubmissionDetail />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route element={<VmsLayout />}>
              <Route
                path="/vms"
                element={
                  <ProtectedRoute>
                    <VmsHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vms/host"
                element={
                  <ProtectedRoute>
                    <VmsHostDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vms/host/visitors"
                element={
                  <ProtectedRoute>
                    <VmsHostDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vms/admin"
                element={
                  <ProtectedRoute>
                    <VmsAdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vms/admin/visitors"
                element={
                  <ProtectedRoute>
                    <VmsAdminPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vms/admin/audit"
                element={
                  <ProtectedRoute>
                    <VmsAdminPanel />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route element={<LmsLayout />}>
              <Route
                path="/lms"
                element={
                  <ProtectedRoute>
                    <LmsHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/courses"
                element={
                  <ProtectedRoute>
                    <CourseCatalog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/courses/:courseId"
                element={
                  <ProtectedRoute>
                    <CoursePlayer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/courses/:courseId/assessment/:type"
                element={
                  <ProtectedRoute>
                    <AssessmentPlayer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/my-learning"
                element={
                  <ProtectedRoute>
                    <MyLearning />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/manage"
                element={
                  <ProtectedRoute>
                    <ManageCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/manage/:courseId"
                element={
                  <ProtectedRoute>
                    <CourseBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/assign"
                element={
                  <ProtectedRoute>
                    <AssignCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/badges-skills"
                element={
                  <ProtectedRoute>
                    <BadgesSkills />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/reports"
                element={
                  <ProtectedRoute>
                    <LmsReports />
                  </ProtectedRoute>
                }
              />
            </Route>

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
          <ConfirmDialogHost />
        </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
