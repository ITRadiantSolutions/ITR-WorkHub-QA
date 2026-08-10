import { useState, useEffect, useCallback } from "react";
import { isTaskOverdue } from "../utils/taskDates";
import { API, projectAPI, getTask, addTaskComment } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import CloneProjectModal from "../components/CloneProjectModal.jsx";
import CreateTaskModal from "../components/CreateTaskModal";
import TaskViewModal from "../components/TaskViewModal.jsx";

import Icons from "../components/Icons.jsx";

const getAttachmentUrl = (attachment) => {
  const value =
    attachment?.url ||
    attachment?.fileUrl ||
    attachment?.path ||
    attachment?.downloadUrl;

  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const apiOrigin = import.meta.env.VITE_API_URL || window.location.origin;
  return new URL(value, `${apiOrigin.replace(/\/$/, "")}/`).href;
};

const formatAttachmentSize = (bytes) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "Size unavailable";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const ProjectAttachmentRow = ({ attachment, index }) => {
  const filename =
    attachment?.fileName ||
    attachment?.originalname ||
    attachment?.filename ||
    attachment?.name ||
    `Attachment-${index + 1}`;
  const url = getAttachmentUrl(attachment);
  const extension = filename.includes(".")
    ? filename.split(".").pop().toUpperCase()
    : "FILE";
  const uploadedDate = attachment?.uploadedAt
    ? new Date(attachment.uploadedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-indigo-100">
          <Icons.File />
        </div>
        <div className="min-w-0">
          <p
            className="truncate text-xs font-bold text-slate-800"
            title={filename}
          >
            {filename}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-slate-400">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500">
              {extension}
            </span>
            <span>
              {formatAttachmentSize(attachment?.fileSize || attachment?.size)}
            </span>
            {uploadedDate && <span>Uploaded {uploadedDate}</span>}
          </div>
        </div>
      </div>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-[11px] font-bold text-white transition hover:bg-indigo-700 sm:self-center"
        >
          <Icons.Eye />
          Open file
        </a>
      ) : (
        <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 px-3.5 text-[11px] font-bold text-slate-500">
          File unavailable
        </span>
      )}
    </div>
  );
};

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, variant }) {
  const s = {
    done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    progress: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    todo: "bg-slate-50 text-slate-600 border border-slate-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-green-50 text-green-700 border border-green-200",
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    planning: "bg-violet-50 text-violet-700 border border-violet-200",
    completed: "bg-slate-100 text-slate-600 border border-slate-200",
    overdue: "bg-red-100 text-red-700 border border-red-200",
    default: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${s[variant] || s.default}`}
    >
      {label}
    </span>
  );
}

function getStatusVariant(s) {
  return (
    {
      DONE: "done",
      IN_PROGRESS: "progress",
      TODO: "todo",
      Active: "active",
      Planning: "planning",
      Completed: "completed",
    }[s] || "default"
  );
}
function getPriorityVariant(p) {
  return { High: "high", Medium: "medium", Low: "low" }[p] || "default";
}

// ── HBar ──────────────────────────────────────────────────────────────────────
function HBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-bold text-slate-800">{count}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function DonutChart({ value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 32,
    cx = 40,
    cy = 40,
    circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="8"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#0f172a"
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dashoffset 0.7s ease" }}
        />
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#0f172a"
        >
          {pct}%
        </text>
      </svg>
      <p className="text-[11px] text-slate-500 mt-1">completion </p>
    </div>
  );
}

// ── Inline field ──────────────────────────────────────────────────────────────
const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Inline status select ──────────────────────────────────────────────────────
function StatusSelect({ value, onChange }) {
  return (
    <div className="relative w-[110px]">
      {/* Status Dot */}
      <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
        <div
          className={`h-1.5 w-1.5 rounded-full ${
            value === "DONE"
              ? "bg-emerald-500"
              : value === "IN_PROGRESS"
                ? "bg-indigo-600"
                : value === "QA_TESTING"
                  ? "bg-purple-500"
                  : "bg-slate-400"
          }`}
        />
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          h-7 w-full appearance-none rounded-lg border
          pl-5 pr-6 text-[10px] font-semibold
          leading-none transition-all
          focus:outline-none focus:ring-1
          focus:ring-slate-200 cursor-pointer

          ${
            value === "DONE"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : value === "IN_PROGRESS"
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : value === "QA_TESTING"
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
          }
        `}
      >
        <option value="TODO">Todo</option>

        <option value="IN_PROGRESS">In Progress</option>

        <option value="ON_HOLD">On Hold</option>

        <option value="QA_TESTING">QA Testing</option>

        <option value="DONE">Done</option>
      </select>

      {/* Chevron */}
      <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400">
        <svg
          width="9"
          height="9"
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
  );
}

// ── Role color ────────────────────────────────────────────────────────────────
function roleColor(role) {
  return (
    {
      ADMIN: "bg-red-100 text-red-700",
      MANAGER: "bg-violet-100 text-violet-700",
      HR: "bg-amber-100 text-amber-700",
      EMPLOYEE: "bg-blue-100 text-blue-700",
    }[role] || "bg-slate-100 text-slate-600"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const PROJECT_TASKS_PAGE_SIZE = 20;

export default function ProjectDetail({ initialProject, onBack, users = [] }) {
  const { user } = useAuth();
  const { projectId } = useParams();

  const [project, setProject] = useState(initialProject || null);
  const [tasks, setTasks] = useState(
    initialProject?.tasks?.slice(0, PROJECT_TASKS_PAGE_SIZE) || [],
  );
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskPagination, setTaskPagination] = useState({
    page: 1,
    limit: PROJECT_TASKS_PAGE_SIZE,
    pages: Math.max(
      Math.ceil((initialProject?.tasks?.length || 0) / PROJECT_TASKS_PAGE_SIZE),
      1,
    ),
    total: initialProject?.tasks?.length || 0,
  });
  const [taskSummary, setTaskSummary] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks");

  // ── Project Attachments ───────────────────────────────────────────────
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]);

  const refreshProject = async () => {
    if (!project?._id) return;
    await loadProject(project._id);
  };

  const attachments = project?.attachments || [];

  const handleAttachmentFileChange = (fileList) => {
    setAttachmentError("");

    const files = Array.from(fileList || []);
    // Basic guard: avoid non-File entries
    const normalized = files.filter((f) => f instanceof File);
    setAttachmentFiles(normalized);
  };

  const handleUploadAttachments = async () => {
    setAttachmentError("");

    if (!project?._id) {
      setAttachmentError("Project not loaded");
      return;
    }

    if (!attachmentFiles?.length) {
      setAttachmentError("Select at least one file");
      return;
    }

    setAttachmentsUploading(true);
    try {
      await projectAPI.uploadProjectAttachments(project._id, attachmentFiles);
      setAttachmentFiles([]);
      toast.success("Attachments uploaded successfully");
      await refreshProject();
    } catch (e) {
      setAttachmentError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to upload attachments",
      );
    } finally {
      setAttachmentsUploading(false);
    }
  };

  const [loading, setLoading] = useState(!initialProject);
  const [projectLoading, setProjectLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [projectEmployees, setProjectEmployees] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [teamUpdating, setTeamUpdating] = useState({});

  // ── Task details modal (TaskViewModal) ───────────────────────────────
  const [taskSearchInput, setTaskSearchInput] = useState("");

  // Filter tasks locally for UI search (server pagination still uses full dataset)
  const filteredTasks = taskSearchInput
    ? tasks.filter((t) =>
        (t?.title || "")
          .toString()
          .toLowerCase()
          .includes(taskSearchInput.toLowerCase()),
      )
    : tasks;

  const [showTaskViewModal, setShowTaskViewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  // NOTE: Use CreateTaskModal for "Create Task" flow (same as other dashboards)

  // to ensure Add Task works correctly.
  // Task creation is handled via TaskPage UI
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  const [projectUsers, setProjectUsers] = useState([]);
  const [showCloneModal, setShowCloneModal] = useState(false);

  // 👇 NEW: Sprint support for Timeline
  const [sprints, setSprints] = useState([]);
  const [sprintsLoading, setSprintsLoading] = useState(false);
  const [sprintsCount, setSprintsCount] = useState(0);
  const [membersCount, setMembersCount] = useState(0);

  // ── Timeline pagination (Load More) ────────────────────────────────
  const TIMELINE_PAGE_SIZE = 20;
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineHasMore, setTimelineHasMore] = useState(false); // used by Load More button (added below)

  // We paginate over tasks for timeline items.
  // Sprints + static items are always rendered.

  const [memberSearch, setMemberSearch] = useState("");
  {
    /* state */
  }
  const [teamSearch, setTeamSearch] = useState("");

  // ── Sprint Create Modal (inside Project Details) ─────────────────────────
  const [sprintCreateModalOpen, setSprintCreateModalOpen] = useState(false);
  const [sprintCreateSubmitting, setSprintCreateSubmitting] = useState(false);
  const [sprintCreateErrors, setSprintCreateErrors] = useState({});
  const [sprintCreateForm, setSprintCreateForm] = useState({
    name: "",
    projectId: "",
    startDate: "",
    endDate: "",
    goal: "",
  });

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    status: "Planning",
    priority: "Medium",
    startDate: "",
    endDate: "",
    projectLead: "",
  });

  const role = (user?.role || "").toUpperCase();
  const isLead = role === "ADMIN" || role === "PM";

  // ── Load project ────────────────────────────────────────────────────────────
  const loadProject = useCallback(async (idToLoad) => {
    if (!idToLoad) {
      console.warn("No project ID provided");
      return;
    }

    console.log("🔄 Loading project ID:", idToLoad);

    try {
      setProjectLoading(true);
      const res = await API.get(`/projects/${idToLoad}`);
      const loadedProject = res.data;

      console.log("✅ Loaded project:", loadedProject._id);

      // Validate loaded project matches expected ID
      if (loadedProject._id !== idToLoad) {
        console.error("ID mismatch:", {
          expected: idToLoad,
          actual: loadedProject._id,
        });
        toast.error("Project ID mismatch - reloading");
        return;
      }

      setProject(loadedProject);
      populateForm(loadedProject);
      setSelectedUsers(
        loadedProject.teamMembers.map((m) => m._id || m).filter(Boolean) || [],
      );
      setLoading(false);
    } catch (e) {
      console.error("❌ Project load failed:", e.response?.data || e);
      toast.error(e.response?.data?.message || "Failed to load project");
    } finally {
      setProjectLoading(false);
    }
  }, []);

  useEffect(() => {
    const idToLoad = projectId || initialProject?._id;
    if (idToLoad) {
      loadProject(idToLoad);
    }
  }, [projectId, loadProject]);

  // Validate project ID consistency
  useEffect(() => {
    if (project?._id && projectId && project._id !== projectId) {
      console.warn("🔄 ID mismatch detected - re-fetching:", {
        loaded: project._id,
        url: projectId,
      });
      loadProject(projectId);
    }
  }, [project?._id, projectId, loadProject]);

  const populateForm = (p) => {
    setProjectForm({
      name: p.name || "",
      description: p.description || "",
      status: p.status || "Planning",
      priority: p.priority || "Medium",
      startDate: p.startDate ? p.startDate.split("T")[0] : "",
      endDate: p.endDate ? p.endDate.split("T")[0] : "",
      projectLead: p.projectLead?._id || p.projectLead || "",
    });
  };

  const validateSprintCreate = () => {
    const e = {};
    if (!sprintCreateForm.name.trim()) e.name = "Sprint name is required";
    if (!sprintCreateForm.projectId) e.projectId = "Project is required";
    if (!sprintCreateForm.startDate) e.startDate = "Start date is required";
    if (!sprintCreateForm.endDate) e.endDate = "End date is required";

    const start = new Date(sprintCreateForm.startDate);
    const end = new Date(sprintCreateForm.endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      if (start >= end) e.endDate = "End date must be after start date";
      if (project?.startDate && start < new Date(project.startDate)) {
        e.startDate = `Cannot be before project start (${new Date(
          project.startDate,
        ).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })})`;
      }
    }

    setSprintCreateErrors(e);
    return Object.keys(e).length === 0;
  };

  const refreshProjectSprints = async () => {
    if (!project?._id) return;
    setSprintsLoading(true);
    try {
      const res = await projectAPI.getProjectSprints(project._id);
      // getProjectSprints() already unwraps axios's response.data, and the
      // backend's listSprints returns a bare array — res *is* the array.
      const sprintData = Array.isArray(res) ? res : res?.data || res?.sprints || [];
      setSprints(sprintData);
      setSprintsCount(sprintData.length);
    } catch (e) {
      console.error("Failed to refresh sprints:", e);
      setSprints([]);
      setSprintsCount(0);
    } finally {
      setSprintsLoading(false);
    }
  };

  const createSprintInProjectDetail = async () => {
    if (!validateSprintCreate()) return;
    setSprintCreateSubmitting(true);
    try {
      await API.post("/sprints", sprintCreateForm);
      toast.success("Sprint created successfully!");
      setSprintCreateModalOpen(false);
      setSprintCreateForm({
        name: "",
        projectId: project?._id || "",
        startDate: "",
        endDate: "",
        goal: "",
      });
      setSprintCreateErrors({});
      await refreshProjectSprints();
    } catch (err) {
      setSprintCreateErrors({
        submit: err.response?.data?.message || "Failed to create sprint",
      });
    } finally {
      setSprintCreateSubmitting(false);
    }
  };

  // ── Sprint Create Modal UI ─────────────────────────────────────────────
  const renderSprintCreateModal = () => {
    if (!sprintCreateModalOpen) return null;

    const projectMinDateStr = project?.startDate
      ? new Date(project.startDate).toISOString().split("T")[0]
      : "";

    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-900">
                  New Sprint
                </h3>
                <p className="text-[11px] text-slate-400">
                  Create a sprint for this project
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSprintCreateModalOpen(false);
                setSprintCreateErrors({});
              }}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
            {sprintCreateErrors.submit && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {sprintCreateErrors.submit}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Sprint Name
              </label>
              <input
                type="text"
                value={sprintCreateForm.name}
                autoFocus
                onChange={(e) =>
                  setSprintCreateForm((current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                placeholder="e.g. Sprint 1 – Authentication"
                className={inputCls}
              />
              {sprintCreateErrors.name && (
                <p className="text-[11px] text-red-500 mt-1">
                  {sprintCreateErrors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Project
              </label>
              <input
                className={inputCls}
                value={project?.name || ""}
                disabled
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  min={projectMinDateStr}
                  value={sprintCreateForm.startDate}
                  onChange={(e) =>
                    setSprintCreateForm((current) => ({
                      ...current,
                      startDate: e.target.value,
                    }))
                  }
                  className={inputCls}
                />
                {sprintCreateErrors.startDate && (
                  <p className="text-[11px] text-red-500 mt-1">
                    {sprintCreateErrors.startDate}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  min={sprintCreateForm.startDate}
                  value={sprintCreateForm.endDate}
                  onChange={(e) =>
                    setSprintCreateForm((current) => ({
                      ...current,
                      endDate: e.target.value,
                    }))
                  }
                  className={inputCls}
                />
                {sprintCreateErrors.endDate && (
                  <p className="text-[11px] text-red-500 mt-1">
                    {sprintCreateErrors.endDate}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Sprint Goal (optional)
              </label>
              <textarea
                rows="3"
                value={sprintCreateForm.goal}
                onChange={(e) =>
                  setSprintCreateForm((current) => ({
                    ...current,
                    goal: e.target.value,
                  }))
                }
                placeholder="What does this sprint aim to achieve?"
                className={`${inputCls} resize-none min-h-[80px]`}
              />
            </div>
          </div>

          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={sprintCreateSubmitting}
              onClick={() => {
                setSprintCreateModalOpen(false);
                setSprintCreateErrors({});
              }}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={createSprintInProjectDetail}
              disabled={sprintCreateSubmitting}
              className="h-9 px-5 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {sprintCreateSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-r-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create Sprint
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Load all users (for settings) ───────────────────────────────────────────
  useEffect(() => {
    if (!project?._id || !isLead) return;
    const loadUsers = async () => {
      try {
        setUsersLoading(true);
        const res = await API.get("/users");

        const usersData =
          res?.data?.users || res?.data?.data || res?.data || [];

        setProjectUsers(Array.isArray(usersData) ? usersData : []);
        // 👇 Load project employees for task assignment dropdown
        if (project._id) {
          try {
            const empRes = await projectAPI.getProjectEmployees(project._id);
            setProjectEmployees(empRes.data || []);
          } catch (e) {
            console.error("Failed to load project employees:", e);
            setProjectEmployees([]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setUsersLoading(false);
      }
    };
    loadUsers();
  }, [project?._id, isLead]);

  // Load sprints when project or tab changes
  useEffect(() => {
    if (!project?._id) return;

    const loadSprints = async () => {
      try {
        setSprintsLoading(true);

        const res = await projectAPI.getProjectSprints(project._id);

        const sprintData = Array.isArray(res) ? res : res?.data || res?.sprints || [];

        setSprints(sprintData);
        setSprintsCount(sprintData.length);
      } catch (e) {
        console.error("Failed to load sprints:", e);
        setSprints([]);
        setSprintsCount(0);
      } finally {
        setSprintsLoading(false);
      }
    };

    loadSprints();
  }, [project?._id]);
  // Set counts when project loads
  useEffect(() => {
    if (project) {
      setMembersCount(project.teamMembers?.length || 0);
      setSprintsCount(project.sprints?.length || sprints.length || 0);
    }
  }, [project]);
  const loadProjectTasks = useCallback(
    async (page = 1) => {
      if (!project?._id) return;

      setTasksLoading(true);
      try {
        const [taskRes, summaryRes] = await Promise.all([
          projectAPI.getProjectTasks(project._id, {
            page,
            limit: PROJECT_TASKS_PAGE_SIZE,
          }),
          API.get(`/tasks/summary?projectId=${project._id}`, {
            noCache: true,
          }),
        ]);
        // projectAPI.getProjectTasks() already unwraps axios's response.data,
        // and the backend's listTasks returns a bare (unpaginated) array —
        // so taskRes *is* the array, not a {data, pagination} envelope.
        const taskData = Array.isArray(taskRes) ? taskRes : taskRes?.data || [];
        const pagination = taskRes?.pagination || {};
        const summary = summaryRes?.data?.data || null;

        // Keep existing Tasks tab behavior (replace page)
        setTasks(Array.isArray(taskData) ? taskData : []);
        setTaskPagination({
          page: pagination.page || page,
          limit: pagination.limit || PROJECT_TASKS_PAGE_SIZE,
          pages: pagination.pages || 1,
          total: pagination.total || 0,
        });
        setTaskSummary(summary);
      } catch (error) {
        console.error("Task load error:", error);
        toast.error("Failed to load project tasks");
        setTasks([]);
        setTaskPagination({
          page: 1,
          limit: PROJECT_TASKS_PAGE_SIZE,
          pages: 1,
          total: 0,
        });
        setTaskSummary(null);
      } finally {
        setTasksLoading(false);
      }
    },
    [project?._id],
  );

  // ── Timeline load more: fetch next tasks page and append ─────────────
  const loadTimelineMore = useCallback(async () => {
    if (!project?._id) return;
    if (timelineLoading) return;

    const nextPage = timelinePage + 1;
    const canLoadNext = nextPage <= (taskPagination.pages || 1);
    if (!canLoadNext) {
      setTimelineHasMore(false);
      return;
    }

    setTimelineLoading(true);
    try {
      const taskRes = await projectAPI.getProjectTasks(project._id, {
        page: nextPage,
        limit: PROJECT_TASKS_PAGE_SIZE,
      });

      const taskData = taskRes?.data || [];
      const pagination = taskRes?.pagination || {};

      const newTasks = Array.isArray(taskData) ? taskData : [];

      // Append unique by _id to avoid duplicates.
      setTasks((prev) => {
        const map = new Map();
        (prev || []).forEach((t) => map.set(t?._id, t));
        newTasks.forEach((t) => map.set(t?._id, t));
        return Array.from(map.values());
      });

      // Update pagination meta
      setTaskPagination((p) => ({
        ...p,
        page: pagination.page || nextPage,
        limit: pagination.limit || PROJECT_TASKS_PAGE_SIZE,
        pages: pagination.pages || p.pages,
        total: pagination.total || p.total,
      }));

      setTimelinePage(nextPage);
      setTimelineHasMore(
        nextPage < (pagination.pages || taskPagination.pages || 1),
      );
    } catch (e) {
      console.error("Timeline load more failed:", e);
      toast.error("Failed to load more timeline items");
    } finally {
      setTimelineLoading(false);
    }
  }, [
    project?._id,
    timelineLoading,
    timelinePage,
    taskPagination.pages,
    taskPagination.page,
  ]);

  // load project wise task
  useEffect(() => {
    loadProjectTasks(1);
  }, [loadProjectTasks]);

  // Initialize timeline pagination whenever task pagination changes
  useEffect(() => {
    if (!taskPagination?.pages) return;
    setTimelinePage(1);
    setTimelineHasMore(taskPagination.pages > 1);
  }, [taskPagination?.pages]);

  const fetchTaskDetails = async (taskId) => {
    try {
      setTaskLoading(true);
      const response = await getTask(taskId);
      const fullTask = response?.data?.data || response?.data;

      setComments(fullTask?.comments || []);
    } catch (e) {
      console.error("Error fetching task details:", e);
      toast.error(e?.response?.data?.message || "Failed to load task comments");
    } finally {
      setTaskLoading(false);
    }
  };

  const handleViewTask = async (task) => {
    if (!task?._id) return;

    const role = (user?.role || "").toUpperCase();
    const userId = user?._id?.toString();

    // Allow ADMIN/PM always.
    if (role === "ADMIN" || role === "PM") {
      setSelectedTask(task);
      await fetchTaskDetails(task._id);
      setShowTaskViewModal(true);
      return;
    }

    // For employees, only allow if the user is assigned or is the creator.
    const isAssignee = (task?.assignees || []).some((a) => {
      const aid = typeof a === "object" ? a?._id || a?.id : a;
      return aid && aid.toString() === userId;
    });

    const isCreator =
      task?.createdBy &&
      (typeof task.createdBy === "object"
        ? (task.createdBy?._id || task.createdBy?.id)?.toString() === userId
        : task.createdBy.toString() === userId);

    if (!isAssignee && !isCreator) {
      toast.error("Access denied: This is not your task");
      return;
    }

    setSelectedTask(task);
    await fetchTaskDetails(task._id);
    setShowTaskViewModal(true);
  };

  const handleAddTaskComment = async () => {
    if (!selectedTask?._id || !newComment.trim()) return;
    try {
      setCommentLoading(true);
      const response = await addTaskComment(
        selectedTask._id,
        newComment.trim(),
      );
      const updated = response?.data?.data || response?.data;
      setComments(updated?.comments || updated || []);
      setNewComment("");
    } catch (e) {
      console.error("Error adding comment:", e);
      toast.error(e?.response?.data?.message || "Failed to add comment");
    } finally {
      setCommentLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await API.patch(`/tasks/${taskId}/status`, { status });
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status } : t)),
      );
      loadProjectTasks(taskPagination.page);
      toast.success("Task status updated successfully!");
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || "Failed to update task status");
    }
  };

  // ── Project save ─────────────────────────────────────────────────────────────

  const handleSaveProject = async () => {
    setSaving(true);

    try {
      const res = await API.put(`/projects/${project._id}`, projectForm);

      const updatedProject = res.data?.project || res.data;

      if (!updatedProject) {
        throw new Error("Invalid response from server");
      }

      setProject(updatedProject);
      setSaveSuccess(true);

      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Team toggle ─────────────────────────────────────────────────────────────
  const toggleTeamMember = async (uid) => {
    if (!project?._id) {
      console.error("🚨 NO PROJECT ID - cannot update team");
      toast.error("Project not loaded");
      return;
    }

    const action = selectedUsers.includes(uid) ? "remove" : "add";
    const userName = projectUsers.find((u) => u._id === uid)?.name || "member";

    console.log("🔧 Toggle team:", { projectId: project._id, uid, action });

    setTeamUpdating((p) => ({ ...p, [uid]: true }));
    try {
      await projectAPI.updateTeamMember(project._id, { action, userId: uid });

      // 👇 REFETCH FULL PROJECT DATA for instant accurate refresh
      await loadProject(project._id);

      toast.success(
        action === "add"
          ? `Added ${userName} to project team`
          : `Removed ${userName} from project team`,
      );
    } catch (e) {
      console.error("Team update error:", e);
      toast.error("Failed to update team member");
      // Optional: refetch on error to reset optimistic state if any
      await loadProject(project._id);
    } finally {
      setTeamUpdating((p) => ({ ...p, [uid]: false }));
    }
  };

  // Default to tasks tab
  useEffect(() => {
    setActiveTab("tasks");
  }, []);

  // ── Analytics ────────────────────────────────────────────────────────────────
  const summaryTotal = taskSummary?.total ?? tasks.length;
  const summaryDone =
    taskSummary?.done ?? tasks.filter((t) => t.status === "DONE").length;
  const summaryInProgress =
    taskSummary?.progress ??
    tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const summaryTodo =
    taskSummary?.todo ?? tasks.filter((t) => t.status === "TODO").length;

  const analytics = {
    total: summaryTotal,
    completed: summaryDone,
    inProgress: summaryInProgress,
    todo: summaryTodo,
    high: tasks.filter((t) => t.priority === "High").length,
    medium: tasks.filter((t) => t.priority === "Medium").length,
    low: tasks.filter((t) => t.priority === "Low").length,
    rate: summaryTotal > 0 ? Math.round((summaryDone / summaryTotal) * 100) : 0,
  };
  const projectTaskTotal = taskPagination.total || summaryTotal;
  const taskRangeStart =
    projectTaskTotal > 0
      ? (taskPagination.page - 1) * PROJECT_TASKS_PAGE_SIZE + 1
      : 0;
  const taskRangeEnd = Math.min(
    taskPagination.page * PROJECT_TASKS_PAGE_SIZE,
    projectTaskTotal,
  );

  const today = new Date();

  const getAssigneeName = (a) => {
    if (typeof a === "object" && a?.name) return a.name;
    return (
      users.find((u) => u._id === a)?.name ||
      projectUsers.find((u) => u._id === a)?.name ||
      "—"
    );
  };

  // Team members populated straight off `project.teamMembers` come back as
  // `{ roles: { tracker } }` (raw User doc shape); members sourced from the
  // `/api/users` list (`users`/`projectUsers`) already carry a flat `.role`
  // (see utils/publicUser.js). Handle both shapes.
  const getMemberRole = (member) => member?.role || member?.roles?.tracker || "—";

  const teamMembers =
    project?.teamMembers
      ?.map((m) => {
        if (typeof m === "object") return m;
        return (
          users.find((u) => u._id === m) ||
          projectUsers.find((u) => u._id === m)
        );
      })
      .filter(Boolean) || [];

  const projectLeadName =
    project?.projectLead?.name ||
    users.find((u) => u._id === project?.projectLead)?.name ||
    "Not assigned";

  if (loading || projectLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Spinner */}
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-slate-200" />

            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-slate-900 border-t-transparent animate-spin" />
          </div>

          {/* Text */}
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">Loading Data</p>

            <p className="mt-1 text-xs text-slate-400">
              Please wait a moment...
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="text-center py-24 text-slate-500 text-sm">
        Project not found
      </div>
    );
  }

  // New tab structure per plan
  const baseTabs = [
    { id: "overview", label: "Overview ", Ic: Icons.Shield },
    { id: "sprints", label: "Sprints", Ic: Icons.Calendar },
    { id: "tasks", label: "Tasks", Ic: Icons.Tasks },
    { id: "timeline", label: "Timeline", Ic: Icons.Timeline },
    { id: "members", label: "Members", Ic: Icons.User },
  ];

  const adminTabs = [
    { id: "analytics", label: "Analytics", Ic: Icons.Analytics },
  ];

  let tabs = [...baseTabs, ...(isLead ? adminTabs : [])];
  if (isLead) {
    tabs.push({ id: "edit", label: "Edit & Delete", Ic: Icons.Edit });
  }

  return (
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="min-h-screen w-full bg-slate-50 overflow-x-hidden"
    >
      {/* Task details modal */}
      <TaskViewModal
        isOpen={showTaskViewModal}
        onClose={() => setShowTaskViewModal(false)}
        selectedTask={selectedTask}
        comments={comments}
        isLoading={taskLoading || commentLoading}
        onAddComment={handleAddTaskComment}
        newComment={newComment}
        onNewCommentChange={setNewComment}
        getProjectName={() => "Project"}
        getAssigneeName={getAssigneeName}
        getAssigneesPreview={() => null}
      />
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-0  shadow-sm">
        <div className="px-3 sm:px-4 lg:px-6 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Back + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
            >
              <Icons.Back />
              Back
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900">
                  {project.name}
                </h1>
                <Badge
                  label={project.status}
                  variant={getStatusVariant(project.status)}
                />
                <Badge
                  label={project.priority}
                  variant={getPriorityVariant(project.priority)}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-md">
                {project.description}
              </p>
            </div>
          </div>
          {/* Quick stats */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {(project.startDate || project.endDate) && (
              <div className="flex items-center gap-1">
                <Icons.Calendar />
                <span>
                  {project.startDate
                    ? new Date(project.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                  {" → "}
                  {project.endDate
                    ? new Date(project.endDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Icons.User />
              <span className="font-medium text-slate-700">
                {projectLeadName}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Icons.User />
              <span>{teamMembers.length} members</span>
            </div>
            {isLead && (
              <button
                onClick={() => setShowCloneModal(true)}
                className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shadow-sm ml-auto"
                title="Clone this project"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Clone
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Clone Modal */}
      {showCloneModal && (
        <CloneProjectModal
          isOpen={showCloneModal}
          onClose={() => setShowCloneModal(false)}
          sourceProject={project}
          onSuccess={() => {
            toast.success("Project cloned successfully!");
            setShowCloneModal(false);
          }}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        userProjects={[project]}
        allowAdminAssign={true}
        assigneesOptions={projectEmployees}
        defaultAssigneeIds={[]}
        onTaskCreated={() => {
          setShowCreateTaskModal(false);

          // reload task list
          loadProjectTasks(1);

          toast.success("Task created successfully!");
        }}
        suppressNotify={true}
      />

      {/* ── Metric strip ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {[
            { label: "Total Tasks", value: analytics.total, dark: true },
            {
              label: "Completed",
              value: analytics.completed,
              color: "text-emerald-600",
            },
            {
              label: "In Progress",
              value: analytics.inProgress,
              color: "text-blue-600",
            },
            { label: "Todo", value: analytics.todo, color: "text-slate-700" },
            {
              label: "Completion",
              value: `${analytics.rate}%`,
              color: "text-slate-700",
            },
            {
              label: "Team",
              value: teamMembers.length,
              color: "text-slate-700",
            },
          ].map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 ${i > 0 ? "pl-4 border-l border-slate-200" : ""}`}
            >
              {s.dark ? (
                <span className="text-base font-bold text-slate-900">
                  {s.value}
                </span>
              ) : (
                <span className={`text-base font-bold ${s.color}`}>
                  {s.value}
                </span>
              )}
              <span className="text-[11px] text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-[61px]  px-6">
        <div className="flex overflow-x-auto scrollbar-hide whitespace-nowrap">
          {tabs.map(({ id, label, Ic, onClick }) => (
            <button
              key={id}
              onClick={() => {
                if (onClick) {
                  onClick();
                } else {
                  setActiveTab(id);
                }
              }}
              className={`flex items-center gap-1.5 py-3 px-4 border-b-2 text-xs font-semibold transition ${
                activeTab === id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              <Ic />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {renderSprintCreateModal()}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
        {/* ── TASKS ──────────────────────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <div className="space-y-2">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              {(() => {
                const total = summaryTotal;
                const todo = summaryTodo;
                const inProgress = summaryInProgress;
                const onHold =
                  taskSummary?.onHold ??
                  tasks.filter((t) => t.status === "ON_HOLD").length;
                const qaTesting =
                  taskSummary?.qaTesting ??
                  tasks.filter((t) => t.status === "QA_TESTING").length;
                const done = summaryDone;
                const overdue =
                  taskSummary?.overdue ??
                  tasks.filter((t) => {
                    if (!t.dueDate) return false;
                    const due = new Date(t.dueDate);
                    return due < today && t.status !== "DONE";
                  }).length;

                const cardData = [
                  {
                    label: "Total",
                    value: total,
                    icon: <Icons.Tasks />,
                    bg: "bg-indigo-50",

                    fg: "text-indigo-700",
                  },
                  {
                    label: "Todo",
                    value: todo,
                    icon: <Icons.Clock />,
                    bg: "bg-slate-100",
                    fg: "text-slate-800",
                  },
                  {
                    label: "In Progess",
                    value: inProgress,
                    icon: <Icons.TrendUp />,
                    bg: "bg-blue-50",
                    fg: "text-blue-800",
                  },
                  {
                    label: "On Hold",
                    value: onHold,
                    icon: <Icons.Clock />,
                    bg: "bg-amber-50",
                    fg: "text-amber-800",
                  },
                  {
                    label: "QA Testing",
                    value: qaTesting,
                    icon: <Icons.Bug />,
                    bg: "bg-purple-50",
                    fg: "text-purple-800",
                  },
                  {
                    label: "Done",
                    value: done,
                    icon: <Icons.CheckCircle />,
                    bg: "bg-emerald-50",
                    fg: "text-emerald-800",
                  },
                  {
                    label: "Overdue",
                    value: overdue,
                    icon: <Icons.Alert />,
                    bg: "bg-red-50",
                    fg: "text-red-800",
                  },
                ];

                return cardData.map((c) => (
                  <div
                    key={c.label}
                    className="bg-white rounded-xl border border-slate-200  px-4 py-3 flex items-center gap-3"
                  >
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg} ${c.fg}`}
                    >
                      {c.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 truncate">
                        {c.label}
                      </p>
                      <p className="text-lg font-extrabold text-slate-900 truncate">
                        {c.value}
                      </p>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Action row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <p className="text-xs text-slate-500 truncate">
                Showing {tasks.length} of {projectTaskTotal} task
                {projectTaskTotal !== 1 ? "s" : ""} in this project
              </p>

              {isLead && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  <div className="relative">
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                      <Icons.Search />
                    </div>
                    <input
                      value={taskSearchInput}
                      onChange={(e) => setTaskSearchInput(e.target.value)}
                      placeholder="Search tasks..."
                      className="h-9 w-[220px] rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  <button
                    onClick={() => setShowCreateTaskModal(true)}
                    className="flex items-center gap-1.5 bg-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shadow-sm"
                  >
                    <Icons.Plus />
                    Add Task
                  </button>
                </div>
              )}
            </div>

            {/* Task table */}
            {tasksLoading && tasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-14 text-center">
                <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">
                  Loading tasks
                </p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-14 text-center">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <Icons.Tasks />
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  No tasks yet
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Add tasks to track work in this project
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] table-fixed">
                    {/* HEADER */}
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="w-[32%] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Task
                        </th>

                        <th className="w-[18%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Assignee
                        </th>

                        <th className="w-[10%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Priority
                        </th>

                        <th className="w-[12%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Created
                        </th>

                        <th className="w-[12%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Due
                        </th>

                        <th className="w-[16%] px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Status
                        </th>
                      </tr>
                    </thead>

                    {/* BODY */}
                    <tbody className="divide-y divide-slate-100">
                      {(filteredTasks || []).map((task) => {
                        const normalizedToday = new Date();

                        const shouldShowModal = Boolean(task?._id);

                        normalizedToday.setHours(0, 0, 0, 0);

                        const dueDate = new Date(task.dueDate);

                        dueDate.setHours(0, 0, 0, 0);

                        const isOverdue =
                          dueDate < normalizedToday && task.status !== "DONE";

                        return (
                          <tr
                            key={task._id}
                            className="transition hover:bg-slate-50"
                          >
                            {/* TASK */}
                            <td className="px-3 py-3 align-top">
                              <div className="flex items-start gap-2">
                                {/* Dot */}
                                <div
                                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                    task.status === "DONE"
                                      ? "bg-emerald-500"
                                      : task.status === "IN_PROGRESS"
                                        ? "bg-indigo-600"
                                        : task.status === "QA_TESTING"
                                          ? "bg-purple-500"
                                          : "bg-slate-400"
                                  }`}
                                />

                                {/* Content */}
                                <div className="min-w-0 flex-1">
                                  {/* Title */}
                                  <button
                                    type="button"
                                    disabled={!shouldShowModal}
                                    onClick={() => handleViewTask(task)}
                                    className="w-full text-left"
                                  >
                                    <p
                                      className="
                        break-words whitespace-normal
                        text-[12px] font-semibold
                        leading-5 text-slate-800
                      "
                                    >
                                      {task.title}
                                    </p>
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* ASSIGNEE */}
                            <td className="px-2 py-3 align-top">
                              {task.assignees && task.assignees.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                  {/* Avatars */}
                                  {/* <div className="flex items-center">
                                    <div className="flex -space-x-1.5">
                                      {task.assignees
                                        .slice(0, 3)
                                        .map((assignee, i) => {
                                          const name =
                                            getAssigneeName(assignee);

                                          return (
                                            <div
                                              key={i}
                                              className="
                                    flex h-6 w-6 items-center justify-center
                                    rounded-full border-2 border-white
                                    bg-slate-200 text-[9px]
                                    font-bold text-slate-700
                                  "
                                            >
                                              {name?.charAt(0)?.toUpperCase()}
                                            </div>
                                          );
                                        })}

                                      {task.assignees.length > 3 && (
                                        <div
                                          className="
                              flex h-6 w-6 items-center justify-center
                              rounded-full border-2 border-white
                              bg-slate-300 text-[8px]
                              font-bold text-slate-700
                            "
                                        >
                                          +{task.assignees.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  </div> */}

                                  {/* Names */}
                                  <div className="space-y-0.5">
                                    {task.assignees
                                      .slice(0, 2)
                                      .map((assignee, i) => (
                                        <p
                                          key={i}
                                          className="
                                break-words text-[10px]
                                font-medium leading-4
                                text-slate-600
                              "
                                        >
                                          {getAssigneeName(assignee)}
                                        </p>
                                      ))}

                                    {task.assignees.length > 2 && (
                                      <p className="text-[9px] text-slate-400">
                                        +{task.assignees.length - 2} more
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  Unassigned
                                </span>
                              )}
                            </td>

                            {/* PRIORITY */}
                            <td className="px-2 py-3 align-top">
                              <Badge
                                label={task.priority}
                                variant={getPriorityVariant(task.priority)}
                              />
                            </td>

                            {/* CREATED */}
                            <td className="px-2 py-3 align-top">
                              <p className="text-[10px] leading-4 text-slate-500">
                                {task.createdAt
                                  ? new Date(task.createdAt).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      },
                                    )
                                  : "-"}
                              </p>
                            </td>

                            {/* DUE */}
                            <td className="px-2 py-3 align-top">
                              <div className="flex flex-col">
                                <span
                                  className={`text-[10px] font-semibold leading-4 ${
                                    isOverdue
                                      ? "text-red-600"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {new Date(task.dueDate).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    },
                                  )}
                                </span>

                                {isOverdue && (
                                  <span className="mt-0.5 text-[9px] font-medium text-red-400">
                                    Overdue
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* STATUS */}
                            <td className="px-2 py-3 align-top">
                              <div className="max-w-[140px]">
                                {isLead ? (
                                  <StatusSelect
                                    value={task.status}
                                    onChange={(val) =>
                                      updateTaskStatus(task._id, val)
                                    }
                                  />
                                ) : (
                                  <Badge
                                    label={task.status.replace("_", " ")}
                                    variant={getStatusVariant(task.status)}
                                  />
                                )}
                                {task.status === "DONE" &&
                                  ["ADMIN", "PM"].includes(
                                    task.createdBy?.roles?.tracker,
                                  ) &&
                                  task.closedBy?.name && (
                                    <p className="mt-1 text-[9px] text-slate-400">
                                      Task done by {task.closedBy.name}
                                    </p>
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] font-medium text-slate-500">
                    Showing {taskRangeStart}-{taskRangeEnd} of{" "}
                    {projectTaskTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={tasksLoading || taskPagination.page <= 1}
                      onClick={() => loadProjectTasks(taskPagination.page - 1)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="min-w-[88px] text-center text-[11px] font-semibold text-slate-600">
                      Page {taskPagination.page} of {taskPagination.pages}
                    </span>
                    <button
                      type="button"
                      disabled={
                        tasksLoading ||
                        taskPagination.page >= taskPagination.pages
                      }
                      onClick={() => loadProjectTasks(taskPagination.page + 1)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TIMELINE ───────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6 max-w-5xl">
            {/* Hero Project Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-slate-900 via-blue-600 to-emerald-500" />

              <div className="p-6">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                        <Icons.Folder />
                      </div>

                      <div>
                        <h2 className="text-xl font-bold text-slate-900">
                          {project.name}
                        </h2>

                        <p className="text-sm text-slate-400 mt-0.5">
                          Project Workspace
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed mt-5 max-w-3xl">
                      {project.description ||
                        "No project description has been added yet."}
                    </p>

                    <div className="flex flex-wrap gap-2 mt-5">
                      <Badge
                        label={project.status}
                        variant={getStatusVariant(project.status)}
                      />

                      <Badge
                        label={project.priority}
                        variant={getPriorityVariant(project.priority)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3 xl:min-w-[280px]">
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-[11px] uppercase font-semibold text-slate-400">
                        Start Date
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-1">
                        {project.startDate
                          ? new Date(project.startDate).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "Not Set"}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-[11px] uppercase font-semibold text-slate-400">
                        Deadline
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-1">
                        {project.endDate
                          ? new Date(project.endDate).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "Not Set"}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-[11px] uppercase font-semibold text-slate-400">
                        Project Lead
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-1">
                        {projectLeadName}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-[11px] uppercase font-semibold text-slate-400">
                        Team Size
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-1">
                        {membersCount} Members
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Insights Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs text-slate-400 font-semibold uppercase">
                  Total Tasks
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {analytics.total}
                </p>
                <p className="text-xs text-slate-500 mt-1">All project tasks</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs text-slate-400 font-semibold uppercase">
                  Completed
                </p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">
                  {analytics.completed}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Successfully delivered
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs text-slate-400 font-semibold uppercase">
                  Active Sprints
                </p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {sprintsCount}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Sprint cycles created
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs text-slate-400 font-semibold uppercase">
                  Completion
                </p>

                <div className="mt-3">
                  <DonutChart
                    value={analytics.completed}
                    total={analytics.total}
                  />
                </div>

                <p className="text-xs text-slate-500 mt-2">
                  {analytics.rate}% complete
                </p>
              </div>
            </div>

            {/* Progress Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Task Progress */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-5">
                  Task Progress
                </h3>

                <div className="space-y-4">
                  <HBar
                    label="Todo"
                    count={analytics.todo}
                    total={analytics.total}
                    color="#94a3b8"
                  />

                  <HBar
                    label="In Progress"
                    count={analytics.inProgress}
                    total={analytics.total}
                    color="#3b82f6"
                  />

                  <HBar
                    label="Completed"
                    count={analytics.completed}
                    total={analytics.total}
                    color="#10b981"
                  />
                </div>
              </div>

              {/* Priority Insights */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-5">
                  Priority Insights
                </h3>

                <div className="space-y-4">
                  <HBar
                    label="High"
                    count={analytics.high}
                    total={analytics.total}
                    color="#ef4444"
                  />

                  <HBar
                    label="Medium"
                    count={analytics.medium}
                    total={analytics.total}
                    color="#f59e0b"
                  />

                  <HBar
                    label="Low"
                    count={analytics.low}
                    total={analytics.total}
                    color="#10b981"
                  />
                </div>
              </div>
            </div>

            {/* Summary Footer */}
            <div className="bg-gradient-to-r from-blue-50 to-emerald-50 border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Project Insights
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed">
                {analytics.rate >= 80
                  ? "Excellent progress. This project is moving strongly toward completion."
                  : analytics.rate >= 50
                    ? "Good momentum. Continue pushing active work to completion."
                    : analytics.total === 0
                      ? "No tasks created yet. Start planning deliverables and sprint execution."
                      : "Project needs attention. Review blockers and pending tasks."}
              </p>
            </div>
          </div>
        )}
        {/* ── SPRINTS ───────────────────────────────────────────── */}
        {activeTab === "sprints" && (
          <div className="w-full space-y-4">
            {sprintsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <p className="text-[12px] text-slate-400">Loading sprints...</p>
              </div>
            ) : sprints.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-16 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Icons.Calendar />
                </div>
                <p className="text-[13px] font-semibold text-slate-700">
                  No sprints yet
                </p>
                <p className="text-[12px] text-slate-400 mt-1">
                  This project has no sprint planning yet
                </p>
                {isLead && (
                  <button
                    onClick={() => {
                      setSprintCreateModalOpen(true);
                      setSprintCreateErrors({});
                      setSprintCreateSubmitting(false);
                      setSprintCreateForm((f) => ({
                        ...f,
                        projectId: project._id,
                      }));
                    }}
                    className="mt-4 h-8 px-4 rounded-lg bg-indigo-600 text-white text-[12.5px] font-semibold hover:bg-indigo-700 transition inline-flex items-center gap-1.5"
                  >
                    <Icons.Plus /> Create First Sprint
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* ── Summary stat cards ── */}
                {(() => {
                  const total = sprints.length;
                  const active = sprints.filter(
                    (s) => s.status === "Active",
                  ).length;
                  const planning = sprints.filter(
                    (s) => s.status === "Planning",
                  ).length;
                  const completed = sprints.filter(
                    (s) => s.status === "Completed",
                  ).length;
                  const overdue = sprints.filter((s) => {
                    const end = s.endDate ? new Date(s.endDate) : null;
                    return end && end < today && s.status !== "Completed";
                  }).length;

                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3">
                      {[
                        {
                          label: "Total",
                          value: total,
                          iconBg: "bg-indigo-50",
                          iconColor: "text-indigo-500",
                          icon: (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
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
                          ),
                        },
                        {
                          label: "Active",
                          value: active,
                          iconBg: "bg-blue-50",
                          iconColor: "text-blue-500",
                          icon: (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          ),
                        },
                        {
                          label: "Planning",
                          value: planning,
                          iconBg: "bg-amber-50",
                          iconColor: "text-amber-500",
                          icon: (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          ),
                        },
                        {
                          label: "Completed",
                          value: completed,
                          iconBg: "bg-emerald-50",
                          iconColor: "text-emerald-500",
                          icon: (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ),
                        },
                      ].map((s, i) => (
                        <div
                          key={i}
                          className="rounded-xl border p-3.5 shadow-sm bg-white border-slate-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                              {s.label}
                            </span>
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center ${s.iconBg} ${s.iconColor}`}
                            >
                              {s.icon}
                            </div>
                          </div>
                          <p className="text-[24px] font-bold leading-none text-slate-800">
                            {s.value}
                          </p>
                          {overdue > 0 && i === 0 && (
                            <p className="text-[11px] text-red-500 mt-1">
                              {overdue} overdue
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ── Header row ── */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900">
                      Project Sprints
                      <span className="text-[12px] text-slate-400 font-normal ml-2">
                        {sprints.length} total
                      </span>
                    </h3>
                  </div>
                  {isLead && (
                    <button
                      onClick={() => {
                        setSprintCreateModalOpen(true);
                        setSprintCreateErrors({});
                        setSprintCreateSubmitting(false);
                        setSprintCreateForm((f) => ({
                          ...f,
                          projectId: project._id,
                        }));
                      }}
                      className="h-8 px-3.5 rounded-lg bg-indigo-600 text-white text-[12.5px] font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5"
                    >
                      <Icons.Plus /> Add Sprint
                    </button>
                  )}
                </div>

                {/* ── Sprint cards ── */}
                <div className="space-y-3">
                  {sprints.map((sprint) => {
                    const start = sprint.startDate
                      ? new Date(sprint.startDate)
                      : null;
                    const end = sprint.endDate
                      ? new Date(sprint.endDate)
                      : null;
                    const isOverdue =
                      end && end < today && sprint.status !== "Completed";
                    const isDone = sprint.status === "Completed";

                    const totalDays =
                      start && end
                        ? Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                        : 0;
                    const elapsed = start
                      ? Math.ceil((today - start) / (1000 * 60 * 60 * 24))
                      : 0;
                    const daysLeft = end
                      ? Math.ceil((end - today) / (1000 * 60 * 60 * 24))
                      : 0;
                    const progress =
                      totalDays > 0
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round((elapsed / totalDays) * 100),
                            ),
                          )
                        : 0;

                    const statusCfg = {
                      Active: {
                        dot: "#3b82f6",
                        badge:
                          "bg-blue-50 text-blue-700 border border-blue-200",
                      },
                      Planning: {
                        dot: "#f59e0b",
                        badge:
                          "bg-amber-50 text-amber-700 border border-amber-200",
                      },
                      Completed: {
                        dot: "#10b981",
                        badge:
                          "bg-emerald-50 text-emerald-700 border border-emerald-200",
                      },
                    };
                    const sc = statusCfg[sprint.status] || {
                      dot: "#94a3b8",
                      badge:
                        "bg-slate-100 text-slate-600 border border-slate-200",
                    };

                    const fmtDate = (d) =>
                      d
                        ? d.toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Not set";

                    return (
                      <div
                        key={sprint._id}
                        className={`bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-all group ${
                          isOverdue
                            ? "border-red-200"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: sc.dot }}
                              />
                              <h4 className="text-[13.5px] font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                {sprint.name}
                              </h4>
                            </div>
                            {sprint.goal && (
                              <p className="text-[12px] text-slate-400 ml-4 line-clamp-1">
                                {sprint.goal}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0 ${sc.badge}`}
                          >
                            {sprint.status}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Timeline Progress
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {isDone ? 100 : progress}%
                            </span>
                          </div>
                          <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${isDone ? 100 : progress}%`,
                                backgroundColor: isDone
                                  ? "#10b981"
                                  : isOverdue
                                    ? "#ef4444"
                                    : "#3b82f6",
                              }}
                            />
                          </div>
                        </div>

                        {/* Date tiles + days pill */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
                            <p className="text-[9.5px] uppercase font-semibold text-slate-400 mb-0.5">
                              Start
                            </p>
                            <p className="text-[12px] font-bold text-slate-700">
                              {fmtDate(start)}
                            </p>
                          </div>
                          <div
                            className={`rounded-lg px-3 py-2.5 border ${isOverdue ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}
                          >
                            <p className="text-[9.5px] uppercase font-semibold text-slate-400 mb-0.5">
                              End
                            </p>
                            <p
                              className={`text-[12px] font-bold ${isOverdue ? "text-red-600" : "text-slate-700"}`}
                            >
                              {fmtDate(end)}
                            </p>
                          </div>
                        </div>

                        {/* Footer meta */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="11"
                              height="11"
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
                            {totalDays > 0
                              ? `${totalDays} day${totalDays !== 1 ? "s" : ""} total`
                              : "Dates not set"}
                          </div>

                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              isDone
                                ? "bg-emerald-50 text-emerald-600"
                                : isOverdue
                                  ? "bg-red-50 text-red-600"
                                  : daysLeft <= 7 && daysLeft > 0
                                    ? "bg-amber-50 text-amber-600"
                                    : daysLeft > 0
                                      ? "bg-slate-100 text-slate-600"
                                      : "bg-slate-100 text-slate-400"
                            }`}
                          >
                            {isDone
                              ? "✓ Completed"
                              : isOverdue
                                ? `${Math.abs(daysLeft)}d overdue`
                                : daysLeft > 0
                                  ? `${daysLeft}d left`
                                  : "Ends today"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {/* ── TIMELINE ─────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="mt-6 mb-6 max-w-5xl">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Project Attachments
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Files uploaded for this project.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                  {attachments.length} file{attachments.length === 1 ? "" : "s"}
                </span>
              </div>

              {attachments.length === 0 ? (
                <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                    <Icons.File />
                  </div>
                  <p className="text-xs font-bold text-slate-600">
                    No attachments yet
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Project documents will appear here after upload.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-2">
                  {attachments.map((attachment, index) => (
                    <ProjectAttachmentRow
                      key={
                        attachment?.fileUrl ||
                        attachment?._id ||
                        attachment?.id ||
                        index
                      }
                      attachment={attachment}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TIMELINE ─────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            {/* TOP STATS Summery Cards */}
            {/* <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
           
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                      Start
                    </p>

                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      {project.startDate
                        ? new Date(project.startDate).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",

                              month: "short",
                              year: "numeric",
                            },
                          )
                        : "--"}
                    </h3>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">
                    <Icons.Flag />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
                      Sprints
                    </p>

                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      {sprints.length}
                    </h3>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500 text-white">
                    <Icons.Calendar />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Tasks
                    </p>

                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      {tasks.length}
                    </h3>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <Icons.Tasks />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">
                      Deadline
                    </p>

                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      {project.endDate
                        ? new Date(project.endDate).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )
                        : "--"}
                    </h3>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-white">
                    <Icons.Alert />
                  </div>
                </div>
              </div>
            </div> */}

            {/* TIMELINE */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              {/* Header */}
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                  <Icons.Timeline />
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Project Timeline
                  </h2>

                  <p className="text-xs text-slate-500">
                    Activity history & milestones
                  </p>
                </div>
              </div>

              {/* Timeline Body */}
              <div className="relative">
                {/* Line */}
                <div className="absolute left-[15px] top-0 bottom-0 w-[2px] bg-slate-200" />

                <div className="space-y-4">
                  {/* CREATED */}
                  {project.createdAt && (
                    <div className="relative flex gap-4">
                      <div className="relative  flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Icons.Plus />
                      </div>

                      <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Project Created
                            </p>

                            <h3 className="mt-1 text-sm font-semibold text-slate-800">
                              {project.name}
                            </h3>
                          </div>

                          <span className="text-xs text-slate-500">
                            Created on{" "}
                            <span className="font-semibold text-slate-700">
                              {new Date(project.createdAt).toLocaleDateString(
                                "en-GB",
                              )}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* START */}
                  {project.startDate && (
                    <div className="relative flex gap-3">
                      {/* Timeline Icon */}
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-500 text-white">
                        <Icons.Flag />
                      </div>

                      {/* Card */}
                      <div className="flex-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          {/* Left Content */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                              Project Started
                            </p>

                            <h3 className="mt-1 text-sm font-semibold text-slate-800">
                              Development Started
                            </h3>
                          </div>

                          {/* Date */}
                          <div className="min-w-[90px] text-left lg:text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                              Date
                            </p>

                            <p className="mt-1 text-xs font-medium text-emerald-700">
                              {new Date(project.startDate).toLocaleDateString(
                                "en-GB",
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SPRINTS */}
                  {(sprints || []).map((sprint) => (
                    <div key={sprint._id} className="relative flex gap-3">
                      {/* Timeline Icon */}
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-blue-600 text-white">
                        <Icons.Calendar />
                      </div>

                      {/* Sprint Card */}
                      <div className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          {/* Left Content */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Sprint
                            </p>

                            <h3 className="mt-1 truncate text-sm font-semibold text-slate-800">
                              {sprint.name}
                            </h3>
                          </div>

                          {/* Dates */}
                          <div className="flex items-center gap-6 lg:gap-8">
                            {/* Start Date */}
                            <div className="min-w-[75px] text-left lg:text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Start
                              </p>

                              <p className="mt-1 text-xs font-medium text-slate-700">
                                {sprint.startDate
                                  ? new Date(
                                      sprint.startDate,
                                    ).toLocaleDateString("en-GB")
                                  : "--"}
                              </p>
                            </div>

                            {/* End Date */}
                            <div className="min-w-[75px] text-left lg:text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                End
                              </p>

                              <p className="mt-1 text-xs font-medium text-slate-700">
                                {sprint.endDate
                                  ? new Date(sprint.endDate).toLocaleDateString(
                                      "en-GB",
                                    )
                                  : "--"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* TASKS (Timeline paginated) */}
                  {(tasks || [])
                    .slice(0, timelinePage * TIMELINE_PAGE_SIZE)
                    .map((task) => (
                      <div key={task._id} className="relative flex gap-3">
                        {/* Timeline Icon */}
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-indigo-600 text-white">
                          <Icons.Tasks />
                        </div>

                        {/* Card */}
                        <div className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            {/* Left Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-sm font-semibold text-slate-800">
                                  {task.title}
                                </h3>

                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                    task.status === "DONE"
                                      ? "border-slate-300 bg-slate-100 text-slate-700"
                                      : task.status === "IN_PROGRESS"
                                        ? "border-slate-300 bg-slate-100 text-slate-700"
                                        : task.status === "QA_TESTING"
                                          ? "border-slate-300 bg-slate-100 text-slate-700"
                                          : "border-slate-300 bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  {task.status?.replaceAll("_", " ")}
                                </span>
                              </div>

                              {task.description && (
                                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            {/* Right Dates Section */}
                            <div className="flex shrink-0 items-center gap-6 lg:gap-8">
                              {/* Created */}
                              <div className="min-w-[70px] text-left lg:text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Created
                                </p>

                                <p className="mt-1 text-xs font-medium text-slate-700">
                                  {task.createdAt
                                    ? new Date(
                                        task.createdAt,
                                      ).toLocaleDateString("en-GB")
                                    : "--"}
                                </p>
                              </div>

                              {/* Due */}
                              <div className="min-w-[70px] text-left lg:text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Due Date
                                </p>

                                <p
                                  className={`mt-1 text-xs font-medium ${
                                    isTaskOverdue(task)
                                      ? "text-red-500"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {task.dueDate
                                    ? new Date(task.dueDate).toLocaleDateString(
                                        "en-GB",
                                      )
                                    : "--"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* DEADLINE */}
                  {project.endDate && (
                    <div className="relative flex gap-4">
                      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                        <Icons.Alert />
                      </div>

                      <div className="flex-1 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">
                              Deadline
                            </p>

                            <h3 className="mt-1 text-sm font-semibold text-slate-800">
                              Final Delivery Date
                            </h3>
                          </div>

                          <span className="text-xs text-slate-500">
                            Delivery by{" "}
                            <span className="font-semibold text-red-700">
                              {new Date(project.endDate).toLocaleDateString(
                                "en-GB",
                              )}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Load More (Timeline) */}
                {timelineHasMore && (
                  <div className="pt-4 flex justify-center">
                    <button
                      type="button"
                      disabled={timelineLoading}
                      onClick={loadTimelineMore}
                      className="inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-indigo-600 px-4 text-[11px] font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {timelineLoading ? (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      ) : (
                        <>Load More</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MEMBERS ─────────────────────────────────────────── */}
        {(activeTab === "members" || activeTab === "overview") && (
          <div
            className={`space-y-6 ${
              activeTab === "overview" ? "max-w-5xl" : "w-full"
            }`}
          >
            {/* Members Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Role Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Team by Role
                </h4>
                <div className="space-y-3">
                  {Object.entries(
                    teamMembers.reduce((acc, member) => {
                      const role = getMemberRole(member);
                      acc[role] = (acc[role] || 0) + 1;
                      return acc;
                    }, {}),
                  ).map(([role, count]) => (
                    <div
                      key={role}
                      className="flex items-center justify-between"
                    >
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${roleColor(role)}`}
                      >
                        {role}
                      </span>

                      <span className="font-bold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Members */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-slate-200 p-6 rounded-xl shadow-sm text-center">
                <div className="text-3xl font-bold bg-white w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  {membersCount}
                </div>
                <div className="text-sm text-slate-600">Total Team Members</div>
              </div>
            </div>

            {/* Members Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800">
                  Team Members ({membersCount})
                </h3>
              </div>
              {teamMembers.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Icons.User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-lg font-semibold">No team members yet</p>
                  <p className="text-sm mt-1">
                    Add members to collaborate on this project
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Member
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Joined
                        </th>
                        {isLead && (
                          <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teamMembers.map((member) => (
                        <tr key={member._id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full flex items-center justify-center">
                                <span className="font-bold text-slate-700 text-sm">
                                  {member.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-sm text-slate-900">
                                  {member.name}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${roleColor(getMemberRole(member))}`}
                            >
                              {getMemberRole(member)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {member.createdAt
                              ? new Date(member.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : "Recent"}
                          </td>
                          {isLead && (
                            <td className="px-6 py-4">
                              <button
                                onClick={() => {
                                  toast.custom((t) => (
                                    <div className="w-[360px] rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
                                      {/* Header */}
                                      <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                                          <Icons.Alert />
                                        </div>

                                        <div className="flex-1">
                                          <h3 className="text-sm font-bold text-slate-800">
                                            Remove Member
                                          </h3>

                                          <p className="mt-1 text-xs leading-5 text-slate-500">
                                            Remove{" "}
                                            <span className="font-semibold text-slate-700">
                                              {member.name}
                                            </span>{" "}
                                            from this project?
                                          </p>

                                          <p className="mt-1 text-[11px] text-slate-400">
                                            They can be added again later.
                                          </p>
                                        </div>
                                      </div>

                                      {/* Actions */}
                                      <div className="mt-4 flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => toast.dismiss(t)}
                                          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                                        >
                                          Cancel
                                        </button>

                                        <button
                                          onClick={() => {
                                            toast.dismiss(t);
                                            toggleTeamMember(member._id);
                                          }}
                                          className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  ));
                                }}
                                className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                                title="Remove from project"
                              >
                                <Icons.X />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ---------------------Analytics----------------------------- */}
        {activeTab === "analytics" && (
          <div className="max-w-6xl space-y-4">
            {/* Bottom Compact Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Completion Rate",
                  value: `${Math.round(
                    (analytics.completed / analytics.total) * 100 || 0,
                  )}%`,
                  icon: <Icons.CheckCircle />,
                  bg: "bg-emerald-50",
                  text: "text-emerald-700",
                },

                {
                  label: "Active Tasks",
                  value: analytics.inProgress,
                  icon: <Icons.TrendUp />,
                  bg: "bg-blue-50",
                  text: "text-blue-700",
                },

                {
                  label: "Pending",
                  value: analytics.todo,
                  icon: <Icons.Clock />,
                  bg: "bg-slate-100",
                  text: "text-slate-700",
                },

                {
                  label: "High Priority",
                  value: analytics.high,
                  icon: <Icons.Alert />,
                  bg: "bg-red-50",
                  text: "text-red-700",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border border-slate-200 ${item.bg} px-4 py-3`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                        {item.label}
                      </p>

                      <h3 className="mt-1 text-2xl font-extrabold text-slate-900">
                        {item.value}
                      </h3>
                    </div>

                    <div className={`${item.text}`}>{item.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 flex flex-col items-center justify-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-3 self-start">
                  Task Completion
                </p>
                <DonutChart value={analytics.completed} total={analytics.total} />
                <p className="mt-1 text-[11px] text-slate-500">
                  {analytics.completed} of {analytics.total} tasks done
                </p>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-4">
                  Tasks by Priority
                </p>
                <div className="space-y-3">
                  {[
                    { label: "High", value: analytics.high, cls: "bg-red-500" },
                    { label: "Medium", value: analytics.medium, cls: "bg-amber-500" },
                    { label: "Low", value: analytics.low, cls: "bg-emerald-500" },
                  ].map((p) => {
                    const max = Math.max(analytics.high, analytics.medium, analytics.low, 1);
                    return (
                      <div key={p.label} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs font-semibold text-slate-600">{p.label}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.cls} transition-all`}
                            style={{ width: `${(p.value / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-6 shrink-0 text-right text-xs font-bold text-slate-800">{p.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Overdue Alert */}
            {tasks.filter((t) => isTaskOverdue(t)).length > 0 && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <Icons.Alert />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-red-700">
                    Overdue Tasks Detected
                  </p>

                  <p className="text-xs text-red-600">
                    {tasks.filter((t) => isTaskOverdue(t)).length} task(s) are
                    pending beyond due date.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab("timeline")}
                  className="ml-auto shrink-0 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                >
                  View Timeline
                </button>
              </div>
            )}
          </div>
        )}
        {/* ── SETTINGS ───────────────────────────────────────────────────── */}

        {activeTab === "edit" && (
          <div
            className="space-y-5"
            style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
          >
            {/* ── Success toast ─────────────────────────────────────────────── */}
            {saveSuccess && (
              <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-semibold shadow-sm">
                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
                  <Icons.Check />
                </div>
                Project updated successfully!
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
        TWO-COLUMN GRID  ·  left = form  ·  right = team panel
    ══════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
              {/* ── LEFT — Edit form ──────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                    <Icons.Edit />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Edit Project
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Update project details, timeline and leadership
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveProject}
                    disabled={saving || !projectForm.name?.trim()}
                    className="ml-auto inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] sm:px-4 sm:text-sm"
                  >
                    {saving ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span className="hidden sm:inline">Saving…</span>
                      </>
                    ) : (
                      <>
                        <Icons.Save />
                        <span className="hidden sm:inline">Update Project</span>
                        <span className="sm:hidden">Save</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Form body */}
                <div className="p-6 space-y-5">
                  {/* Row 1 — Name + Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Project Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent placeholder-slate-400 transition-all hover:border-slate-300 hover:bg-white"
                        value={projectForm.name}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="e.g. Website Redesign"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Status
                      </label>
                      <div className="relative">
                        <select
                          className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent appearance-none transition-all hover:border-slate-300 hover:bg-white pr-9"
                          value={projectForm.status}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              status: e.target.value,
                            })
                          }
                        >
                          <option>Planning</option>
                          <option>Active</option>
                          <option>Completed</option>
                        </select>
                        {/* Status color dot */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              projectForm.status === "Active"
                                ? "bg-emerald-500"
                                : projectForm.status === "Planning"
                                  ? "bg-violet-500"
                                  : "bg-slate-400"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2 — Priority + Project Lead */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Priority
                      </label>
                      <div className="relative">
                        <select
                          className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent appearance-none transition-all hover:border-slate-300 hover:bg-white pr-9"
                          value={projectForm.priority}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              priority: e.target.value,
                            })
                          }
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              projectForm.priority === "High"
                                ? "bg-red-500"
                                : projectForm.priority === "Medium"
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Project Lead
                      </label>
                      <select
                        className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent appearance-none transition-all hover:border-slate-300 hover:bg-white"
                        value={projectForm.projectLead}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            projectLead: e.target.value,
                          })
                        }
                      >
                        <option value="">No lead assigned</option>
                        {projectUsers
                          ?.filter((u) => ["PM", "ADMIN"].includes(u.role))
                          ?.map((u) => (
                            <option key={u._id} value={u._id}>
                              {u.name} · {u.role}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3 — Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Start Date
                      </label>
                      <div className="relative">
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <input
                          type="date"
                          className="w-full border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent transition-all hover:border-slate-300 hover:bg-white"
                          value={projectForm.startDate}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              startDate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        End Date
                      </label>
                      <div className="relative">
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <input
                          type="date"
                          className="w-full border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent transition-all hover:border-slate-300 hover:bg-white"
                          value={projectForm.endDate}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              endDate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Description
                    </label>
                    <textarea
                      rows="5"
                      className="w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white focus:border-transparent placeholder-slate-400 resize-none transition-all hover:border-slate-300 hover:bg-white leading-relaxed"
                      placeholder="Describe project goals, objectives and deliverables…"
                      value={projectForm.description}
                      onChange={(e) =>
                        setProjectForm({
                          ...projectForm,
                          description: e.target.value,
                        })
                      }
                    />
                    <p className="text-[11px] text-slate-400 mt-1 text-right">
                      {projectForm.description?.length || 0} chars
                    </p>
                  </div>

                  {/* Attachments (Project files) */}
                  <div className="border border-slate-200 rounded-2xl bg-white p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Project Attachments
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Upload and manage project documents.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                        {attachments.length} file
                        {attachments.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                        <input
                          type="file"
                          multiple
                          className="block w-full cursor-pointer text-[11px] text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-slate-700 hover:file:bg-slate-300"
                          onChange={(e) =>
                            handleAttachmentFileChange(e.target.files)
                          }
                        />
                        <p className="mt-2 text-[10px] text-slate-400">
                          Supported: images, PDF, Word, Excel • Max 10 MB per
                          file
                        </p>

                        {attachmentError && (
                          <p className="mt-2 text-[11px] text-red-500 font-medium">
                            {attachmentError}
                          </p>
                        )}

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={attachmentsUploading}
                            onClick={() => {
                              setAttachmentFiles([]);
                              setAttachmentError("");
                            }}
                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            disabled={attachmentsUploading}
                            onClick={handleUploadAttachments}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {attachmentsUploading ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Icons.Upload />
                            )}
                            {attachmentsUploading ? "Uploading..." : "Upload"}
                          </button>
                        </div>
                      </div>

                      {attachmentFiles?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {attachmentFiles.slice(0, 6).map((f, idx) => (
                            <span
                              key={`${f.name}-${idx}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 border border-blue-100"
                            >
                              📎 {f.name}
                            </span>
                          ))}
                          {attachmentFiles.length > 6 && (
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 border border-slate-200">
                              +{attachmentFiles.length - 6} more
                            </span>
                          )}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-700">
                            Existing attachments
                          </p>
                          {attachmentError ? null : (
                            <p className="text-[10px] text-slate-400">
                              Click to open if URL is available
                            </p>
                          )}
                        </div>

                        {attachments.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center">
                            <p className="text-xs font-bold text-slate-500">
                              No uploaded files
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              Choose files above to add project documents.
                            </p>
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            {attachments.map((attachment, index) => (
                              <ProjectAttachmentRow
                                key={
                                  attachment?._id ||
                                  attachment?.fileUrl ||
                                  attachment?.id ||
                                  index
                                }
                                attachment={attachment}
                                index={index}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-100" />

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveProject}
                      disabled={saving || !projectForm.name?.trim()}
                      className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving…
                        </>
                      ) : (
                        <>
                          <Icons.Save />
                          Update Project
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        populateForm(project);
                      }}
                      disabled={saving}
                      className="px-5 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              {/* ── RIGHT SIDE ───────────────────────────────────── */}
              <div className="space-y-4">
                {/* ================================================= */}
                {/* CURRENT TEAM */}
                {/* ================================================= */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                        <Icons.Team />
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Current Team
                        </h3>

                        <p className="text-[11px] text-slate-500">
                          Active project members
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      {teamMembers.length}
                    </span>
                  </div>

                  {usersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
                    </div>
                  ) : (
                    <div className="p-4">
                      {/* SEARCH */}
                      <div className="relative mb-4">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                          <Icons.Search />
                        </div>

                        <input
                          type="text"
                          placeholder="Search team..."
                          value={teamSearch}
                          onChange={(e) => setTeamSearch(e.target.value)}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>

                      {/* MEMBERS */}
                      <div className="space-y-2 max-h-[320px] overflow-y-auto">
                        {teamMembers
                          .filter((m) =>
                            m.name
                              .toLowerCase()
                              .includes(teamSearch.toLowerCase()),
                          )
                          .map((member) => (
                            <div
                              key={member._id}
                              className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Avatar */}
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-800">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>

                                {/* Info */}
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-slate-800">
                                    {member.name}
                                  </p>

                                  <span
                                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${roleColor(
                                      getMemberRole(member),
                                    )}`}
                                  >
                                    {getMemberRole(member)}
                                  </span>
                                </div>
                              </div>

                              {/* Remove */}
                              <button
                                onClick={() => toggleTeamMember(member._id)}
                                disabled={teamUpdating[member._id]}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200"
                              >
                                {teamUpdating[member._id] ? (
                                  <div className="h-3 w-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                                ) : (
                                  <Icons.X />
                                )}
                              </button>
                            </div>
                          ))}

                        {teamMembers.length === 0 && (
                          <div className="py-6 text-center text-xs text-slate-400">
                            No team members found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ================================================= */}
                {/* ADD MEMBERS */}
                {/* ================================================= */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white">
                        <Icons.Employees />
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Add Members
                        </h3>

                        <p className="text-[11px] text-slate-500">
                          Invite users to project
                        </p>
                      </div>
                    </div>

                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                      {
                        projectUsers.filter(
                          (u) => !selectedUsers.includes(u._id),
                        ).length
                      }
                    </span>
                  </div>

                  <div className="p-4">
                    {/* SEARCH */}
                    <div className="relative mb-4">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <Icons.Search />
                      </div>

                      <input
                        type="text"
                        placeholder="Search users..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* USERS */}
                    <div className="grid grid-cols-3 gap-2 max-h-[340px] overflow-y-auto">
                      {projectUsers
                        .filter(
                          (u) =>
                            !selectedUsers.includes(u._id) &&
                            u.name
                              .toLowerCase()
                              .includes(memberSearch.toLowerCase()),
                        )
                        .map((u) => (
                          <button
                            key={u._id}
                            onClick={() => toggleTeamMember(u._id)}
                            disabled={teamUpdating[u._id]}
                            className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50"
                          >
                            <div className="flex flex-col items-center text-center">
                              {/* Avatar */}
                              <div className="relative">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-sm font-bold text-slate-800">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>

                                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                                  {teamUpdating[u._id] ? (
                                    <div className="h-2.5 w-2.5 rounded-full border border-white border-t-transparent animate-spin" />
                                  ) : (
                                    <Icons.Plus />
                                  )}
                                </div>
                              </div>

                              {/* Info */}
                              <p className="mt-2 truncate text-xs font-semibold text-slate-800">
                                {u.name}
                              </p>

                              <span
                                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${roleColor(
                                  u.role,
                                )}`}
                              >
                                {u.role}
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>

                    {/* EMPTY */}
                    {projectUsers.filter((u) => !selectedUsers.includes(u._id))
                      .length === 0 && (
                      <div className="py-6 text-center text-xs text-slate-400">
                        All users already added
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
        DANGER ZONE  (full width, below the two columns)
    ══════════════════════════════════════════════════════════════════ */}
            {isLead && (
              <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-red-100 bg-red-50/60">
                  <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                    <Icons.Alert />
                  </div>
                </div>

                <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Delete this project
                    </p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">
                      Permanently removes the project, all sprints, tasks,
                      activity logs and member assignments.
                      <span className="font-semibold text-red-600">
                        {" "}
                        This cannot be undone.
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      toast.custom(
                        (t) => (
                          <div
                            className="w-[360px] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
                            style={{
                              fontFamily:
                                "'DM Sans','Helvetica Neue',sans-serif",
                            }}
                          >
                            {/* Modal header */}
                            <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
                              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                                <Icons.Alert />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  Delete Project?
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  This action cannot be reversed
                                </p>
                              </div>
                            </div>
                            {/* Modal body */}
                            <div className="px-5 py-4">
                              <p className="text-sm text-slate-600 leading-relaxed">
                                You are about to permanently delete{" "}
                                <span className="font-bold text-slate-900">
                                  "{project.name}"
                                </span>
                                . All sprints, tasks and data will be lost.
                              </p>
                            </div>
                            {/* Modal footer */}
                            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
                              <button
                                onClick={() => toast.dismiss(t)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  toast.dismiss(t);
                                  try {
                                    await API.delete(
                                      `/projects/${project._id}`,
                                    );
                                    toast.success("Project deleted");
                                    setTimeout(() => {
                                      window.location.href = "/projects";
                                    }, 800);
                                  } catch (e) {
                                    toast.error(
                                      e.response?.data?.message ||
                                        "Failed to delete project",
                                    );
                                  }
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-sm"
                              >
                                Delete Permanently
                              </button>
                            </div>
                          </div>
                        ),
                        { duration: Infinity },
                      );
                    }}
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 transition active:scale-[0.98]"
                  >
                    <Icons.Alert />
                    Delete Project
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
