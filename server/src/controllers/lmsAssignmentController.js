import Course from "../models/Course.js";
import User from "../models/User.js";
import CourseAssignment from "../models/CourseAssignment.js";
import EmployeeProfile from "../models/EmployeeProfile.js";
import LmsLearningReport from "../models/LmsLearningReport.js";
import { getEmployeeAssignmentEligibility } from "../utils/lmsAssignmentEligibility.js";
import { assertCanManageUser, getManagedEmployeeFilter, getManagedEmployeeIds } from "../utils/lmsTeamScope.js";


const normalizeObjectIdArray = (ids) => {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (!id) continue;
    const s = String(id);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(id);
  }
  return out;
};

const requireManager = (req, res) => {
  if (!["manager", "admin"].includes(req.user.roles.lms)) {
    res.status(403).json({ message: "Manager/Admin access required" });
    return false;
  }
  return true;
};

export const adminListEmployees = async (req, res) => {
  if (!requireManager(req, res)) return;

  const employees = await User.find(getManagedEmployeeFilter(req.user)).select("_id name email managerId");
  const eligibleOnly = String(req.query.eligibleOnly || "").toLowerCase() === "true";
  const employeeIds = employees.map((employee) => employee._id);

  const [profiles, reports] = await Promise.all([
    EmployeeProfile.find({ employee: { $in: employeeIds } }).select("employee resume description experiences skills"),
    LmsLearningReport.find({ employeeId: { $in: employeeIds } }).select("employeeId generatedAt"),
  ]);

  const profileMap = new Map(profiles.map((profile) => [String(profile.employee), profile]));
  const reportMap = new Map(reports.map((report) => [String(report.employeeId), report]));

  const enrichedEmployees = employees.map((employee) => ({
    ...employee.toObject(),
    assignmentEligibility: getEmployeeAssignmentEligibility({
      profile: profileMap.get(String(employee._id)),
      report: reportMap.get(String(employee._id)),
    }),
  }));

  res.json(eligibleOnly ? enrichedEmployees.filter((employee) => employee.assignmentEligibility.canAssign) : enrichedEmployees);
};

export const adminAssignCourseToEmployees = async (req, res) => {
  if (!requireManager(req, res)) return;
  const { courseId, employeeIds, minPassingPercentage } = req.body;
  if (!courseId) return res.status(400).json({ message: "courseId is required" });

  let passingPercentageOverride;
  if (minPassingPercentage !== undefined && minPassingPercentage !== null && minPassingPercentage !== "") {
    passingPercentageOverride = Number(minPassingPercentage);
    if (!Number.isFinite(passingPercentageOverride) || passingPercentageOverride < 0 || passingPercentageOverride > 100) {
      return res.status(400).json({ message: "minPassingPercentage must be a number between 0 and 100" });
    }
  }

  const normalizedEmployeeIds = normalizeObjectIdArray(employeeIds);
  if (normalizedEmployeeIds.length === 0) return res.status(400).json({ message: "employeeIds must be a non-empty array" });

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: "Course not found" });

  const managedEmployeeIdSet = new Set((await getManagedEmployeeIds(req.user)).map((id) => String(id)));
  const requestedManagedIds = normalizedEmployeeIds.filter((id) => managedEmployeeIdSet.has(String(id)));
  if (requestedManagedIds.length !== normalizedEmployeeIds.length) {
    return res.status(403).json({ message: "You can only assign courses to employees in your team" });
  }

  const employees = await User.find({ _id: { $in: requestedManagedIds }, "roles.lms": "employee" }).select("_id");
  let validEmployeeIds = employees.map((employee) => employee._id);
  if (validEmployeeIds.length === 0) return res.status(400).json({ message: "No valid employees found" });

  const [profiles, reports] = await Promise.all([
    EmployeeProfile.find({ employee: { $in: validEmployeeIds } }).select("employee resume description experiences skills"),
    LmsLearningReport.find({ employeeId: { $in: validEmployeeIds } }).select("employeeId generatedAt"),
  ]);
  const profileMap = new Map(profiles.map((profile) => [String(profile.employee), profile]));
  const reportMap = new Map(reports.map((report) => [String(report.employeeId), report]));

  const ineligible = [];
  validEmployeeIds = validEmployeeIds.filter((id) => {
    const eligibility = getEmployeeAssignmentEligibility({
      profile: profileMap.get(String(id)),
      report: reportMap.get(String(id)),
    });
    if (!eligibility.canAssign) {
      ineligible.push({ employeeId: id, profileCompletionPercent: eligibility.profileCompletionPercent });
      return false;
    }
    return true;
  });
  if (validEmployeeIds.length === 0) {
    return res.status(400).json({ message: "Selected employees do not have a profile that is at least 50% complete", ineligible });
  }

  const existingAssignments = await CourseAssignment.find({ course: courseId, assignedTo: { $in: validEmployeeIds } });
  const alreadyAssignedEmployeeIds = existingAssignments.flatMap((assignment) => assignment.assignedTo);
  const newEmployeeIds = validEmployeeIds.filter(
    (id) => !alreadyAssignedEmployeeIds.some((existingId) => String(existingId) === String(id)),
  );
  if (newEmployeeIds.length === 0) {
    return res.status(400).json({ message: "All selected employees are already assigned to this course", alreadyAssigned: true, ineligible });
  }

  const assignedBy = req.user._id;
  const assignedAt = new Date();
  const statusSet = {};
  for (const id of validEmployeeIds) statusSet[`statusByEmployee.${String(id)}`] = "assigned";
  for (const id of newEmployeeIds) statusSet[`assignedAtByEmployee.${String(id)}`] = assignedAt;
  if (passingPercentageOverride !== undefined) {
    for (const id of newEmployeeIds) statusSet[`passingPercentageByEmployee.${String(id)}`] = passingPercentageOverride;
  }

  const assignment = await CourseAssignment.findOneAndUpdate(
    { course: courseId, assignedBy },
    { $addToSet: { assignedTo: { $each: validEmployeeIds } }, $set: statusSet },
    { new: true, upsert: true },
  );

  await Course.updateOne({ _id: courseId }, { $addToSet: { enrolledStudents: { $each: validEmployeeIds } } });

  try {
    await LmsLearningReport.bulkWrite(
      validEmployeeIds.map((employeeId) => ({
        updateOne: {
          filter: { employeeId },
          update: { $setOnInsert: { employeeId, generatedAt: new Date(), summary: {}, courses: [] } },
          upsert: true,
        },
      })),
    );
  } catch (error) {
    console.warn("Failed to upsert LmsLearningReport for assigned employees:", error.message);
  }

  res.json({
    message: "Course assigned successfully",
    courseId,
    assignedBy,
    employeeIds: validEmployeeIds,
    newAssignments: newEmployeeIds,
    alreadyAssigned: alreadyAssignedEmployeeIds,
    ineligible,
    assignment,
  });
};

export const adminGetAssignmentInfo = async (req, res) => {
  const { userId, courseId } = req.query;
  if (!userId || !courseId) return res.status(400).json({ message: "userId and courseId are required" });

  try {
    await assertCanManageUser(req.user, userId);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  const assignments = await CourseAssignment.find({ assignedTo: userId, course: courseId }).populate("assignedBy", "name email");
  if (assignments.length === 0) return res.status(404).json({ message: "No assignment found for this user and course" });

  const latestAssignment = assignments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  res.json({
    courseId: latestAssignment.course,
    userId: latestAssignment.assignedTo,
    assignedBy: latestAssignment.assignedBy,
    createdAt: latestAssignment.assignedAtByEmployee?.get(String(userId)) || latestAssignment.createdAt,
    status: latestAssignment.statusByEmployee?.get(String(userId)) || "assigned",
  });
};

export const adminGetCourseAssignments = async (req, res) => {
  if (!requireManager(req, res)) return;
  const { courseId } = req.params;

  const assignments = await CourseAssignment.find({ course: courseId }).populate("assignedBy", "name email").sort({ createdAt: -1 });

  const detailsByEmployee = new Map();
  assignments.forEach((assignment) => {
    assignment.assignedTo.forEach((employeeId) => {
      const id = String(employeeId);
      const assignedAt = assignment.assignedAtByEmployee?.get(id) || assignment.createdAt;
      const existing = detailsByEmployee.get(id);
      if (!existing || new Date(assignedAt) > new Date(existing.assignedAt)) {
        detailsByEmployee.set(id, {
          employeeId: id,
          assignedAt,
          assignedBy: assignment.assignedBy ? { _id: assignment.assignedBy._id, name: assignment.assignedBy.name, email: assignment.assignedBy.email } : null,
        });
      }
    });
  });

  const managedIds = new Set((await getManagedEmployeeIds(req.user)).map((id) => String(id)));
  const assignmentDetails = [...detailsByEmployee.values()].filter((detail) => managedIds.has(String(detail.employeeId)));

  res.json({
    courseId,
    assignedTo: assignmentDetails.map((detail) => detail.employeeId),
    assignmentDetails,
    count: assignmentDetails.length,
  });
};
