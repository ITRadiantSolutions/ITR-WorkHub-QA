import { useState, useEffect, useRef } from "react";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import Icons from "./Icons";

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  userProjects,
  editingTask = null,
  allowAdminAssign = false,
  assigneesOptions = [],
  defaultAssigneeIds = null,
  defaultProjectId = null,
  suppressNotify = false,
}) {
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    projectId: defaultProjectId || userProjects?.[0]?._id || "",
    priority: "Medium",
    status: "TODO",
    dueDate: "",
    // admin can set assignees
    assignees: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [dueDateError, setDueDateError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const isEditMode = !!editingTask;
  const wasOpenRef = useRef(false);
  const initializedEditingTaskIdRef = useRef(null);

  // Initialize once when the modal opens (or when switching to another task).
  // Some callers build array props inline, so using those arrays as a reason to
  // reset would erase the user's input on an otherwise harmless re-render.
  useEffect(() => {
    const editingTaskId = editingTask?._id || null;
    const hasJustOpened = isOpen && !wasOpenRef.current;
    const hasChangedEditingTask =
      isOpen && editingTaskId !== initializedEditingTaskIdRef.current;

    if (isOpen && (hasJustOpened || hasChangedEditingTask) && editingTask) {
      setFormData({
        title: editingTask.title || "",
        description: editingTask.description || "",
        projectId: editingTask.projectId?._id || editingTask.projectId || "",
        priority: editingTask.priority || "Medium",
        status: editingTask.status || "TODO",
        dueDate: editingTask.dueDate ? editingTask.dueDate.split("T")[0] : "",
        assignees: editingTask.assignees || [],
      });
    } else if (isOpen && (hasJustOpened || hasChangedEditingTask)) {
      setFormData({
        title: "",
        description: "",
        projectId: defaultProjectId || userProjects?.[0]?._id || "",
        priority: "Medium",
        status: "TODO",
        dueDate: "",
        assignees: allowAdminAssign ? defaultAssigneeIds || [] : [],
      });
    }
    wasOpenRef.current = isOpen;
    initializedEditingTaskIdRef.current = isOpen ? editingTaskId : null;
  }, [
    editingTask,
    isOpen,
    defaultProjectId,
    userProjects,
    allowAdminAssign,
    defaultAssigneeIds,
  ]);

  const selectedProject = Array.isArray(userProjects)
    ? userProjects.find((p) => p._id === formData.projectId)
    : undefined;

  useEffect(() => {
    if (formData.dueDate && selectedProject?.startDate) {
      const due = new Date(formData.dueDate);
      const start = new Date(selectedProject.startDate);
      if (due < start) {
        setDueDateError(
          `Due date cannot be before project start date (${start.toLocaleDateString()})`,
        );
      } else {
        setDueDateError("");
      }
    } else {
      setDueDateError("");
    }
  }, [formData.dueDate, selectedProject]);

  useEffect(() => {
    if (!allowAdminAssign) return;
    // preselect assignees in admin mode
    if (defaultAssigneeIds && defaultAssigneeIds.length > 0) {
      setFormData((prev) => ({
        ...prev,
        assignees: defaultAssigneeIds,
      }));
    } else if (assigneesOptions?.length > 0) {
      // default to first option if none provided
      setFormData((prev) => ({
        ...prev,
        assignees: prev.assignees?.length
          ? prev.assignees
          : [assigneesOptions[0]._id],
      }));
    }
  }, [allowAdminAssign, defaultAssigneeIds, assigneesOptions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dueDateError) return;

    try {
      setSubmitting(true);
      let response;

      if (isEditMode) {
        // Update existing task
        response = await API.put(
          `/tasks/${editingTask._id}`,
          formData,
          suppressNotify ? { suppressNotify: true } : {},
        );
        toast.success("Task updated successfully!");
      } else {
        // Create new task
        const assigneesToSend = allowAdminAssign
          ? (formData.assignees || []).filter(Boolean)
          : [currentUserId].filter(Boolean);

        response = await API.post(
          "/tasks",
          {
            ...formData,
            assignees: assigneesToSend,
          },
          suppressNotify ? { suppressNotify: true } : {},
        );
        toast.success("Task created successfully!");
      }

      onTaskCreated(response.data.data || response.data);
      onClose();
      setFormData({
        title: "",
        description: "",
        projectId: "",
        priority: "Medium",
        status: "TODO",
        dueDate: "",
        assignees: [],
      });
    } catch (err) {
      console.error("Task operation error:", err);
      toast.error(
        err.response?.data?.message ||
          (isEditMode ? "Failed to update task" : "Failed to create task"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isEditMode ? "Edit Task" : "Create New Task"}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEditMode
                ? "Update task details"
                : "Create a task for yourself in one of your assigned projects"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <Icons.X />
          </button>
        </div>

        {/* Form */}
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* ================================================= */}
          {/* ROW 1 */}
          {/* Task Title + Project */}
          {/* ================================================= */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Task Title */}
            <Field label="Task Title" required>
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                placeholder="Enter task title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    title: e.target.value,
                  })
                }
                required
              />
            </Field>

            {/* Project */}
            <Field
              label="Select Project"
              disabled={userProjects?.length === 1}
              required
            >
              <select
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                value={formData.projectId}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    projectId: e.target.value,
                  })
                }
                required
              >
                <option value="">Select Project</option>

                {userProjects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* ================================================= */}
          {/* ROW 2 */}
          {/* DESCRIPTION */}
          {/* ================================================= */}
          <Field label="Description">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <textarea
                rows={4}
                placeholder="Write task details or Add Notes here..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value,
                  })
                }
                className="w-full resize-none rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-200 focus:bg-white focus:outline-none"
              />

              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">
                  Supports long descriptions
                </p>

                <span className="text-[11px] font-medium text-slate-500">
                  {formData.description?.length || 0} chars
                </span>
              </div>
            </div>
          </Field>

          {/* ================================================= */}
          {/* ROW 3 */}
          {/* PRIORITY + STATUS + DUE DATE */}
          {/* ================================================= */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Priority */}
            <Field label="Priority">
              <select
                className="h-8 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-500 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value,
                  })
                }
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </Field>
            {/* Status */}
            <Field label="Status">
              <div className="relative">
                {/* Status Dot */}
                <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      formData.status === "DONE"
                        ? "bg-emerald-500"
                        : formData.status === "IN_PROGRESS"
                          ? "bg-blue-500"
                          : formData.status === "QA_TESTING"
                            ? "bg-purple-500"
                            : "bg-slate-400"
                    }`}
                  />
                </div>

                <select
                  className={`
        h-8 w-full appearance-none rounded-xl border
        pl-8 pr-10 text-sm font-semibold
        transition-all focus:outline-none
        focus:ring-2 focus:ring-slate-100
        ${
          formData.status === "DONE"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : formData.status === "IN_PROGRESS"
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : formData.status === "QA_TESTING"
                ? "border-purple-200 bg-purple-50 text-purple-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
        }
      `}
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="TODO">Todo</option>

                  <option value="IN_PROGRESS">In Progress</option>

                  <option value="ON_HOLD">On Hold</option>

                  <option value="QA_TESTING">QA Testing</option>

                  <option value="DONE">Done</option>
                </select>

                {/* Chevron */}
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </Field>

            {/* Due Date */}
            <Field label="Due Date" required>
              <div className="relative">
                {/* REAL INPUT */}
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dueDate: e.target.value,
                    })
                  }
                  min={
                    selectedProject?.startDate
                      ? selectedProject.startDate.split("T")[0]
                      : undefined
                  }
                  required
                  className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />

                {/* CUSTOM UI */}
                <div className="flex h-8 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-2 transition hover:border-slate-300 hover:bg-slate-50">
                  {/* LEFT */}
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>

                    {/* Text */}
                    <span
                      className={`text-sm font-medium ${
                        formData.dueDate ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {formData.dueDate
                        ? new Date(formData.dueDate).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )
                        : "Select due date"}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="text-slate-400">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Error */}
              {dueDateError && (
                <p className="mt-1 text-[11px] text-red-500">{dueDateError}</p>
              )}
            </Field>
          </div>
          {/* ================================================= */}
          {/* ASSIGNEES */}
          {/* ================================================= */}

          {allowAdminAssign && (
            <Field label="Assign Members">
              <div className="rounded-xl border border-slate-200 bg-white p-2">
                {/* Search */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search member..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="
            h-8 w-full rounded-lg border border-slate-200
            bg-slate-50 px-3 pr-8 text-[11px]
            text-slate-700 placeholder:text-slate-400
            focus:border-slate-300 focus:bg-white
            focus:outline-none
          "
                  />

                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3-3" />
                    </svg>
                  </div>
                </div>

                {/* Members */}
                {assigneesOptions?.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No members available
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {assigneesOptions
                      .filter((member) =>
                        `${member.name} ${member.email}`
                          .toLowerCase()
                          .includes(memberSearch.toLowerCase()),
                      )
                      .map((member) => {
                        const checked = formData.assignees.includes(member._id);

                        return (
                          <label
                            key={member._id}
                            className={`
                    flex items-center gap-2 rounded-lg
                    border px-2 py-1.5 cursor-pointer transition
                    ${
                      checked
                        ? "border-slate-900 bg-slate-100"
                        : "border-slate-200 hover:bg-slate-50"
                    }
                  `}
                          >
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    assignees: [...prev.assignees, member._id],
                                  }));
                                } else {
                                  setFormData((prev) => ({
                                    ...prev,
                                    assignees: prev.assignees.filter(
                                      (id) => id !== member._id,
                                    ),
                                  }));
                                }
                              }}
                              className="
                      h-3.5 w-3.5 rounded
                      border-slate-300
                      text-slate-900
                      focus:ring-0
                    "
                            />

                            {/* Avatar */}
                            <div
                              className="
                      flex h-6 w-6 shrink-0 items-center
                      justify-center rounded-full
                      bg-slate-200 text-[9px]
                      font-bold text-slate-700
                    "
                            >
                              {member?.name?.charAt(0)?.toUpperCase()}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-semibold text-slate-700 leading-none">
                                {member.name}
                              </p>

                              <p className="truncate text-[10px] text-slate-400 mt-0.5 leading-none">
                                {member.email}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                )}
              </div>
            </Field>
          )}
          {/* ================================================= */}
          {/* BUTTONS */}
          {/* ================================================= */}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || dueDateError}
              className="flex h-8 items-center gap-2 rounded-lg bg-blue-700 px-2  text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Icons.Plus />
              )}

              {submitting
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? "Update Task"
                  : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { CreateTaskModal };
