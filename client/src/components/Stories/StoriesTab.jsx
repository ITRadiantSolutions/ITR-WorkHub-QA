import { useEffect, useMemo, useState } from "react";
import {
  API,
  getStoriesBySprint,
  createStory,
  updateStory,
  deleteStory,
  getStoryComments,
  addStoryComment,
} from "../../services/api";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import Icons from "../Icons";

// ── Status / Priority config ──────────────────────────────────────────────────
const STATUS_CFG = {
  "To Do": {
    label: "To Do",
    dot: "#94a3b8",
    badge: "bg-slate-100 text-slate-600 border border-slate-200",
  },
  "In Progress": {
    label: "In Progress",
    dot: "#3b82f6",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  Testing: {
    label: "Testing",
    dot: "#a855f7",
    badge: "bg-purple-50 text-purple-700 border border-purple-200",
  },
  Done: {
    label: "Done",
    dot: "#10b981",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
};

const PRIORITY_CFG = {
  Low: "bg-green-50 text-green-700 border border-green-200",

  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  High: "bg-red-50 text-red-700 border border-red-200",
};

// ── Tiny UI atoms ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.TODO;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${cfg.badge}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${PRIORITY_CFG[priority] || "bg-slate-100 text-slate-600 border border-slate-200"}`}
    >
      {priority || "—"}
    </span>
  );
}

const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";

// ── Modal shell ───────────────────────────────────────────────────────────────
function ModalShell({
  isOpen,
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center text-white shrink-0">
              {icon || <Icons.Book />}
            </div>
            <div>
              <h3 className="text-[13.5px] font-bold text-slate-900">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11px] text-slate-400">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
          >
            <Icons.X />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Story create / edit form ──────────────────────────────────────────────────
function StoryForm({
  mode,
  form,
  setForm,
  errors,
  setErrors,
  onCancel,
  onSubmit,
  submitting,
  isAdminPm,
  canManageStory,
}) {
  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (
      form.storyPoints === "" ||
      form.storyPoints === null ||
      Number.isNaN(Number(form.storyPoints))
    )
      e.storyPoints = "Story points required";
    if (!form.priority) e.priority = "Priority required";
    if (!form.status) e.status = "Status required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="space-y-4">
      {errors.submit && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
          <Icons.Alert /> {errors.submit}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Title */}
        <div className="sm:col-span-2">
          <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            className={inputCls}
            value={form.title}
            // disabled={!isAdminPm}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Login flow redesign"
          />
          {errors.title && (
            <p className="text-[11px] text-red-500 mt-1">{errors.title}</p>
          )}
        </div>
        {/* Story Points */}
        <div>
          <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Story Points <span className="text-red-400">*</span>
          </label>

          <select
            className={inputCls}
            value={form.storyPoints}
            // disabled={!isAdminPm}
            onChange={(e) => setForm({ ...form, storyPoints: e.target.value })}
          >
            <option value="">Select Story Points</option>

            <option value="1">
              1 - Very Small (Minimal effort, very low complexity)
            </option>

            <option value="2">
              2 - Small (Low effort, straightforward work)
            </option>

            <option value="3">
              3 - Small-Medium (Slight complexity, manageable effort)
            </option>

            <option value="5">
              5 - Medium (Moderate effort and complexity)
            </option>

            <option value="8">
              8 - Medium-Large (Significant effort, some uncertainty)
            </option>

            <option value="13">
              13 - Large (High complexity, multiple components involved)
            </option>

            <option value="21">
              21 - Very Large (High risk and uncertainty)
            </option>

            <option value="34">
              34 - Too Large (Should be broken into smaller stories)
            </option>

            <option value="55">55+ - Epic Sized (Must be split further)</option>
          </select>

          {form.storyPoints && (
            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-blue-700">
                {
                  {
                    1: "Very Small – Minimal effort, very low complexity",
                    2: "Small – Low effort, straightforward work",
                    3: "Small-Medium – Slight complexity, manageable effort",
                    5: "Medium – Moderate effort and complexity",
                    8: "Medium-Large – Significant effort, some uncertainty",
                    13: "Large – High complexity, multiple components involved",
                    21: "Very Large – Very high complexity, high risk and uncertainty",
                    34: "Too Large – Should be broken into smaller stories",
                    55: "Epic Sized – Not suitable as a single story, must be split further",
                  }[form.storyPoints]
                }
              </p>
            </div>
          )}

          {errors.storyPoints && (
            <p className="text-[11px] text-red-500 mt-1">
              {errors.storyPoints}
            </p>
          )}
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Priority <span className="text-red-400">*</span>
          </label>
          <select
            className={`${inputCls} ${form.priority ? PRIORITY_CFG[form.priority] || "" : ""}`}
            value={form.priority}
            // disabled={!isAdminPm}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="">Select priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          {errors.priority && (
            <p className="text-[11px] text-red-500 mt-1">{errors.priority}</p>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Status <span className="text-red-400">*</span>
          </label>
          <select
            className={inputCls}
            value={form.status}
            // disabled={!isAdminPm}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="">Select status</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Testing">Testing</option>
            <option value="Done">Done</option>
          </select>
          {errors.status && (
            <p className="text-[11px] text-red-500 mt-1">{errors.status}</p>
          )}
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            className={`${inputCls} resize-none`}
            value={form.description}
            // disabled={!isAdminPm}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe the story…"
          />
        </div>

        {/* Acceptance criteria */}
        <div className="sm:col-span-2">
          <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Acceptance Criteria
          </label>
          <textarea
            rows={3}
            className={`${inputCls} resize-none`}
            value={form.acceptanceCriteria}
            // disabled={!isAdminPm}
            onChange={(e) =>
              setForm({ ...form, acceptanceCriteria: e.target.value })
            }
            placeholder="What does 'done' mean for this story?"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={async () => {
            if (!validate()) return;
            await onSubmit();
          }}
          className="h-9 px-5 rounded-lg bg-blue-700 text-white text-[13px] font-semibold hover:bg-blue-800 transition flex items-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-r-white rounded-full animate-spin" />
              {mode === "create" ? "Creating…" : "Updating…"}
            </>
          ) : mode === "create" ? (
            <>
              <Icons.Plus /> Create Story
            </>
          ) : (
            <>
              <Icons.Edit /> Update Story
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Story detail / comments view ──────────────────────────────────────────────
function StoryView({
  story,
  comments,
  isLoadingComments,
  newComment,
  setNewComment,
  onPostComment,
  postingComment,
  user,
}) {
  if (!story) return null;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-[15px] font-bold text-slate-900 leading-snug flex-1">
            {story.title}
          </h3>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
            <Icons.Book />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={story.status} />
          <PriorityBadge priority={story.priority} />
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {story.storyPoints || 0} pts
          </span>
        </div>
      </div>

      {/* Description + Criteria */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Description
          </p>
          <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
            {story.description || (
              <span className="italic text-slate-300">No description</span>
            )}
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Acceptance Criteria
          </p>
          <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
            {story.acceptanceCriteria || (
              <span className="italic text-slate-300">Not defined</span>
            )}
          </p>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Comments
          </p>
          <span className="text-[10.5px] font-semibold text-slate-400">
            {comments?.length || 0}
          </span>
        </div>

        <div className="max-h-[280px] overflow-y-auto px-4 py-3 space-y-3">
          {isLoadingComments ? (
            <div className="flex items-center justify-center py-10 gap-2">
              <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
              <span className="text-[12px] text-slate-400">Loading…</span>
            </div>
          ) : comments?.length ? (
            comments.map((c) => (
              <div key={c._id || c.id} className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">
                  {(c.user?.name || user?.name || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-[12px] font-bold text-slate-900">
                      {c.user?.name || "Anonymous"}
                    </p>
                    {c.user?.role && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-[9.5px] font-semibold text-slate-500 rounded-full">
                        {String(c.user.role).replaceAll("_", " ")}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl rounded-tl-sm px-3 py-2.5">
                    <p className="text-[12.5px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {c.text}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">
                <Icons.Chat />
              </div>
              <p className="text-[13px] font-semibold text-slate-600">
                No comments yet
              </p>
              <p className="text-[12px] text-slate-400">
                Be the first to add a note
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex gap-2 items-center">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
              {(user?.name || "U").charAt(0).toUpperCase()}
            </div>
            <input
              className="flex-1 h-9 border border-slate-200 bg-white px-3 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
              placeholder="Write a comment… (Enter to post)"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onPostComment();
                }
              }}
              disabled={isLoadingComments || postingComment}
            />
            <button
              onClick={onPostComment}
              disabled={
                !newComment.trim() || isLoadingComments || postingComment
              }
              className="h-9 px-3 bg-blue-700 text-white rounded-lg text-[12px] font-semibold hover:bg-blue-800 transition disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              {postingComment ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-r-white rounded-full animate-spin" />
              ) : (
                <>
                  <Icons.Send /> Post
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status column (kanban-style display) ──────────────────────────────────────
function StatusPill({ status, onChange, disabled }) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      onClick={(e) => e.stopPropagation()}
      className={`text-[10.5px] font-bold border rounded-full pl-2.5 pr-6 py-1 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 transition ${STATUS_CFG[status]?.badge || "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {Object.entries(STATUS_CFG).map(([k, v]) => (
        <option key={k} value={k}>
          {v.label}
        </option>
      ))}
    </select>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SprintStories({ sprint, onClose }) {
  const { user, hasRole } = useAuth();
  const canCreateStory = hasRole(["ADMIN", "PM", "DEVELOPER", "QA"]);

  const isAdminPm = hasRole(["ADMIN", "PM"]);

  // Developer/QA can create and edit their own stories,
  // but ONLY Admin/PM can delete stories.
  const canEditStory = (story) => {
    if (isAdminPm) return true;
    return (
      (user?.role === "DEVELOPER" || user?.role === "QA") &&
      story?.createdBy?._id === user?._id
    );
  };

  const canDeleteStory = () => isAdminPm;

  const canManageStory = (story) => {
    // keep legacy name used by Edit modal (admin/pm can edit any story,
    // developer/qa can edit only their own)
    return canEditStory(story);
  };

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");

  // modals
  const [modal, setModal] = useState(null); // "create" | "edit" | "view"
  const [activeStory, setActiveStory] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState({});

  const emptyForm = {
    title: "",
    description: "",
    storyPoints: "",
    priority: "",
    status: "To Do",

    acceptanceCriteria: "",
    sprintId: sprint?._id || "",
  };
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  // comments
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!sprint?._id) return;
    setLoading(true);
    try {
      const res = await getStoriesBySprint(sprint._id);
      setStories(res?.data?.data || res?.data || []);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sprint?._id]);

  const loadComments = async (storyId) => {
    setLoadingComments(true);
    try {
      const res = await getStoryComments(storyId);
      setComments(res?.data?.data || res?.data?.comments || []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stories.filter((s) => {
      const matchSearch =
        !q ||
        s.title.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q);
      const matchStatus = filterStatus === "ALL" || s.status === filterStatus;
      const matchPriority =
        filterPriority === "ALL" || s.priority === filterPriority;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [stories, search, filterStatus, filterPriority]);

  const counts = useMemo(
    () => ({
      total: stories.length,
      TODO: stories.filter((s) => s.status === "To Do").length,
      IN_PROGRESS: stories.filter((s) => s.status === "In Progress").length,
      QA_TESTING: stories.filter((s) => s.status === "Testing").length,
      DONE: stories.filter((s) => s.status === "Done").length,
      pts: stories.reduce((acc, s) => acc + (Number(s.storyPoints) || 0), 0),
    }),
    [stories],
  );

  // ── actions ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setModal("create");
  };
  const openEdit = (s) => {
    setActiveStory(s);
    setForm({
      title: s.title,
      description: s.description || "",
      storyPoints: s.storyPoints ?? "",
      priority: s.priority || "",
      status: s.status || "To Do",

      acceptanceCriteria: s.acceptanceCriteria || "",
      sprintId: sprint._id,
    });
    setErrors({});
    setModal("edit");
  };
  const openView = (s) => {
    setActiveStory(s);
    setNewComment("");
    loadComments(s._id);
    setModal("view");
  };
  const closeModal = () => {
    setModal(null);
    setActiveStory(null);
    setComments([]);
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await createStory({ ...form, sprintId: sprint._id });
      // Always reload from server so populated fields (createdBy name, storyId, etc.) are consistent.
      await load();
      closeModal();
    } catch (e) {
      setErrors({ submit: e?.response?.data?.message || "Failed to create" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      await updateStory(activeStory._id, form);
      // Reload from server to avoid stale UI (hard refresh currently required)
      await load();
      closeModal();
    } catch (e) {
      setErrors({ submit: e?.response?.data?.message || "Failed to update" });
    } finally {
      setSubmitting(false);
    }
  };


  const handleDelete = (id) => {
    toast.custom((t) => (
      <div className="w-[380px] rounded-2xl border border-red-200 bg-white shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <Icons.Trash />
          </div>

          <div className="flex-1">
            <h3 className="text-[15px] font-bold text-slate-900">
              Delete Story?
            </h3>

            <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">
              This action cannot be undone. The story will be permanently
              removed.
            </p>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => toast.dismiss(t)}
                className="px-4 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  toast.dismiss(t);

                  setDeleting((p) => ({ ...p, [id]: true }));

                  try {
                    await deleteStory(id);

                    setStories((p) => p.filter((s) => s._id !== id));

                    toast.success("Story deleted successfully.");
                  } catch (error) {
                    toast.error(
                      error?.response?.data?.message ||
                        "Failed to delete story.",
                    );
                  } finally {
                    setDeleting((p) => ({ ...p, [id]: false }));
                  }
                }}
                className="px-4 h-9 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    ));
  };

  const handleStatusChange = async (id, newStatus) => {
    setStories((p) =>
      p.map((s) => (s._id === id ? { ...s, status: newStatus } : s)),
    );
    try {
      await updateStory(id, { status: newStatus });
    } catch {
      await load();
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !activeStory?._id) return;
    setPostingComment(true);
    try {
      const res = await addStoryComment(activeStory._id, newComment.trim());
      setComments(res?.data?.data || res?.data?.comments || []);
      setNewComment("");
    } catch {
    } finally {
      setPostingComment(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
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
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <h2 className="text-[17px] font-bold text-slate-900">
              {sprint?.name || "Sprint"} — Stories
            </h2>
          </div>
          {/* Inline stat pills row */}
          <div className="flex items-center gap-2 flex-wrap mt-1.5 ml-0.5">
            <span className="text-[11.5px] text-slate-400">
              {counts.total} stories
            </span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-[11.5px] text-slate-400">
              {counts.pts} pts
            </span>

            <span className="text-slate-300 text-xs">·</span>
            {/* Mini status pills */}
            {[
              { key: "TODO", label: "Todo", dot: "#94a3b8" },
              { key: "IN_PROGRESS", label: "In Progress", dot: "#3b82f6" },
              { key: "QA_TESTING", label: "QA", dot: "#a855f7" },
              { key: "DONE", label: "Done", dot: "#10b981" },
            ].map(
              (s) =>
                counts[s.key] > 0 && (
                  <button
                    key={s.key}
                    onClick={() =>
                      setFilterStatus(filterStatus === s.key ? "ALL" : s.key)
                    }
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                      filterStatus === s.key
                        ? "bg-blue-700 text-white border-blue-700"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          filterStatus === s.key ? "#fff" : s.dot,
                      }}
                    />
                    {counts[s.key]} {s.label}
                  </button>
                ),
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCreateStory && (
            <button
              onClick={openCreate}
              className="h-8 px-3.5 rounded-lg bg-blue-700 text-white text-[12.5px] font-semibold hover:bg-blue-800 transition flex items-center gap-1.5"
            >
              <Icons.Plus /> New Story
            </button>
          )}
        </div>
      </div>

      {/* ── Search + Filters (compact single row) ── */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mb-4">
        <div className="relative flex-1 w-full">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stories by title or description…"
            className="w-full h-9 pl-7 pr-8 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition"
            >
              <Icons.X />
            </button>
          )}
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition w-full sm:w-auto shrink-0"
        >
          <option value="ALL">All Status</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition w-full sm:w-auto shrink-0"
        >
          <option value="ALL">All Priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {(search || filterStatus !== "ALL" || filterPriority !== "ALL") && (
          <button
            onClick={() => {
              setSearch("");
              setFilterStatus("ALL");
              setFilterPriority("ALL");
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition whitespace-nowrap w-full sm:w-auto shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Story list ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-[12px] text-slate-400">Loading stories…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-14 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
            <Icons.Book />
          </div>
          <p className="text-[13px] font-semibold text-slate-700">
            {search || filterStatus !== "ALL" || filterPriority !== "ALL"
              ? "No stories match filters"
              : "No stories yet"}
          </p>
          <p className="text-[12px] text-slate-400 mt-1">
            {canCreateStory
              ? "Create the first story for this sprint"
              : "Stories will appear here once created"}
          </p>
          {canCreateStory && !search && (
            <button
              onClick={openCreate}
              className="mt-4 h-8 px-4 rounded-lg bg-blue-700 text-white text-[12.5px] font-semibold hover:bg-blue-800 transition inline-flex items-center gap-1.5"
            >
              <Icons.Plus /> New Story
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11.5px] text-slate-400">
                {filtered.length} of {counts.total} stories
              </span>
              {counts.pts > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11.5px] font-semibold text-indigo-600">
                    {counts.pts} pts total
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {Object.entries(STATUS_CFG).map(([k, v]) => {
                const cnt = filtered.filter((s) => s.status === k).length;
                if (!cnt) return null;
                return (
                  <div key={k} className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: v.dot }}
                    />
                    <span className="text-[11px] text-slate-500">
                      {cnt} {v.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cards */}
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((story, idx) => {
                const sequence = idx + 1; // starts at 1 for each sprint
                const code = story?.storyId
                  ? String(story.storyId)
                  : `STORY-${sequence}`;
                return (
                  <div
                    key={story._id}
                    className="group bg-white rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10.5px] font-extrabold tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                            {code}
                          </span>
                          <span className="text-[10.5px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                            Seq {sequence}
                          </span>
                        </div>
                        <p className="text-[13px] font-semibold text-slate-800 truncate mt-2">
                          {story.title}
                        </p>

                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                            {story?.createdBy?.name ||
                              story?.createdByName ||
                              (typeof story?.createdBy === "string"
                                ? story.createdBy
                                : "—")}
                          </span>
                          <span className="text-[10.5px] text-slate-400">
                            {story.createdAt
                              ? new Date(story.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )
                              : ""}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                          {story.storyPoints ?? "—"} pts
                        </span>
                      </div>
                    </div>

                    {story.description && (
                      <p className="text-[12px] text-slate-400 line-clamp-2">
                        {story.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={story.status || "To Do"} />
                      <PriorityBadge priority={story.priority} />
                    </div>
                    {canEditStory(story) && (
                      <div className="pt-1">
                        <StatusPill
                          status={story.status || "To Do"}
                          onChange={(v) => handleStatusChange(story._id, v)}
                          disabled={false}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => openView(story)}
                        className="flex-1 h-8 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                      >
                        <Icons.Eye /> View
                      </button>
                      {canEditStory(story) && (
                        <>
                          <button
                            onClick={() => openEdit(story)}
                            className="w-8 h-8 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition flex items-center justify-center"
                            title="Edit"
                          >
                            <Icons.Edit />
                          </button>
                        </>
                      )}
                      {canDeleteStory() && (
                        <button
                          onClick={() => handleDelete(story._id)}
                          disabled={deleting[story._id]}
                          className="w-8 h-8 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition flex items-center justify-center disabled:opacity-40"
                          title="Delete"
                        >
                          {deleting[story._id] ? (
                            <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Icons.Trash />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Create modal ── */}
      <ModalShell
        isOpen={modal === "create"}
        title="New Story"
        subtitle={`Sprint: ${sprint?.name || ""}`}
        onClose={closeModal}
      >
        <StoryForm
          mode="create"
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          onCancel={closeModal}
          onSubmit={handleCreate}
          submitting={submitting}
          canCreateStory={canCreateStory}
        />
      </ModalShell>

      {/* ── Edit modal ── */}
      <ModalShell
        isOpen={modal === "edit"}
        title="Edit Story"
        subtitle={activeStory?.title}
        icon={<Icons.Edit />}
        onClose={closeModal}
      >
        <StoryForm
          mode="edit"
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          onCancel={closeModal}
          onSubmit={handleUpdate}
          submitting={submitting}
          isAdminPm={canManageStory}
        />
      </ModalShell>

      {/* ── View modal ── */}
      <ModalShell
        isOpen={modal === "view"}
        title={activeStory?.title || "Story Details"}
        subtitle="Story detail & comments"
        icon={<Icons.Eye />}
        onClose={closeModal}
      >
        <StoryView
          story={activeStory}
          comments={comments}
          isLoadingComments={loadingComments}
          newComment={newComment}
          setNewComment={setNewComment}
          onPostComment={handlePostComment}
          postingComment={postingComment}
          user={user}
        />
      </ModalShell>
    </div>
  );
}
