import { useState, useEffect } from "react";
import { getTask, addTaskComment } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icons from "./Icons";

// ── SVG Icons ────────────────────────────────────────────────────────────────


// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, variant }) {
  const styles = {
    done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    progress: "bg-blue-50 text-blue-700 border border-blue-200",
    todo: "bg-slate-50 text-slate-600 border border-slate-200",
    qa: "bg-purple-50 text-purple-700 border border-purple-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-green-50 text-green-700 border border-green-200",
    default: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${styles[variant] || styles.default}`}
    >
      {label}
    </span>
  );
}

export default TaskViewModal;

function getPriorityVariant(p) {
  return { High: "high", Medium: "medium", Low: "low" }[p] || "default";
}

function getStatusVariant(s) {
  return (
    {
      DONE: "done",
      IN_PROGRESS: "progress",
      TODO: "todo",
      QA_TESTING: "qa",
    }[s] || "default"
  );
}

// ── Main Modal Component ──────────────────────────────────────────────────────
function TaskViewModal({
  isOpen,
  onClose,
  selectedTask,
  projects = [],
  employees = [],
  comments = [],
  onAddComment,
  newComment,
  onNewCommentChange,
  isLoading,
  getProjectName,
  getAssigneeName,
  getAssigneesPreview,
}) {
  const { user } = useAuth();

  if (!isOpen || !selectedTask) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
   <div className="p-5 border-b border-slate-200">
  <div className="flex items-center justify-between">
    <h3 className="text-xl font-bold text-slate-900">
      Task Details
    </h3>

    <button
      onClick={onClose}
      className="
        inline-flex items-center gap-2
        rounded-lg border border-slate-200
        bg-white px-2 py-1
        text-sm font-semibold text-slate-600
        transition-all duration-200
        hover:bg-slate-100 hover:text-slate-900
        hover:border-slate-300
        active:scale-95
      "
    >
  <Icons.X className="w-4 h-4" />

      Close
    </button>
  </div>
</div>

        {/* CONTENT */}
        <div className="p-6 space-y-8">
          {/* TASK CORE INFO */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Title 
              </label>
              <p className="font-semibold text-slate-900 text-lg break-words">
                {selectedTask.title}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                  {(selectedTask.createdBy?.name || "U").charAt(0).toUpperCase()}
                </span>
                <span>
                  Created by{" "}
                  <span className="font-semibold text-slate-700">
                    {selectedTask.createdBy?.name || "Unknown user"}
                  </span>
                  {selectedTask.createdBy?.role && (
                    <span className="ml-1 text-slate-400">
                      · {selectedTask.createdBy.role.replaceAll("_", " ")}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {selectedTask.description && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Description
                </label>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedTask.description}
                </p>
              </div>
            )}

            {/* GRID INFO */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Project 
                </label>
                <p className="font-medium text-slate-800">
                  {getProjectName
                    ? getProjectName(selectedTask.projectId)
                    : "Unknown Project"}
                </p>
              </div>

              {/* ASSIGNEES */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Assignees ({selectedTask.assignees?.length || 0})
                </label>

                {!selectedTask.assignees ||
                selectedTask.assignees.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No assignees</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(selectedTask.assignees || [])
                      .slice(0, 11)
                      .map((assignee, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-xs font-medium text-slate-800 rounded-full border border-slate-200"
                        >
                          <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {getAssigneeName
                              ? getAssigneeName(assignee)
                                  ?.charAt(0)
                                  ?.toUpperCase() || "U"
                              : "U"}
                          </div>
                          <span className="truncate max-w-[100px]">
                            {getAssigneeName
                              ? getAssigneeName(assignee)
                              : "User"}
                          </span>
                        </div>
                      ))}

                    {selectedTask.assignees?.length > 11 && (
                      <span className="px-3 py-1.5 text-xs text-slate-600 bg-slate-50 rounded-full border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                        +{selectedTask.assignees.length - 11} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Priority
                </label>
                <Badge
                  label={selectedTask.priority}
                  variant={getPriorityVariant(selectedTask.priority)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Status
                </label>
                <Badge
                  label={selectedTask.status?.replace("_", " ") || "TODO"}
                  variant={getStatusVariant(selectedTask.status)}
                />
              </div>

           

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Created
                </label>
                <p className="font-mono text-sm text-slate-800">
                  {new Date(selectedTask.createdAt).toLocaleDateString()}
                </p>
              </div>
                 <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Due Date
                </label>
                <p className="font-mono text-sm text-slate-800">
                  {selectedTask.dueDate
                    ? new Date(selectedTask.dueDate).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* COMMENTS */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Comments ({comments.length})
              </label>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-sm text-slate-500">
                  Loading comments...
                </span>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment._id}
                        className="bg-slate-50 p-3 rounded-lg hover:bg-slate-100 transition"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                            {comment.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-slate-900 truncate">
                                {comment.user.name}
                              </span>
                              <Badge
                                label={
                                  comment.user.role?.replace("_", " ") || "User"
                                }
                                variant="default"
                              />
                            </div>
                            <p className="text-xs text-slate-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-800 ml-10 leading-snug">
                          {comment.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* ADD COMMENT */}
                <div className="border-t border-slate-200 pt-4 mt-2">
                  <div className="flex gap-2">
                    <input
                      className="border border-slate-300 bg-white px-3 py-2 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 flex-1 transition"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => onNewCommentChange(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={onAddComment}
                      disabled={!newComment?.trim() || isLoading}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap flex-shrink-0"
                    >
                      {isLoading ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                      ) : (
                        "Post"
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
