// Daily sweep for employees who failed an LMS assessment, still have
// reattempts left this month, but let their 14-day retake deadline
// (CourseProgress.quiz/finalAssignmentRetakeDueBy) pass without retaking —
// see lmsProgressController.js for where that deadline gets set. Notifies
// the employee's manager once per missed deadline via the same
// manager-or-admin fallback used for exhausted attempts.
import cron from "node-cron";
import CourseProgress from "../models/CourseProgress.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { notifyUsers } from "../utils/notify.js";
import { getManagerOrAdminRecipientIds } from "../utils/lmsTeamScope.js";

const notifyOverdueRetake = async ({ progress, field, reminderField, assessmentType }) => {
  const [employee, course] = await Promise.all([
    User.findById(progress.employee).select("name managerId"),
    Course.findById(progress.course).select("title"),
  ]);
  if (!employee) return;

  const recipientIds = await getManagerOrAdminRecipientIds(employee);
  if (!recipientIds.length) return;

  await notifyUsers(recipientIds, {
    title: "Employee missed an assessment retake deadline",
    message: `${employee.name} did not retake the ${assessmentType} for "${course?.title || "a course"}" within the 14-day window.`,
    type: "lmsRetakeOverdue",
    activityType: "status_change",
    performedBy: progress.employee,
    metadata: { courseId: progress.course, assessmentType },
  });

  progress[reminderField] = new Date();
  await progress.save();
};

export async function sendLmsRetakeReminders() {
  const now = new Date();

  const overdueQuiz = await CourseProgress.find({
    quizRetakeDueBy: { $lt: now },
    quizRetakeReminderSentAt: null,
    quizStatus: { $ne: "passed" },
  });
  for (const progress of overdueQuiz) {
    await notifyOverdueRetake({ progress, field: "quizRetakeDueBy", reminderField: "quizRetakeReminderSentAt", assessmentType: "quiz" });
  }

  const overdueAssignment = await CourseProgress.find({
    finalAssignmentRetakeDueBy: { $lt: now },
    finalAssignmentRetakeReminderSentAt: null,
  });
  for (const progress of overdueAssignment) {
    await notifyOverdueRetake({ progress, field: "finalAssignmentRetakeDueBy", reminderField: "finalAssignmentRetakeReminderSentAt", assessmentType: "assignment" });
  }
}

export function startLmsRetakeReminderJob() {
  cron.schedule("0 9 * * *", () => sendLmsRetakeReminders().catch(console.error), { timezone: "Asia/Kolkata" });
}
