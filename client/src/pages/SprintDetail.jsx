import { useState, useEffect } from "react";
import {
  API,
  getSprintComments,
  addSprintComment,
  getStoriesBySprint,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icons from "../components/Icons";
import StoriesTab from "../components/Stories/StoriesTab";

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, variant }) {
  const styles = {
    active: "bg-blue-50 text-blue-700 border border-blue-200",
    planning: "bg-amber-50 text-amber-700 border border-amber-200",
    completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    default: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${styles[variant] || styles.default}`}
    >
      {label}
    </span>
  );
}

function Field({ label, required = false, error, children }) {
  return (
    <div>
      {label && (
        <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          {label}{required && <span className="ml-1 text-sm font-bold leading-none text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
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
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, iconColor, iconBg, icon }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
            {label}
          </p>

          <p className="text-[18px] font-bold text-slate-900 leading-none mt-1">
            {value}
          </p>

          {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
        </div>

        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SprintDetail({
  initialSprint,
  onBack,
  projects,
  onSprintUpdated,
}) {
  const { user, hasRole } = useAuth();
  const [sprint, setSprint] = useState(initialSprint);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [storiesCount, setStoriesCount] = useState(0);

  const [form, setForm] = useState({
    name: initialSprint?.name || "",
    startDate: initialSprint?.startDate?.split("T")[0] || "",
    endDate: initialSprint?.endDate?.split("T")[0] || "",
    goal: initialSprint?.goal || "",
    status: initialSprint?.status || "Planning",
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Sprint name is required";
    if (!form.startDate) e.startDate = "Start date is required";
    if (!form.endDate) e.endDate = "End date is required";
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (start >= end) e.endDate = "End date must be after start date";
    if (project?.startDate && start < new Date(project.startDate))
      e.startDate = `Cannot be before project start (${new Date(project.startDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })})`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const updateSprint = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await API.put(`/sprints/${sprint._id}`, form);
      setSprint(res.data);
      setIsEditing(false);
      setSuccessMsg("Sprint updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrors({
        submit: err.response?.data?.message || "Failed to update sprint",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSprint = async () => {
    setSubmitting(true);
    try {
      await API.delete(`/sprints/${sprint._id}`);
      setSuccessMsg("Sprint deleted!");
      setTimeout(() => onSprintUpdated(), 1500);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete sprint");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchComments = async () => {
      if (!sprint?._id) return;
      try {
        setCommentsLoading(true);
        const res = await getSprintComments(sprint._id);
        setComments(res.data.data || res.data.comments || []);
      } catch (err) {
        console.error("Failed to load comments:", err);
      } finally {
        setCommentsLoading(false);
      }
    };
    fetchComments();
  }, [sprint?._id]);

  useEffect(() => {
    const fetchStoriesCount = async () => {
      if (!sprint?._id) return;
      try {
        const res = await getStoriesBySprint(sprint._id);
        const list = res?.data?.data || res?.data || [];
        setStoriesCount(Array.isArray(list) ? list.length : 0);
      } catch (err) {
        console.error("Failed to load stories count:", err);
        setStoriesCount(0);
      }
    };

    fetchStoriesCount();
  }, [sprint?._id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !sprint?._id) return;
    try {
      setCommentLoading(true);
      const res = await addSprintComment(sprint._id, newComment.trim());
      setComments(res.data.data || res.data.comments || []);
      setNewComment("");
    } catch {
      alert("Failed to post comment.");
    } finally {
      setCommentLoading(false);
    }
  };

  const canEdit = hasRole(["ADMIN", "PM"]);
  if (!sprint) return null;

  const project = projects.find((p) => p._id === sprint.projectId?._id);
  const startDate = new Date(sprint.startDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const endDate = new Date(sprint.endDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const endDateTime = new Date(sprint.endDate);
  const startDateTime = new Date(sprint.startDate);
  const now = new Date();
  const totalDays = Math.ceil(
    (endDateTime - startDateTime) / (1000 * 60 * 60 * 24),
  );
  const elapsed = Math.ceil((now - startDateTime) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.ceil((endDateTime - now) / (1000 * 60 * 60 * 24));
  const progress = Math.min(
    100,
    Math.max(0, Math.round((elapsed / totalDays) * 100)),
  );
  const isOverdue = daysLeft < 0 && sprint.status !== "Completed";
  const isDone = sprint.status === "Completed";

  const statusDot =
    {
      Active: "#3b82f6",
      Planning: "#f59e0b",
      Completed: "#10b981",
    }[sprint.status] || "#94a3b8";

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "stories", label: `Stories ` },
    { key: "comments", label: `Comments (${comments.length})` },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-2 space-y-2">
      {/* ── Top nav bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>

          <span>Back</span>
        </button>

        {canEdit && !isEditing && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setIsEditing(true);
                setErrors({});
              }}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
            >
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
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="h-8 px-3 rounded-lg border border-red-200 bg-red-50 text-[12.5px] font-semibold text-red-600 hover:bg-red-100 transition flex items-center gap-1.5"
            >
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
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              Delete
            </button>
          </div>
        )}
        {isEditing && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setForm({
                  name: sprint.name,
                  startDate: sprint.startDate.split("T")[0],
                  endDate: sprint.endDate.split("T")[0],
                  goal: sprint.goal,
                  status: sprint.status,
                });
                setErrors({});
              }}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={updateSprint}
              disabled={submitting}
              className="h-8 px-4 rounded-lg bg-indigo-600 text-white text-[12.5px] font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-r-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
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
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Success banner ── */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg text-[12.5px] font-medium">
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* ── Hero card ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Colored top strip */}
        <div className="h-1.5 w-full" style={{ backgroundColor: statusDot }} />

        <div className="px-5 py-2">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Field label="Sprint Name" required error={errors.name}>
                  <input
                    type="text"
                    value={form.name}
                    autoFocus
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Sprint name"
                    className={`${inputCls} text-[15px] font-bold`}
                  />
                </Field>
              ) : (
                <h1 className="text-[18px] font-bold text-slate-900 truncate">
                  {sprint.name}
                </h1>
              )}
              {project && !isEditing && (
                <div className="flex items-center gap-1.5 mt-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-[12px] text-slate-400">
                    {project.name}
                  </span>
                </div>
              )}
            </div>

            {/* Status selector */}
            <div className="shrink-0 flex items-center">
              {isEditing ? (
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="h-8 min-w-[110px] px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                >
                  <option value="Planning"> Planning</option>
                  <option value="Active">Active</option>
                  <option value="Completed"> Completed</option>
                </select>
              ) : (
                <select
                  value={sprint.status}
                  disabled={submitting || !canEdit}
                  onChange={async (e) => {
                    if (!canEdit) return;

                    try {
                      setSubmitting(true);

                      const res = await API.put(`/sprints/${sprint._id}`, {
                        status: e.target.value,
                      });

                      setSprint(res.data);

                      setSuccessMsg("Status updated!");
                      setTimeout(() => setSuccessMsg(""), 2000);
                    } catch (err) {
                      alert(
                        err?.response?.data?.message ||
                          "Failed to update sprint status",
                      );
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className={`h-8 min-w-[110px] px-2.5 rounded-lg border text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 transition ${
                    canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                  } ${
                    sprint.status === "Active"
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : sprint.status === "Completed"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}
                >
                  <option value="Planning"> Planning</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              )}
            </div>
          </div>

          {/* Progress */}
          {!isEditing && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Progress
                  </span>

                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isDone
                        ? "bg-emerald-50 text-emerald-600"
                        : isOverdue
                          ? "bg-red-50 text-red-600"
                          : daysLeft <= 7
                            ? "bg-amber-50 text-amber-600"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isDone
                      ? "Completed"
                      : isOverdue
                        ? `${Math.abs(daysLeft)}d overdue`
                        : `${daysLeft}d left`}
                  </span>
                </div>

                <span className="text-[11px] font-bold text-slate-700">
                  {isDone ? "100" : progress}%
                </span>
              </div>

              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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

              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-400">{startDate}</span>
                <span className="text-[10px] text-slate-400">{endDate}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      {!isEditing && (
        <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-5 gap-2">
          <StatCard
            label="Duration"
            value={`${totalDays}d`}
            sub="total days"
            iconBg="bg-slate-100"
            iconColor="text-slate-500"
            icon={
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
            }
          />
          <StatCard
            label="Elapsed"
            value={`${Math.max(0, elapsed)}d`}
            sub={`${progress}% done`}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            icon={
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
            }
          />
          <StatCard
            label="Remaining"
            value={isDone ? "Done" : isOverdue ? "OD" : `${daysLeft}d`}
            sub={
              isDone
                ? "sprint finished"
                : isOverdue
                  ? `${Math.abs(daysLeft)}d over`
                  : "days left"
            }
            iconBg={
              isDone
                ? "bg-emerald-50"
                : isOverdue
                  ? "bg-red-50"
                  : daysLeft <= 7
                    ? "bg-amber-50"
                    : "bg-slate-100"
            }
            iconColor={
              isDone
                ? "text-emerald-500"
                : isOverdue
                  ? "text-red-500"
                  : daysLeft <= 7
                    ? "text-amber-500"
                    : "text-slate-500"
            }
            icon={
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
            }
          />
          <StatCard
            label="Stories"
            value={storiesCount}
            sub="total stories"
            iconBg="bg-indigo-50"
            iconColor="text-indigo-500"
            icon={
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
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="8" y1="8" x2="16" y2="8" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="8" y1="16" x2="13" y2="16" />
              </svg>
            }
          />
          <StatCard
            label="Comments"
            value={comments.length}
            sub="total notes"
            iconBg="bg-violet-50"
            iconColor="text-violet-500"
            icon={
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
          />
        </div>
      )}

      {/* ── Tabs ── */}
      {!isEditing && (
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-fit overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-[12.5px] font-semibold transition-all ${
                activeTab === t.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span>{t.label}</span>

                {t.key === "stories" && (
                  <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-[1px] rounded-full leading-none">
                    NEW
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {/* ── Main panel ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* OVERVIEW TAB */}
        {(activeTab === "overview" || isEditing) && (
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Goal Card */}
              <div className="lg:col-span-2 bg-slate-50 border border-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[13px] font-bold text-slate-800">
                    Sprint Goal
                  </h3>
                </div>

                {isEditing ? (
                  <Field error={errors.goal}>
                    <textarea
                      rows="4"
                      value={form.goal}
                      onChange={(e) =>
                        setForm({ ...form, goal: e.target.value })
                      }
                      placeholder="What should this sprint achieve?"
                      className={`${inputCls} resize-none`}
                    />
                  </Field>
                ) : (
                  <p className="text-[13px] text-slate-700 leading-relaxed">
                    {sprint.goal || (
                      <span className="italic text-slate-400">
                        No goal defined for this sprint.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Timeline Card */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[13px] font-bold text-slate-800">
                    Timeline
                  </h3>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <Field label="Start Date" required error={errors.startDate}>
                      <input
                        type="date"
                        value={form.startDate}
                        min={
                          project?.startDate
                            ? project.startDate.split("T")[0]
                            : ""
                        }
                        onChange={(e) =>
                          setForm({
                            ...form,
                            startDate: e.target.value,
                          })
                        }
                        className={inputCls}
                      />
                    </Field>

                    <Field label="End Date" required error={errors.endDate}>
                      <input
                        type="date"
                        value={form.endDate}
                        min={form.startDate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            endDate: e.target.value,
                          })
                        }
                        className={inputCls}
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">
                        Start
                      </p>
                      <p className="text-[13px] font-semibold text-slate-800">
                        {startDate}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">
                        End
                      </p>
                      <p className="text-[13px] font-semibold text-slate-800">
                        {endDate}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">
                        Duration
                      </p>
                      <p className="text-[13px] font-semibold text-slate-800">
                        {totalDays} Days
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Details Card */}
              {!isEditing && (
                <div className="lg:col-span-3 bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-[13px] font-bold text-slate-800">
                      Sprint Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">
                        Created By
                      </p>

                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {sprint.createdBy?.name?.charAt(0)?.toUpperCase() ||
                            "U"}
                        </div>

                        <span className="text-[13px] font-semibold text-slate-800">
                          {sprint.createdBy?.name || "Unknown"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">
                        Created On
                      </p>

                      <p className="text-[13px] font-semibold text-slate-800">
                        {new Date(sprint.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">
                        Project
                      </p>

                      <p className="text-[13px] font-semibold text-slate-800">
                        {project?.name || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isEditing && errors.submit && (
                <div className="lg:col-span-3">
                  <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-3 py-2 text-[12px] font-medium">
                    {errors.submit}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STORIES TAB */}
        {activeTab === "stories" && !isEditing && (
          <div className="px-5 py-4">
            <StoriesTab sprint={sprint} />
          </div>
        )}

        {/* COMMENTS TAB */}
        {activeTab === "comments" && !isEditing && (
          <div className="flex flex-col h-[480px]">
            {/* Comment list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {commentsLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-slate-400">
                    Loading comments...
                  </span>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-600">
                    No comments yet
                  </p>
                  <p className="text-[12px] text-slate-400">
                    Be the first to leave a note
                  </p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment._id} className="flex gap-3 group">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                      {comment.user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12.5px] font-bold text-slate-900">
                          {comment.user?.name || "Anonymous"}
                        </span>
                        {comment.user?.roles?.tracker && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] font-semibold text-slate-500 rounded-full">
                            {comment.user.roles.tracker.replace("_", " ")}
                          </span>
                        )}
                        <span className="text-[10.5px] text-slate-400 ml-auto">
                          {comment.createdAt || comment.date
                            ? new Date(
                                comment.createdAt || comment.date,
                              ).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Just now"}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl rounded-tl-sm px-3 py-2.5">
                        <p className="text-[13px] text-slate-700 leading-relaxed">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment input */}
            <div className="border-t border-slate-100 px-5 py-3.5 bg-slate-50">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <input
                  className="flex-1 h-9 border border-slate-200 bg-white px-3 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
                  placeholder="Write a comment… (Enter to post)"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  disabled={commentLoading}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || commentLoading}
                  className="h-9 px-3.5 bg-indigo-600 text-white rounded-lg text-[12.5px] font-semibold hover:bg-indigo-700 transition disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  {commentLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-r-white rounded-full animate-spin" />
                  ) : (
                    <>
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
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      Post
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete confirm modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="p-5">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </div>
              <h3 className="text-[15px] font-bold text-slate-900 text-center mb-1">
                Delete Sprint?
              </h3>
              <p className="text-[12.5px] text-slate-500 text-center leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-700">
                  "{sprint.name}"
                </span>
                ? This cannot be undone.
              </p>
            </div>
            <div className="px-5 pb-5 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-9 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={deleteSprint}
                disabled={submitting}
                className="flex-1 h-9 rounded-lg bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Delete Sprint"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
