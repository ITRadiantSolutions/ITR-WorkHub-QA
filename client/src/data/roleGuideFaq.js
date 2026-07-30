import { ROLE_KEYS } from "./roleSettingsConfig";

// Role-wise Guide & FAQ content.
// Keys MUST stay aligned with ROLE_KEYS.
export const ROLE_GUIDE_FAQ = {
  [ROLE_KEYS.ADMIN]: {
    guide: [
      {
        title: "Administrator Overview",
        content:
          "As an Admin, you oversee global configuration, user/role management, and platform-wide governance. In Sprint & Stories, your role is to ensure the workflow is configured correctly and that teams can move stories through their lifecycle without permission or routing issues.",
      },
      {
        title: "Sprint & Story goal (big picture)",
        content:
          "A Sprint groups a set of Stories (work items) into a time-box. During the sprint, each Story progresses through a workflow. Your objective is to keep the system running correctly so stories can move from planning to completion—consistently and with the right verification steps.",
      },
      {
        title: "Story lifecycle you should enforce",
        content:
          "For story delivery, follow the workflow expectation: To Do → In Progress → Testing → Done. Developers start work by moving to In Progress. QA verifies in Testing. Only stories that pass verification (or have resolved issues) are eligible to become Done. If something is blocked, investigate the story’s related bugs and ownership before expecting closure.",
      },
      {
        title: "Handle bugs as part of story completion",
        content:
          "When QA finds defects, a Bug report is created and the story should return to Testing after fixes. Your job is not to ‘skip verification’, but to ensure the correct people can work on and resolve issues so the story can reach a verified Done state.",
      },
      {
        title: "Re-route / recover when stories get stuck",
        content:
          "If a story is stuck (e.g., repeatedly returning to QA Testing or waiting on the wrong assignee), correct the underlying cause: wrong routing, missing permissions, incorrect assignee assignment, or unresolved bug status. Update sprint expectations and re-route to restore a smooth flow.",
      },
      {
        title: "Manage users, roles & access",
        content:
          "Approve sign-ups, manage roles, and ensure permissions match the intended workflow responsibilities. A missing or incorrect role is the most common reason why buttons/actions appear disabled for sprint execution.",
      },
      {
        title: "Set up projects to enable correct sprint flow",
        content:
          "Create and configure projects so that stories have proper targets: developers, QA, and (where relevant) business stakeholders. Correct project configuration ensures tasks/stories reach the right queues when moved into Testing.",
      },
      {
        title: "Create/manage tasks for sprint execution",
        content:
          "Admins can create tasks and assign them so they appear in the correct queues. Ensure each work item is associated with the correct project so workflow routing (especially QA routing) works reliably.",
      },
      {
        title: "Use sprint planning to track delivery",
        content:
          "Create sprints, define sprint dates, and monitor sprint progress as work items move between statuses. Sprint visibility should reflect reality: if work is blocked, update/report it rather than marking completion early.",
      },
      {
        title: "Close tasks only after verification is complete",
        content:
          "Use Done as the ‘verified completion’ state. Close tasks/stories only when requirements are met and QA verification is satisfied (or the workflow creation/ownership model explicitly allows closure). If bugs remain open, keep the story in Testing until resolved.",
      },
      {
        title: "Review reports & export for stakeholders",
        content:
          "Use reports to validate sprint delivery: how many items moved, where the bottlenecks are, and which stories were completed. Export/share progress when needed for stakeholders and continuous improvement.",
      },
    ],
    faq: [
      {
        q: "Where can I manage users and roles?",
        a: "Go to the Admin/Settings area and open user/role management. Admins can approve sign-ups and adjust roles so users have the correct workflow permissions.",
      },
      {
        q: "How do I update platform-wide settings?",
        a: "Global settings are Admin-only. Use the System/Settings area and update configuration carefully because it affects workflow behavior and access permissions.",
      },
      {
        q: "Why can’t certain actions be performed by other roles?",
        a: "The app enforces role-based permissions. If a button is missing/disabled, that specific action is not allowed for the current role.",
      },
      {
        q: "What is the correct Story lifecycle during a Sprint?",
        a: "Expect: To Do → In Progress → Testing → Done. Developers drive To Do/In Progress; QA drives Testing verification; Done should be reserved for verified completion.",
      },
      {
        q: "Why does a story keep returning to QA Testing?",
        a: "That usually means QA raised issues/defects and fixes were applied (or needed) but acceptance criteria were not fully satisfied. Continue the bug → fix → re-test loop until verification passes.",
      },
      {
        q: "How do bugs impact when I can mark a story as Done?",
        a: "A story should not be treated as completed while relevant bugs are unresolved/open. After developers fix defects, return the story to Testing for re-verification. Mark Done only after QA confirms requirements are met.",
      },
      {
        q: "Can I close a story directly without QA sign-off?",
        a: "Admin can close tasks when allowed by the permission model, but the operational expectation is verified completion. If QA bugs remain open or acceptance criteria aren’t met, resolve issues first.",
      },
      {
        q: "Who decides the QA routing when a story enters Testing?",
        a: "Routing is handled by project configuration. When a story/task is moved into QA Testing, the system routes it to the QA member attached to that project.",
      },
      {
        q: "Can QA assign bugs directly to developers?",
        a: "No. QA reports defects via bug reports and updates bug lifecycle/status. Routing the fix work back to developers is managed through PM/Admin workflow actions.",
      },
      {
        q: "How do I handle a sprint where work keeps getting blocked?",
        a: "Identify the bottleneck: wrong assignee, missing role permissions, misconfigured project routing, or unresolved bug status. Correct the root cause, then re-route the story so the next workflow transition can happen.",
      },
      {
        q: "Where can I view activity and sprint delivery progress?",
        a: "Use Reports and Export Center to review story/task movement, completion status, and the overall delivery picture for stakeholders.",
      },
    ],
  },

  [ROLE_KEYS.PM]: {
    guide: [
      {
        title: "Project Manager Overview",
        content:
          "As a PM, you coordinate sprints, distribute work, and ensure stories move smoothly through the workflow. Your focus is removing blockers, routing fixes after QA reports issues, and keeping sprint delivery accurate.",
      },
      {
        title: "Sprint planning: group stories by time-box",
        content:
          "Create sprints and group the stories/tasks that must be delivered within the sprint dates. Sprint views help you track which items are currently in To Do, In Progress, Testing, and Done.",
      },
      {
        title: "Create/manage projects to support story routing",
        content:
          "Ensure projects have the right members (Developers and QA) and setup, so when you route a story to Testing, it automatically appears in the correct QA queue.",
      },
      {
        title: "Create stories/tasks and assign owners",
        content:
          "Break sprint goals into tasks/stories and assign them to developers. Assignments affect visibility and ownership—so keep assignees correct to prevent stories from getting stuck.",
      },
      {
        title: "Track story progress through workflow stages",
        content:
          "Monitor movement: To Do → In Progress → Testing → Done. Use task comments/updates so QA and developers understand expected behavior, progress, and any blockers preventing the next stage.",
      },
      {
        title: "Send stories to QA Testing (verification gate)",
        content:
          "When work is ready for verification, move the story/task into QA Testing. The system routes it to the QA member for that project, initiating verification.",
      },
      {
        title: "Review QA outcomes and route fixes",
        content:
          "If QA raises bugs, review the reported issues and route the fix work back to the appropriate developer(s). The story should return to Testing after fixes so QA can re-verify.",
      },
      {
        title: "Coordinate re-verification loops",
        content:
          "After developers implement fixes, ensure the story is re-submitted into QA Testing. Repeat until acceptance criteria are satisfied and QA confirms readiness for completion.",
      },
      {
        title: "Close stories as Done only when verified",
        content:
          "Once QA confirms the story meets requirements with no unresolved issues, close it as Done. This ensures sprint status reflects verified delivery and reduces reporting confusion.",
      },
      {
        title: "Report progress & export sprint delivery",
        content:
          "Use reports/export to share sprint progress, delivery counts, and bottlenecks with Admin/stakeholders. Keep updates aligned with what actually happened in the workflow.",
      },
    ],
    faq: [
      {
        q: "How do I send a story/task to QA?",
        a: "Move the task/story into QA Testing. QA routing is handled automatically based on the project’s configured QA member(s).",
      },
      {
        q: "What’s the difference between ‘In Progress’ and ‘Testing’?",
        a: "In Progress is when development is being performed. Testing is the verification gate where QA validates behavior against acceptance criteria and may raise bugs.",
      },
      {
        q: "Can I edit global settings?",
        a: "No. Global/platform-wide configuration is Admin-only.",
      },
      {
        q: "Why can’t I close every task immediately?",
        a: "Because sprint completion is gated by verification. If QA testing is required, closure should happen only after QA confirms requirements are met and defects are resolved.",
      },
      {
        q: "What happens when QA sets a bug status?",
        a: "QA updates the bug lifecycle to reflect testing outcomes (e.g., Fixed, Reopened, Won’t Fix). You should review the status and route the correct next action back to developers.",
      },
      {
        q: "How do comments help during sprint execution?",
        a: "Comments document what changed, what was expected, what was tested, and what is blocked. This reduces back-and-forth during re-verification cycles.",
      },
      {
        q: "How do I distribute tasks to developers correctly?",
        a: "Create tasks within the correct project/sprint and assign developers as owners/assignees. Only members of that project should reliably see and receive the routing/queue items.",
      },
      {
        q: "Can a Developer close a task that was assigned by PM?",
        a: "Usually no. When PM/admin assigns work, developers focus on fixing and hand-off to QA Testing; closure typically happens after verification (or per permission model).",
      },
      {
        q: "Where do I see sprint progress?",
        a: "Use the Sprints module to view sprint status and story/task movement across stages.",
      },
      {
        q: "How do deadlines affect sprint execution?",
        a: "Deadline changes update sprint/task timelines and influence reporting. Keep them accurate so sprint dashboards reflect real delivery expectations.",
      },
    ],
  },

  [ROLE_KEYS.DEVELOPER]: {
    guide: [
      {
        title: "Developer Overview",
        content:
          "As a Developer, you implement story/task work assigned to you. Your responsibilities include moving work through the workflow appropriately, responding to QA feedback by fixing reported defects, and supporting re-verification until the story is ready for Done.",
      },
      {
        title: "Work in your assigned queue",
        content:
          "Use the Tasks view to see items assigned to you. If you create tasks, ensure they are inside projects you belong to so they appear in the correct workflow scope.",
      },
      {
        title: "Start development (To Do → In Progress)",
        content:
          "When you begin, move your task/story into In Progress. This signals to PM/QA that development has started and the item is actively being worked on.",
      },
      {
        title: "Use comments to clarify progress and blockers",
        content:
          "Add task comments to explain what you changed, what remains, and how it matches acceptance criteria. If you need help, clarify requirements early so QA testing doesn’t find preventable mismatches.",
      },
      {
        title: "Finish development and hand-off to QA Testing",
        content:
          "When development is complete and the story is ready for verification, hand it off by moving it to QA Testing (when your permissions allow) or by coordinating with PM to route it for QA.",
      },
      {
        title: "Respond to QA bug reports",
        content:
          "If QA finds defects, create a fix and drive the story back into QA Testing for re-verification. Treat QA bugs as evidence that acceptance criteria are not yet met.",
      },
      {
        title: "Re-verify changes (avoid partial fixes)",
        content:
          "After you address reported issues, ensure the story returns to Testing. Wait for QA to confirm the fix solves the problem and the story meets expected behavior.",
      },
      {
        title: "Understand when you can close as Done",
        content:
          "Closing is restricted by ownership/permission rules. If a task/story was assigned to you by PM/Admin, you typically cannot close it directly. The expected flow is: fix → QA Testing → PM/Admin closure as Done.",
      },
      {
        title: "Track your performance using reports & notifications",
        content:
          "Use Reports and Notifications to track your activity, comments, and sprint-related workflow events.",
      },
    ],
    faq: [
      {
        q: "How do I update a task/story status?",
        a: "Open the task view and select the next allowed status from the status control. Only transitions allowed for your role and current workflow stage will be enabled.",
      },
      {
        q: "Why can I only move tasks to certain statuses?",
        a: "Workflow transitions are permission-gated. The system enables only the next valid transitions based on your role and the story’s current stage.",
      },
      {
        q: "A PM/Admin assigned a story to me—can I close it as Done?",
        a: "Usually no. If PM/Admin assigned the story, you typically complete implementation and hand it to QA Testing for verification. Closure happens after QA confirmation (and based on permission rules).",
      },
      {
        q: "What should I do if QA keeps raising bugs for the same story?",
        a: "Continue the fix → re-test loop. Review QA comments carefully (expected behavior, reproduction steps, and acceptance criteria) and ensure your fix addresses the root cause rather than only the symptom.",
      },
      {
        q: "How does QA hand-off routing work when I move to QA Testing?",
        a: "When a task/story enters QA Testing, the system routes it to the QA member configured for that project automatically.",
      },
      {
        q: "Can I create personal tasks?",
        a: "Yes, if they are created within projects you have access to. You can manage your personal tasks and close them when appropriate based on permissions and workflow rules.",
      },
      {
        q: "Do comments affect QA/testing?",
        a: "Yes. Comments provide context for PM/QA: what changed, what was tested, and what you expect. This helps QA verify correctly and reduces rework.",
      },
      {
        q: "Why don’t I see some buttons/actions?",
        a: "Those actions are disabled by permission rules. Use the workflow steps that your role is allowed to perform for that story stage and ownership.",
      },
      {
        q: "Can I edit deadlines or project configuration?",
        a: "No. Deadline/project configuration is PM/Admin responsibility. Focus on implementing and communicating story progress.",
      },
      {
        q: "Where can I see my updates and notifications?",
        a: "Use Notifications and Reports in your dashboard to see activity related to your stories, comments, and sprint workflow events.",
      },
    ],
  },

  [ROLE_KEYS.QA]: {
    guide: [
      {
        title: "QA Engineer Overview",
        content:
          "As QA, your responsibility is to verify stories meet requirements and acceptance criteria. When you find issues, raise bug reports linked to the relevant task/story, and support the re-test loop until defects are resolved and the story is ready for completion.",
      },
      {
        title: "Start with your QA Testing queue",
        content:
          "Open your tasks queue filtered for QA Testing. These are items that have been handed off for verification.",
      },
      {
        title: "Validate behavior against acceptance criteria",
        content:
          "Test the story against expected behavior. Confirm acceptance criteria and explore edge cases. If something fails, document it so the development team can fix it effectively.",
      },
      {
        title: "Report bugs when needed",
        content:
          "If you detect defects, create bug reports linked to the story/task. Include severity and clear description (what happened, expected vs actual, and any relevant steps to reproduce if available).",
      },
      {
        title: "Use bug lifecycle statuses to reflect reality",
        content:
          "Update the bug lifecycle (e.g., In Progress, Fixed, Reopened, Won’t Fix) based on follow-up testing and what you observe after fixes are applied.",
      },
      {
        title: "Coordinate with PM/Developers through comments",
        content:
          "Use task comments to share test results, reproduction steps, and acceptance criteria confirmations. This reduces ambiguity and speeds up re-verification.",
      },
      {
        title: "Re-test after fixes",
        content:
          "When developers address bugs, the story/task returns for further QA Testing. Re-verify to confirm the fix resolved the issue and did not introduce regressions.",
      },
      {
        title: "Mark story ready for Done",
        content:
          "After everything passes and there are no unresolved issues related to the story, move/close according to your permission level and workflow stage—so the story can reach Done safely.",
      },
      {
        title: "Respect ownership and routing rules",
        content:
          "QA verifies and reports. Routing fixes back to developers is handled by PM/Admin workflows. Avoid trying to perform non-QA actions outside your permissions.",
      },
    ],
    faq: [
      {
        q: "How do I report a bug?",
        a: "Open the story/task that is in QA Testing and use the Bug Report option to create a bug linked to that specific item.",
      },
      {
        q: "What should I include in a good bug report?",
        a: "Clearly describe what failed, what you expected, and how to reproduce. If you know severity/impact, include it—this helps developers prioritize and fix correctly.",
      },
      {
        q: "When should a story be moved to Done?",
        a: "After verification is complete and the story satisfies acceptance criteria with no open/unresolved issues tied to it.",
      },
      {
        q: "Can QA assign bugs directly to developers?",
        a: "No. QA creates bug reports and updates their status. PM/Admin routes the work back to developers through the story workflow.",
      },
      {
        q: "How do bug statuses affect the workflow?",
        a: "Bug lifecycle statuses reflect testing outcomes across iterations (e.g., Fixed vs Reopened). They guide the re-test loop until the story is verified and complete.",
      },
      {
        q: "Can QA change global system settings?",
        a: "No. Global configuration is Admin-only.",
      },
      {
        q: "Do I need to keep the story in QA Testing after raising a bug?",
        a: "Yes. Keep the story in the verification path until the issue is resolved through re-testing and acceptance criteria are met.",
      },
      {
        q: "Where do I see my QA testing items?",
        a: "In the Tasks section filtered for QA Testing items assigned to you.",
      },
      {
        q: "What if a story keeps coming back to QA Testing?",
        a: "That indicates fixes were applied but QA still found gaps, or further verification is needed. Continue re-testing until acceptance criteria are fully satisfied.",
      },
      {
        q: "Can QA edit/delete bug reports?",
        a: "Bug deletion is typically restricted (Admin/PM). QA can still update bug status and provide test feedback via comments.",
      },
    ],
  },

  [ROLE_KEYS.BUSINESS_USER]: {
    guide: [
      {
        title: "Business User Overview",
        content:
          "As a Business User, you monitor sprint/story delivery, validate whether outcomes match business expectations, and provide feedback early. You mainly influence quality through review and comments rather than through workflow control.",
      },
      {
        title: "Track story/project status during the sprint",
        content:
          "Use Projects and Sprint views to understand where stories are in the workflow. Focus on whether the work aligns with business intent and milestones.",
      },
      {
        title: "Review deliverables using reports & summaries",
        content:
          "Open Reports for role-relevant summaries. Use these to check delivery progress and understand overall performance without needing internal workflow details.",
      },
      {
        title: "Give feedback using comments",
        content:
          "Leave clear feedback on tasks/stories: what is expected, what seems wrong, and what success looks like. Your input helps PM/QA tighten acceptance criteria and reduces rework loops.",
      },
      {
        title: "Participate during QA cycles",
        content:
          "When stories enter QA Testing, review the outcome and provide product/requirements feedback via comments. This helps ensure the final result matches acceptance criteria, not just technical behavior.",
      },
      {
        title: "Confirm key deliverables before Done",
        content:
          "As a story approaches completion, verify that scope and business expectations are met. If something is missing, raise it via comments promptly.",
      },
      {
        title: "Report requirement gaps early",
        content:
          "If something doesn’t match expectations, report it early—before the story is marked Done. Early feedback prevents late-stage rollbacks and repeated fixes.",
      },
      {
        title: "Understand your role limitations",
        content:
          "Business Users are generally read-only for edits/deletes. Your impact is through visibility, review, and feedback comments.",
      },
    ],
    faq: [
      {
        q: "Can I create tasks or stories?",
        a: "No. Task/story creation, assignment, and workflow closure are restricted to PM/Admin (and QA/Dev actions within their allowed workflow responsibilities).",
      },
      {
        q: "Can I edit or delete projects?",
        a: "No. Project editing/deleting is restricted to PM/Admin. Business Users can view projects and leave comments for guidance/clarification.",
      },
      {
        q: "Where can I read reports?",
        a: "Use the Reports section in the dashboard. You’ll see role-relevant summaries and delivery insights.",
      },
      {
        q: "Can I comment on tasks or projects?",
        a: "Yes. Comments are the best way to share requirements feedback, questions, or suggested changes. PM/Dev/QA will review and act on it.",
      },
      {
        q: "Can I see company-wide employee reports?",
        a: "Usually not. Access to detailed employee performance reports is restricted to Admin/PM.",
      },
      {
        q: "How do I request a change?",
        a: "Add a comment to the relevant task/story explaining what must change and why. PM can then adjust scope, re-route work, or create follow-up tasks.",
      },
      {
        q: "What if I disagree with QA results?",
        a: "Explain the mismatch clearly in comments—point to acceptance criteria, expected behavior, or missing requirements. This helps the team rework correctly.",
      },
      {
        q: "Can I access bug details?",
        a: "You may see bug references through the related story/task. Direct bug management actions (edit/delete) remain restricted to Admin/PM/QA depending on permissions.",
      },
      {
        q: "Do notifications include comment updates?",
        a: "Yes. Notifications typically include activity such as task changes, comment updates, and sprint-related events.",
      },
      {
        q: "Why can’t I perform edits in the UI?",
        a: "Because your role is permissioned for viewing and commenting only. Editing and workflow actions are restricted by role-based permissions.",
      },
    ],
  },
};
