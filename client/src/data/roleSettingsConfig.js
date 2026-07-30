/**
 * roleSettingsConfig.js
 * ---------------------------------------------------------------------------
 * Central source of truth for:
 *   1. ROLE_KEYS               -> the 5 system roles
 *   2. ROLE_SETTINGS_CONFIG    -> profile / permissions / access points per role
 *   3. FAQS                    -> 10 frequently asked questions about the
 *                                  permission & workflow system
 *   4. GUIDE_STEPS             -> 10-step walkthrough of how a task moves
 *                                  through the system end-to-end
 *   5. getRoleKeyFromUser()    -> helper to normalize a user object -> role key
 *
 * Business rules encoded here (summarised):
 * - ADMIN: full, unrestricted access to everything in the system.
 * - PM: identical to ADMIN except NO user management / role approval access.
 *       PM sees the same company-wide employee reports as ADMIN.
 * - DEVELOPER: works only inside projects they are assigned to. Can create
 *       their own tasks inside those projects. Can close a task ONLY if
 *       they created it themselves. If a task was assigned TO them by
 *       ADMIN/PM, they cannot close it — they can only move it to
 *       "QA Testing" (closing such a task is reserved for ADMIN, PM, QA).
 *       Moving a task to "QA Testing" auto-assigns the QA member already
 *       attached to that project.
 * - QA: same baseline access as DEVELOPER, plus the ability to raise a
 *       bug report against a specific task once it lands in QA Testing,
 *       and to set that bug's status (In Progress, Won't Fix, Fixed, etc).
 * - BUSINESS_USER: read-only access + commenting, no edit/delete rights.
 * ---------------------------------------------------------------------------
 */

export const ROLE_KEYS = {
  ADMIN: "ADMIN",
  PM: "PM",
  DEVELOPER: "DEVELOPER",
  QA: "QA",
  BUSINESS_USER: "BUSINESS_USER",
};

export const TASK_STATUS = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  ON_HOLD: "ON_HOLD",
  QA_TESTING: "QA_TESTING",
  DONE: "DONE",
};

export const BUG_STATUS = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WONT_FIX: "WONT_FIX",
  FIXED: "FIXED",
  REOPENED: "REOPENED",
};

/* ---------------------------------------------------------------------- *
 *  ROLE SETTINGS CONFIG
 * ---------------------------------------------------------------------- */

export const ROLE_SETTINGS_CONFIG = {
  /* ============================== ADMIN ============================== */
  [ROLE_KEYS.ADMIN]: {
    profile: {
      title: "Administrator Profile",
      badgeLabel: "ADMIN",
      fields: [
        { label: "Full Name", valueKey: "name" },
        { label: "Email", valueKey: "email" },
        { label: "Role", value: "Administrator" },
        { label: "Status", value: "Active" },
      ],
    },
    permissions: [
      {
        label: "Manage Users",
        desc: "Create, edit, suspend and manage all user accounts",
        allowed: true,
      },
      {
        label: "Approve / Reject Accounts",
        desc: "Approve new sign-ups and change any employee's role",
        allowed: true,
      },
      {
        label: "Create Projects",
        desc: "Create new projects and configure project settings",
        allowed: true,
      },
      {
        label: "Edit / Delete Projects",
        desc: "Update project details, deadlines and remove projects",
        allowed: true,
      },
      {
        label: "Manage All Tasks",
        desc: "Create, edit, close and delete ANY task in ANY project",
        allowed: true,
      },
      {
        label: "Create & Manage Sprints",
        desc: "Create sprints and assign tasks to them",
        allowed: true,
      },
      {
        label: "Assign Employees",
        desc: "Assign developers, QA and business users to projects/tasks",
        allowed: true,
      },
      {
        label: "Manage Bug Reports",
        desc: "View, edit, reassign and delete any bug report",
        allowed: true,
      },
      {
        label: "Comment on Task / Project",
        desc: "Add comments on any task or project",
        allowed: true,
      },
      {
        label: "Edit Deadlines",
        desc: "Update or correct any task / project deadline",
        allowed: true,
      },
      {
        label: "View All Notifications",
        desc: "See every system notification across all projects",
        allowed: true,
      },
      {
        label: "View All Employee Reports",
        desc: "Access every employee's performance & activity report",
        allowed: true,
      },
      {
        label: "Export Data",
        desc: "Export tasks, reports and project files in any format",
        allowed: true,
      },
      {
        label: "Global Settings",
        desc: "Update platform-wide configuration",
        allowed: true,
      },
    ],
    accessPoints: [
      "All Dashboard Modules",
      "User & Role Management",
      "Account Approvals",
      "Project & Task Administration (full CRUD)",
      "Bug Reports & Resolution",
      "Sprint Planning",
      "All Employee Reports",
      "Data Export Center",
      "System Settings & Notifications",
    ],
  },

  /* ================================ PM ================================ */
  [ROLE_KEYS.PM]: {
    profile: {
      title: "Project Manager Profile",
      badgeLabel: "PM",
      fields: [
        { label: "Full Name", valueKey: "name" },
        { label: "Email", valueKey: "email" },
        { label: "Role", value: "Project Manager" },
        { label: "Status", value: "Active" },
      ],
    },
    permissions: [
      {
        label: "Create Projects",
        desc: "Create new projects and own them end-to-end",
        allowed: true,
      },
      {
        label: "Edit / Delete Own Projects",
        desc: "Update details, deadlines and remove projects they created",
        allowed: true,
      },
      {
        label: "Manage All Tasks",
        desc: "Create, edit, close and delete tasks inside their projects",
        allowed: true,
      },
      {
        label: "Create & Manage Sprints",
        desc: "Create sprints for any project they manage or are assigned to",
        allowed: true,
      },
      {
        label: "Assign Employees",
        desc: "Assign developers, QA and business users to projects/tasks",
        allowed: true,
      },
      {
        label: "Close Any Task",
        desc: "Close tasks assigned to developers once QA approves, same as Admin",
        allowed: true,
      },
      {
        label: "Manage Bug Reports",
        desc: "View and reassign bug reports raised by QA",
        allowed: true,
      },
      {
        label: "Comment on Task / Project",
        desc: "Add comments on any task or project",
        allowed: true,
      },
      {
        label: "Edit Deadlines",
        desc: "Update or correct task / project deadlines",
        allowed: true,
      },
      {
        label: "View All Notifications",
        desc: "See notifications across all of their projects",
        allowed: true,
      },
      {
        label: "View All Employee Reports",
        desc: "Same company-wide reporting access as Admin",
        allowed: true,
      },
      {
        label: "Export Data",
        desc: "Export tasks, reports and project files",
        allowed: true,
      },
      {
        label: "Manage Users",
        desc: "Only Admin can create/suspend user accounts",
        allowed: false,
      },
      {
        label: "Approve / Reject Accounts",
        desc: "Only Admin can approve sign-ups or change roles",
        allowed: false,
      },
      {
        label: "Global Settings",
        desc: "Only Admin can change platform-wide settings",
        allowed: false,
      },
    ],
    accessPoints: [
      "My Projects (create / edit / delete)",
      "Team & Role Assignments (per project)",
      "Sprint Planning",
      "Task Distribution",
      "Bug Report Overview",
      "All Employee Reports",
      "Data Export Center",
      "Notifications",
    ],
  },

  /* ============================== DEVELOPER ============================== */
  [ROLE_KEYS.DEVELOPER]: {
    profile: {
      title: "Developer Profile",
      badgeLabel: "DEVELOPER",
      fields: [
        { label: "Full Name", valueKey: "name" },
        { label: "Email", valueKey: "email" },
        { label: "Role", value: "Developer" },
        { label: "Status", value: "Active" },
      ],
    },
    permissions: [
      {
        label: "View Assigned Projects",
        desc: "Full project view: team, lead, due dates and progress steps",
        allowed: true,
      },
      {
        label: "View Assigned Tasks",
        desc: "See tasks assigned to you by Admin/PM",
        allowed: true,
      },
      {
        label: "Create Personal Tasks",
        desc: "Create and self-manage tasks inside assigned projects",
        allowed: true,
      },
      {
        label: "Close Own-Created Tasks",
        desc: "Close any task you personally created",
        allowed: true,
      },
      {
        label: "Close Admin/PM-Assigned Tasks",
        desc: "Tasks assigned TO you by Admin/PM cannot be closed by you — move to QA Testing instead",
        allowed: false,
      },
      {
        label: "Move Task to QA Testing",
        desc: "Send a task for QA review; the project's QA is auto-assigned",
        allowed: true,
      },
      {
        label: "Add Task Comments",
        desc: "Collaborate with Admin/PM through task comments",
        allowed: true,
      },
      {
        label: "View Project Sprints",
        desc: "See sprint plans and progress for assigned projects",
        allowed: true,
      },
      {
        label: "View Personal Reports",
        desc: "See your own performance/activity report in the Reports tab",
        allowed: true,
      },
      {
        label: "Receive Notifications",
        desc: "Get alerts for task updates, comments and sprint changes",
        allowed: true,
      },
      {
        label: "Manage Team / Users",
        desc: "Only Admin/PM can manage users and permissions",
        allowed: false,
      },
      {
        label: "Delete Projects",
        desc: "Restricted administrative action",
        allowed: false,
      },
      {
        label: "View All Employee Reports",
        desc: "Only your own reports are visible, not company-wide",
        allowed: false,
      },
      {
        label: "System Settings Access",
        desc: "Only administrators can modify platform settings",
        allowed: false,
      },
    ],
    accessPoints: [
      "View Assigned Projects (detailed view)",
      "My Tasks",
      "Create Personal Tasks",
      "Move Task to QA Testing",
      "Add Task Comments",
      "Project Sprints",
      "My Reports",
      "Notifications",
    ],
  },

  /* ================================ QA ================================ */
  [ROLE_KEYS.QA]: {
    profile: {
      title: "QA Engineer Profile",
      badgeLabel: "QA ENGINEER",
      fields: [
        { label: "Full Name", valueKey: "name" },
        { label: "Email", valueKey: "email" },
        { label: "Role", value: "QA Engineer" },
        { label: "Status", value: "Active" },
      ],
    },
    permissions: [
      {
        label: "View Assigned Projects",
        desc: "Full project view: team, lead, due dates and progress steps",
        allowed: true,
      },
      {
        label: "View Assigned Tasks",
        desc: "See tasks assigned to you and tasks waiting in QA Testing",
        allowed: true,
      },
      {
        label: "Create Personal Tasks",
        desc: "Create and self-manage tasks inside assigned projects",
        allowed: true,
      },
      {
        label: "Close Own-Created Tasks",
        desc: "Close any task you personally created",
        allowed: true,
      },
      {
        label: "Close Task After QA Pass",
        desc: "Mark a QA-Testing task as Done once it passes verification",
        allowed: true,
      },
      {
        label: "Create Bug Report (per task)",
        desc: "Raise a bug report tied to a specific task that failed QA",
        allowed: true,
      },
      {
        label: "Update Bug Status",
        desc: "Set status: In Progress, Won't Fix, Fixed, Reopened, etc.",
        allowed: true,
      },
      {
        label: "Add Task Comments",
        desc: "Collaborate with Admin/PM/Developer through task comments",
        allowed: true,
      },
      {
        label: "View Project Sprints",
        desc: "See sprint plans and progress for assigned projects",
        allowed: true,
      },
      {
        label: "View Personal Reports",
        desc: "See your own performance/activity report in the Reports tab",
        allowed: true,
      },
      {
        label: "Assign Bugs to Developers",
        desc: "Bug routing/assignment is handled by PM, not QA",
        allowed: false,
      },
      {
        label: "Delete Bug Reports / Tasks",
        desc: "Deleting is restricted to Admin only",
        allowed: false,
      },
      {
        label: "Manage Users / Roles",
        desc: "Cannot manage users or roles",
        allowed: false,
      },
      {
        label: "System Settings Access",
        desc: "Only Admin can change global settings",
        allowed: false,
      },
    ],
    accessPoints: [
      "View Assigned Projects (detailed view)",
      "My Tasks & QA Testing Queue",
      "Create Personal Tasks",
      "Raise Bug Report (task-wise)",
      "Update Bug Status",
      "Add Task Comments",
      "Project Sprints",
      "My Reports",
    ],
  },

  /* ========================== BUSINESS USER ========================== */
  [ROLE_KEYS.BUSINESS_USER]: {
    profile: {
      title: "Business User Profile",
      badgeLabel: "BUSINESS USER",
      fields: [
        { label: "Full Name", valueKey: "name" },
        { label: "Email", valueKey: "email" },
        { label: "Role", value: "Business User" },
        { label: "Status", value: "Active" },
      ],
    },
    permissions: [
      {
        label: "View Projects",
        desc: "View all project details and info (read-only)",
        allowed: true,
      },
      {
        label: "Add Comments",
        desc: "Provide feedback on projects and tasks",
        allowed: true,
      },
      {
        label: "View Project Status",
        desc: "Track project progress and timelines",
        allowed: true,
      },
      {
        label: "Read Reports",
        desc: "Access project reports and summaries",
        allowed: true,
      },
      {
        label: "Edit Projects",
        desc: "Cannot edit project details (PM/Admin only)",
        allowed: false,
      },
      {
        label: "Manage Tasks",
        desc: "Cannot create, assign or close tasks",
        allowed: false,
      },
      {
        label: "Delete or Modify Data",
        desc: "Cannot delete anything (Admin only)",
        allowed: false,
      },
      {
        label: "User Management",
        desc: "Cannot manage users or roles",
        allowed: false,
      },
    ],
    accessPoints: [
      "Read-Only Project Access",
      "Comment & Feedback",
      "View Project Status",
      "Read Reports & Summaries",
    ],
  },
};

/* ---------------------------------------------------------------------- *
 *  FAQS — 10 frequently asked questions
 * ---------------------------------------------------------------------- */

export const FAQS = [
  {
    id: "faq-1",
    question: "Who can close a task?",
    answer:
      "Admin and PM can close any task. A Developer can only close a task they created themselves. If a task was assigned to a Developer by Admin/PM, the Developer cannot close it — they must move it to QA Testing, and only Admin, PM, or QA can close it after that.",
  },
  {
    id: "faq-2",
    question: "What happens when a Developer moves a task to QA Testing?",
    answer:
      "The system automatically assigns the QA member already attached to that project, so no manual QA selection is needed. The task then appears in that QA member's testing queue.",
  },
  {
    id: "faq-3",
    question: "Can QA assign bugs to developers?",
    answer:
      "No. QA can raise a bug report against a specific task and set its status (In Progress, Won't Fix, Fixed, etc.), but routing/assigning that bug to a developer is handled by the PM.",
  },
  {
    id: "faq-4",
    question: "What is the difference between Admin and PM access?",
    answer:
      "PM has nearly identical access to Admin — creating projects, sprints, tasks, assigning team members, editing deadlines, and viewing company-wide employee reports. The only thing PM cannot do is manage user accounts or approve/change a user's role; that is Admin-only.",
  },
  {
    id: "faq-5",
    question: "Can a Developer see other employees' reports?",
    answer:
      "No. Developers and QA only see their own personal performance report in the Reports tab. Company-wide employee reports are visible only to Admin and PM.",
  },
  {
    id: "faq-6",
    question: "Who approves new user sign-ups or changes a user's role?",
    answer:
      "Only Admin can approve or reject pending accounts and change an employee's role. This permission is not available to PM, Developer, QA, or Business User.",
  },
  {
    id: "faq-7",
    question: "Can a Business User edit or delete a project?",
    answer:
      "No. Business Users have read-only access — they can view projects, view status, read reports, and add comments, but cannot edit, delete, or manage tasks.",
  },
  {
    id: "faq-8",
    question: "Can Developers and QA create their own tasks?",
    answer:
      "Yes. Inside any project they're assigned to, both Developers and QA can create personal tasks and manage their own status, in addition to working on tasks assigned to them.",
  },
  {
    id: "faq-9",
    question: "Who can export files and reports?",
    answer:
      "Admin and PM can export tasks, reports, and project files. Developer, QA, and Business User roles do not have export access.",
  },
  {
    id: "faq-10",
    question: "Can anyone other than Admin edit a deadline?",
    answer:
      "PM can also edit and correct deadlines for the projects/tasks under their management, same as Admin. Developer, QA, and Business User cannot edit deadlines.",
  },
];

/* ---------------------------------------------------------------------- *
 *  GUIDE_STEPS — 10-step walkthrough of the task lifecycle
 * ---------------------------------------------------------------------- */

export const GUIDE_STEPS = [
  {
    step: 1,
    title: "Admin sets up the team",
    description:
      "Admin approves new sign-ups and assigns each employee a role: PM, Developer, QA, or Business User.",
  },
  {
    step: 2,
    title: "PM (or Admin) creates a project",
    description:
      "A project is created with a name, description, deadline, and a team made up of Developers, QA, and Business Users.",
  },
  {
    step: 3,
    title: "PM (or Admin) plans a sprint",
    description:
      "A sprint is created inside the project to group related tasks together with a start and end date.",
  },
  {
    step: 4,
    title: "Tasks are created",
    description:
      "Admin or PM creates and assigns tasks to Developers, OR a Developer/QA creates their own personal task inside the project they're assigned to.",
  },
  {
    step: 5,
    title: "Developer works the task",
    description:
      "The assigned Developer moves the task from TODO to In Progress, adding comments along the way for visibility.",
  },
  {
    step: 6,
    title: "Developer finishes the task",
    description:
      "If the Developer created the task themselves, they can close it directly. If it was assigned by Admin/PM, they instead move it to QA Testing.",
  },
  {
    step: 7,
    title: "QA is auto-assigned",
    description:
      "The moment a task is moved to QA Testing, the QA member already on that project is automatically attached to it — no manual selection required.",
  },
  {
    step: 8,
    title: "QA tests the task",
    description:
      "QA reviews the work. If it fails, QA creates a bug report tied to that exact task and sets its status (In Progress, Won't Fix, etc.).",
  },
  {
    step: 9,
    title: "Bug gets routed and fixed",
    description:
      "PM reviews the bug report and routes it back to the right Developer. The Developer fixes it and the task returns to QA Testing for re-verification.",
  },
  {
    step: 10,
    title: "Task is closed",
    description:
      "Once QA confirms the task passes, Admin, PM, or QA closes it as Done. Employee reports, sprint progress, and notifications update automatically for everyone involved.",
  },
];

/* ---------------------------------------------------------------------- *
 *  Helper: normalize a user object into one of ROLE_KEYS
 * ---------------------------------------------------------------------- */

export function getRoleKeyFromUser(user) {
  if (!user) return null;
  const fromRoles = Array.isArray(user.roles) ? user.roles[0] : null;
  const fromRole = user.role || null;

  const normalize = (v) => {
    if (!v) return null;
    const s = String(v).toUpperCase();
    if (s.includes("ADMIN")) return ROLE_KEYS.ADMIN;
    if (s === "PM" || s.includes("PROJECT MANAGER") || s.includes("MANAGER"))
      return ROLE_KEYS.PM;
    if (s.includes("QA")) return ROLE_KEYS.QA;
    if (s.includes("BUSINESS")) return ROLE_KEYS.BUSINESS_USER;
    if (s.includes("DEVELOPER") || s.includes("DEV"))
      return ROLE_KEYS.DEVELOPER;
    if (Object.values(ROLE_KEYS).includes(v)) return v;
    return null;
  };

  return normalize(fromRoles) || normalize(fromRole) || null;
}

/* ---------------------------------------------------------------------- *
 *  Helper: can a given role close a given task?
 *  (task = { createdByUserId, assignedByRole, status })
 * ---------------------------------------------------------------------- */

export function canCloseTask(roleKey, task, currentUserId) {
  if (roleKey === ROLE_KEYS.ADMIN || roleKey === ROLE_KEYS.PM) return true;

  if (roleKey === ROLE_KEYS.QA) {
    return task.status === TASK_STATUS.QA_TESTING;
  }

  if (roleKey === ROLE_KEYS.DEVELOPER) {
    const isOwnTask = task.createdByUserId === currentUserId;
    return isOwnTask;
  }

  return false;
}
