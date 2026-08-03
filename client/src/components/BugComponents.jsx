import React from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "./Icons.jsx";
import { SEVERITY, STATUS_STYLES, inputCls } from "./bugConstants.js";

const STATUS_LABELS = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  WONT_FIX: "Won't Fix",
};

// ── Field wrapper ─────────────────────────────────────────────────────────────
export function Field({ label, required = false, children }) {
  return (
    <div>
      <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Bug icon ──────────────────────────────────────────────────────────────────
export function BugIcon({ className = "" }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2l1.88 1.88" />
      <path d="M14.12 3.88L16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  );
}

// ── Chevron down ──────────────────────────────────────────────────────────────
export function ChevronDownIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Status select ─────────────────────────────────────────────────────────────
export function StatusSelect({ value, onChange }) {
  return (
    <div className="relative inline-block">
      <select
        value={value || "OPEN"}
        onChange={(e) => onChange(e.target.value)}
        className={`text-[10.5px] font-bold border rounded-full pl-2.5 pr-6 py-1 cursor-pointer focus:outline-none appearance-none ${STATUS_STYLES[value] || STATUS_STYLES.OPEN}`}
      >
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="RESOLVED">Resolved</option>
        <option value="WONT_FIX">Won't Fix</option>
      </select>
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
        <ChevronDownIcon />
      </div>
    </div>
  );
}

// ── Mini detail tile ──────────────────────────────────────────────────────────
function DetailTile({ label, children }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg px-3.5 py-3">
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </p>
      <div className="text-[12.5px] font-semibold text-slate-800">
        {children}
      </div>
    </div>
  );
}

// ── Severity select (color-coded) ─────────────────────────────────────────────
function SeveritySelect({ value, onChange, disabled }) {
  const cfg = {
    CRITICAL: "border-red-200 bg-red-50 text-red-700",
    HIGH: "border-orange-200 bg-orange-50 text-orange-700",
    MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
    LOW: "border-green-200 bg-green-50 text-green-700",
  };
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-9 px-3 rounded-lg border text-[12.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 transition ${cfg[value] || "border-slate-200 bg-white text-slate-700"}`}
    >
      <option value="LOW">Low</option>
      <option value="MEDIUM">Medium</option>
      <option value="HIGH">High</option>
      <option value="CRITICAL">Critical</option>
    </select>
  );
}

function StatusSelectColored({ value, onChange, disabled }) {
  const cfg = {
    OPEN: "border-red-200 bg-red-50 text-red-700",
    IN_PROGRESS: "border-blue-200 bg-blue-50 text-blue-700",
    RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    WONT_FIX: "border-slate-200 bg-slate-100 text-slate-600",
  };
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-9 px-3 rounded-lg border text-[12.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 transition ${cfg[value] || "border-slate-200 bg-white text-slate-700"}`}
    >
      <option value="OPEN">Open</option>
      <option value="IN_PROGRESS">In Progress</option>
      <option value="RESOLVED">Resolved</option>
      <option value="WONT_FIX">Won't Fix</option>
    </select>
  );
}

// ── Bug Detail Modal ──────────────────────────────────────────────────────────
export function BugDetailModal({
  bug,
  isOpen,
  onClose,
  onDelete,
  canDelete,
  canEdit = false,
  onUpdateBug,
}) {
  const [draft, setDraft] = React.useState({
    title: "",
    description: "",
    severity: "MEDIUM",
    status: "OPEN",
  });
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("details");

  React.useEffect(() => {
    if (!bug) return;
    setDraft({
      title: bug.title || "",
      description: bug.description || "",
      severity: bug.severity || "MEDIUM",
      status: bug.status || "OPEN",
    });
    setActiveTab("details");
  }, [bug]);

  const handleSave = async () => {
    if (!canEdit || !bug?._id) return;
    setSaving(true);
    try {
      const res = await API.put(`/bugs/${bug._id}`, draft);
      const updated = res.data?.data || res.data;
      if (onUpdateBug) onUpdateBug(updated);
      toast.success("Bug updated successfully");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update bug");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    toast.custom((t) => (
      <div className="w-[340px] rounded-xl border border-slate-200 bg-white shadow-2xl p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-bold text-slate-900 mb-0.5">
              Delete Bug?
            </h3>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              You're about to delete{" "}
              <span className="font-semibold text-slate-700">
                "{bug.title}"
              </span>
              . This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => toast.dismiss(t)}
            className="h-8 px-3.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              toast.dismiss(t);
              onDelete(bug._id);
            }}
            className="h-8 px-3.5 rounded-lg bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 transition"
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  if (!isOpen || !bug) return null;

  const sev = SEVERITY[bug.severity] || SEVERITY.MEDIUM;
  const statusStyle = STATUS_STYLES[bug.status] || STATUS_STYLES.OPEN;
  const project =
    typeof bug.taskId?.projectId === "object"
      ? bug.taskId?.projectId?.name
      : bug.taskId?.project?.name || "N/A";
  const hasAttachments =
    Array.isArray(bug.attachments) && bug.attachments.length > 0;

  const tabs = [
    { key: "details", label: "Details" },
    {
      key: "attachments",
      label: `Attachments${hasAttachments ? ` (${bug.attachments.length})` : ""}`,
    },
    ...(canEdit ? [{ key: "edit", label: "Edit" }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh]">
        {/* Severity color strip */}
        <div className={`h-1 w-full ${sev.bar} shrink-0`} />

        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${sev.badge}`}
                >
                  {sev.label}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${statusStyle}`}
                >
                  {STATUS_LABELS[bug.status] || bug.status}
                </span>
              </div>
              <h2 className="text-[15px] font-bold text-slate-900 leading-snug">
                {bug.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition shrink-0"
            >
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 overflow-x-auto border-b border-slate-100 px-4 pb-0 pt-3 sm:px-6">
          <div className="flex min-w-max gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-t-lg transition-all border-b-2 ${
                  activeTab === t.key
                    ? "text-slate-900 border-slate-900"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── DETAILS TAB ── */}
          {activeTab === "details" && (
            <div className="space-y-5 p-4 sm:p-6">
              {/* Description */}
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Description
                </p>
                {bug.description ? (
                  <p className="text-[13px] text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
                    {bug.description}
                  </p>
                ) : (
                  <p className="text-[12.5px] italic text-slate-300 bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
                    No description provided
                  </p>
                )}
              </div>

              {/* Detail grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailTile label="Reporter">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                      {bug.reportedBy?.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <span className="truncate">
                      {bug.reportedBy?.name || "Unknown"}
                    </span>
                  </div>
                </DetailTile>

                <DetailTile label="Reported On">
                  {bug.createdAt
                    ? new Date(bug.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </DetailTile>

                <DetailTile label="Related Task">
                  <span className="truncate block">
                    {bug.taskId?.title || "N/A"}
                  </span>
                </DetailTile>

                <DetailTile label="Project">
                  <span className="truncate block">{project}</span>
                </DetailTile>

                <DetailTile label="Severity">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${sev.badge}`}
                  >
                    {sev.label}
                  </span>
                </DetailTile>

                <DetailTile label="Status">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${statusStyle}`}
                  >
                    {STATUS_LABELS[bug.status] || bug.status}
                  </span>
                </DetailTile>
              </div>

              {/* Bug ID */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-400">Bug ID:</span>
                <code className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded select-all">
                  {bug._id}
                </code>
              </div>
            </div>
          )}

          {/* ── ATTACHMENTS TAB ── */}
          {activeTab === "attachments" && (
            <div className="p-4 sm:p-6">
              {hasAttachments ? (
                <div className="space-y-2.5">
                  {bug.attachments.map((att, idx) => {
                    const href = att?.url;
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 hover:border-slate-300 transition"
                      >
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-slate-800 truncate">
                            {att?.fileName || `Attachment ${idx + 1}`}
                          </p>
                          <p className="text-[10.5px] text-slate-400">
                            {att?.fileSize
                              ? `${Math.round(att.fileSize / 1024)} KB`
                              : "Unknown size"}
                          </p>
                        </div>
                        {href ? (
                          <a
                            href={href}
                            download={att?.fileName || undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="h-7 px-3 rounded-lg border border-slate-200 bg-white text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition flex items-center gap-1.5 shrink-0"
                          >
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
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            No file
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
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
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-semibold text-slate-600">
                    No attachments
                  </p>
                  <p className="text-[12px] text-slate-400">
                    No files were attached to this bug report
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── EDIT TAB ── */}
          {activeTab === "edit" && canEdit && (
            <div className="space-y-4 p-4 sm:p-6">
              <div>
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Title
                </label>
                <input
                  value={draft.title}
                  maxLength={200}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Bug title"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={draft.description}
                  rows={4}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Describe the bug..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Severity
                  </label>
                  <SeveritySelect
                    value={draft.severity}
                    onChange={(v) => setDraft((p) => ({ ...p, severity: v }))}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <StatusSelectColored
                    value={draft.status}
                    onChange={(v) => setDraft((p) => ({ ...p, status: v }))}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setDraft({
                      title: bug.title || "",
                      description: bug.description || "",
                      severity: bug.severity || "MEDIUM",
                      status: bug.status || "OPEN",
                    });
                  }}
                  disabled={saving}
                  className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="h-9 px-5 rounded-lg bg-indigo-600 text-white text-[12.5px] font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-r-white rounded-full animate-spin" />
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-[10px] font-mono text-slate-400 truncate"></span>
          <div className="flex items-center gap-2">
            {canDelete && (
              <button
                onClick={handleDelete}
                className="h-8 px-3 rounded-lg border border-red-200 bg-red-50 text-[12px] font-semibold text-red-600 hover:bg-red-100 transition flex items-center gap-1.5"
              >
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
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="h-8 px-4 rounded-lg bg-indigo-600 text-white text-[12px] font-semibold hover:bg-indigo-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
