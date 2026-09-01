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
import PMSReport from "./PMS/reports/Reports";
import PMSUserGroup from "./PMS/UserGroups";
import TemplatesList from "./PMS/kpi/TemplatesList";
import TemplateBuilder from "./PMS/kpi/TemplateBuilder";
import AssignTemplate from "./PMS/kpi/AssignTemplate";
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
import MyProfile from "./LMS/pages/MyProfile";
import ManageCourses from "./LMS/pages/ManageCourses";
import CourseBuilder from "./LMS/pages/CourseBuilder";
import AssignCourses from "./LMS/pages/AssignCourses";
import BadgesSkills from "./LMS/pages/BadgesSkills";
import LmsReports from "./LMS/pages/Reports";
import SkillGroups from "./LMS/pages/SkillGroups";
import SkillTests from "./LMS/pages/SkillTests";
import SkillTestBuilder from "./LMS/pages/SkillTestBuilder";
import MySkillTests from "./LMS/pages/MySkillTests";
import SkillTestPlayer from "./LMS/pages/SkillTestPlayer";
import SkillTestReview from "./LMS/pages/SkillTestReview";
import SkillTestResults from "./LMS/pages/SkillTestResults";
import HrmsLayout from "./HRMS/HrmsLayout";
import HrmsDashboard from "./HRMS/pages/Dashboard";
import HrmsJobs from "./HRMS/pages/Jobs";
import HrmsReferrals from "./HRMS/pages/Referrals";
import HrmsEmployees from "./HRMS/pages/Employees";
import HrmsEmployeeProfile from "./HRMS/pages/EmployeeProfile";
import HrmsMyTeam from "./HRMS/pages/MyTeam";
import HrmsOrgChart from "./HRMS/pages/OrgChart";
import HrmsOrganization from "./HRMS/pages/Organization";
import HrmsLeave from "./HRMS/pages/Leave";
import HrmsAttendance from "./HRMS/pages/Attendance";
import HrmsHrRequests from "./HRMS/pages/HrRequests";
import HrmsPayroll from "./HRMS/pages/Payroll";
import HrmsExpenses from "./HRMS/pages/Expenses";
import HrmsAssets from "./HRMS/pages/Assets";
import HrmsLifecycle from "./HRMS/pages/Lifecycle";
import HrmsAnnouncements from "./HRMS/pages/Announcements";
import HrmsDocuments from "./HRMS/pages/Documents";
import AccessGrants from "./pages/AccessGrants";
import Guide from "./pages/Guide";
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
              <Route
                path="review"
                element={
                  <ProtectedRoute moduleRoles={{ module: "timesheet", roles: ["manager", "hr"] }}>
                    <TimesheetReview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="team-status"
                element={
                  <ProtectedRoute moduleRoles={{ module: "timesheet", roles: ["manager", "hr"] }}>
                    <TimesheetTeamStatus />
                  </ProtectedRoute>
                }
              />
              <Route
                path="nsa-report"
                element={
                  <ProtectedRoute moduleRoles={{ module: "timesheet", roles: ["hr"] }}>
                    <TimesheetNsaReport />
                  </ProtectedRoute>
                }
              />
              <Route path="manage" element={<TimesheetManage />} />
              <Route
                path="reports"
                element={
                  <ProtectedRoute moduleRoles={{ module: "timesheet", roles: ["manager", "hr"] }}>
                    <TimesheetReports />
                  </ProtectedRoute>
                }
              />
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
                path="/PMS-reports"
                element={
                  <ProtectedRoute>
                    <PMSReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/PMS-userGroup"
                element={
                  <ProtectedRoute moduleRoles={{ module: "pms", roles: ["manager", "hr"] }}>
                    <PMSUserGroup />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pms/templates"
                element={
                  <ProtectedRoute moduleRoles={{ module: "pms", roles: ["hr"] }}>
                    <TemplatesList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pms/templates/new"
                element={
                  <ProtectedRoute moduleRoles={{ module: "pms", roles: ["hr"] }}>
                    <TemplateBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pms/templates/:id"
                element={
                  <ProtectedRoute moduleRoles={{ module: "pms", roles: ["hr"] }}>
                    <TemplateBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pms/assign/:id"
                element={
                  <ProtectedRoute moduleRoles={{ module: "pms", roles: ["manager", "hr"] }}>
                    <AssignTemplate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user-kra-search"
                element={
                  <ProtectedRoute moduleRoles={{ module: "pms", roles: ["manager", "hr"] }}>
                    <UserKraSearch />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pms/reviews"
                element={
                  <ProtectedRoute moduleRoles={{ module: "pms", roles: ["manager", "hr"] }}>
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
                path="/lms/my-profile"
                element={
                  <ProtectedRoute>
                    <MyProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/manage"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <ManageCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/manage/:courseId"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <CourseBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/assign"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <AssignCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/badges-skills"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <BadgesSkills />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/reports"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <LmsReports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/skill-groups"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <SkillGroups />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/manage-skill-tests"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <SkillTests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/manage-skill-tests/new"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <SkillTestBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/manage-skill-tests/:testId"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <SkillTestBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/manage-skill-tests/:testId/results"
                element={
                  <ProtectedRoute moduleRoles={{ module: "lms", roles: ["manager", "admin"] }}>
                    <SkillTestResults />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/skill-tests"
                element={
                  <ProtectedRoute>
                    <MySkillTests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/skill-tests/:testId/take"
                element={
                  <ProtectedRoute>
                    <SkillTestPlayer />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lms/skill-tests/:testId/review"
                element={
                  <ProtectedRoute>
                    <SkillTestReview />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route element={<HrmsLayout />}>
              <Route
                path="/hrms"
                element={
                  <ProtectedRoute>
                    <HrmsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/attendance"
                element={
                  <ProtectedRoute>
                    <HrmsAttendance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/leave"
                element={
                  <ProtectedRoute>
                    <HrmsLeave />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/payroll"
                element={
                  <ProtectedRoute>
                    <HrmsPayroll />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/expenses"
                element={
                  <ProtectedRoute>
                    <HrmsExpenses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/hr-requests"
                element={
                  <ProtectedRoute>
                    <HrmsHrRequests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/jobs"
                element={
                  <ProtectedRoute>
                    <HrmsJobs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/referrals"
                element={
                  <ProtectedRoute>
                    <HrmsReferrals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/employees"
                element={
                  <ProtectedRoute moduleRoles={{ module: "hrms", roles: ["hr"] }}>
                    <HrmsEmployees />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/employees/:id"
                element={
                  <ProtectedRoute>
                    <HrmsEmployeeProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/organization"
                element={
                  <ProtectedRoute>
                    <HrmsOrganization />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/assets"
                element={
                  <ProtectedRoute>
                    <HrmsAssets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/documents"
                element={
                  <ProtectedRoute>
                    <HrmsDocuments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/announcements"
                element={
                  <ProtectedRoute>
                    <HrmsAnnouncements />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/lifecycle"
                element={
                  <ProtectedRoute moduleRoles={{ module: "hrms", roles: ["hr"] }}>
                    <HrmsLifecycle />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/my-team"
                element={
                  <ProtectedRoute>
                    <HrmsMyTeam />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hrms/org-chart"
                element={
                  <ProtectedRoute>
                    <HrmsOrgChart />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route
              path="/access-grants"
              element={
                <ProtectedRoute>
                  <AccessGrants />
                </ProtectedRoute>
              }
            />

            <Route
              path="/guide"
              element={
                <ProtectedRoute>
                  <Guide />
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
          <ConfirmDialogHost />
        </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
