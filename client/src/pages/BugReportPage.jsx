import React, { useMemo, useState, useEffect } from "react";
import { fileToBlobPayload } from "../utils/fileToBlobPayload.js";
import { toast } from "sonner";
import { API, DATA_MUTATED_EVENT } from "../services/api";
import Icons from "../components/Icons";
import { BugDetailModal } from "../components/BugComponents";

import { useAuth } from "../context/AuthContext";

function formatDateTime(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCSV(val) {
  const s = val === null || val === undefined ? "" : String(val);
  const needsQuotes = /[",\n]/.test(s);
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
}

function computeCounts(bugs = []) {
  const byStatus = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, WONT_FIX: 0 };
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  bugs.forEach((b) => {
    const st = b?.status || "OPEN";
    const sev = b?.severity || "MEDIUM";
    if (byStatus[st] !== undefined) byStatus[st] += 1;
    if (bySeverity[sev] !== undefined) bySeverity[sev] += 1;
  });
  return {
    total: bugs.length,
    ...byStatus,
    open: byStatus.OPEN,
    inProgress: byStatus.IN_PROGRESS,
    resolved: byStatus.RESOLVED,
    wontFix: byStatus.WONT_FIX,
    ...bySeverity,
    critical: bySeverity.CRITICAL,
    high: bySeverity.HIGH,
    medium: bySeverity.MEDIUM,
    low: bySeverity.LOW,
  };
}

function getProjectNameFromBug(bug) {
  // task.projectId populated
  if (bug?.taskId?.projectId && typeof bug.taskId.projectId === "object") {
    return bug.taskId.projectId.name || bug.taskId.projectId.title || "N/A";
  }

  // task.project populated
  if (bug?.taskId?.project && typeof bug.taskId.project === "object") {
    return bug.taskId.project.name || bug.taskId.project.title || "N/A";
  }

  // direct projectId populated
  if (bug?.projectId && typeof bug.projectId === "object") {
    return bug.projectId.name || bug.projectId.title || "N/A";
  }

  return "N/A";
}

// ── Severity chip ─────────────────────────────────────────────────────────────
function getReporterId(bug) {
  return typeof bug?.reportedBy === "object"
    ? bug?.reportedBy?._id
    : bug?.reportedBy;
}

function canEditBugForRole(role, userId, bug) {
  if (role === "ADMIN" || role === "PM") return true;
  if (role === "QA") {
    return String(getReporterId(bug) || "") === String(userId || "");
  }
  return false;
}

function canDeleteBugForRole(role) {
  return role === "ADMIN" || role === "PM";
}

function getRolePolicyText(role) {
  if (role === "ADMIN") return "Admin: all reports, view, edit, delete";
  if (role === "PM") {
    return "PM: assigned/created project reports, view, edit, delete";
  }
  if (role === "QA") return "QA: own reports only, view and edit";
  return "Role access is limited to reports returned for your account";
}

function SeverityChip({ sev }) {
  const cfg = {
    CRITICAL: "bg-red-50 text-red-700 border border-red-200",
    HIGH: "bg-orange-50 text-orange-700 border border-orange-200",
    MEDIUM: "bg-amber-50 text-amber-700 border border-amber-200",
    LOW: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${cfg[sev] || cfg.LOW}`}
    >
      {sev}
    </span>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const cfg = {
    OPEN: "bg-red-50 text-red-700 border border-red-200",
    IN_PROGRESS: "bg-blue-50 text-blue-700 border border-blue-200",
    RESOLVED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    WONT_FIX: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  const label = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    WONT_FIX: "Won't Fix",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${cfg[status] || cfg.OPEN}`}
    >
      {label[status] || status}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  iconBg,
  iconColor,
  icon,
  onClick,
  active,
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-2   cursor-pointer  ${
        active
          ? "bg-white border-blue-600 ring-1 ring-blue-600"
          : "bg-white border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between mb-2.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center ${iconBg} ${iconColor}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-[26px] font-bold leading-none text-slate-800">
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BugReportPage({ searchRequest }) {
  const { user } = useAuth();
  const role = user?.role;

  const canReportBug = role === "QA" || role === "PM";
  const rolePolicyText = getRolePolicyText(role);

  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutationVersion, setMutationVersion] = useState(0);

  const [bugSearch, setBugSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  useEffect(() => {
    if (searchRequest?.type !== "bug") return;
    setBugSearch(searchRequest.query || "");
    setProjectSearch("");
    setFilterSeverity("ALL");
    setFilterStatus("ALL");
    setSelectedBug(null);
    setShowBugModal(false);
  }, [searchRequest]);

  const [selectedBug, setSelectedBug] = useState(null);
  const [showBugModal, setShowBugModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [tasks, setTasks] = useState([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [newBug, setNewBug] = useState({
    title: "",
    description: "",
    severity: "MEDIUM",
    status: "OPEN",
    taskId: "",
    attachments: [],
  });

  const selectedCanEdit = useMemo(
    () => canEditBugForRole(role, user?._id, selectedBug),
    [role, selectedBug, user?._id],
  );

  const selectedCanDelete = useMemo(() => canDeleteBugForRole(role), [role]);

  useEffect(() => {
    const handleDataMutation = () =>
      setMutationVersion((version) => version + 1);

    window.addEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    return () =>
      window.removeEventListener(DATA_MUTATED_EVENT, handleDataMutation);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await API.get("/bugs");
        const data =
          res?.data?.data ||
          res?.data?.bugs ||
          (Array.isArray(res?.data) ? res.data : []);
        if (!cancelled) setBugs(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setError("Failed to load bug reports");
          setBugs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mutationVersion]);

  useEffect(() => {
    if (!canReportBug) return;
    let cancelled = false;
    async function loadTasks() {
      setTaskLoading(true);
      try {
        const res = await API.get("/tasks/qa");
        const data =
          res?.data?.data || (Array.isArray(res?.data) ? res.data : []);
        if (!cancelled)
          setTasks(
            Array.isArray(data)
              ? data.map((t) => ({ ...t, status: String(t.status || "") }))
              : [],
          );
      } catch (e) {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setTaskLoading(false);
      }
    }
    loadTasks();
    return () => {
      cancelled = true;
    };
  }, [canReportBug, mutationVersion]);

  const counts = useMemo(() => computeCounts(bugs), [bugs]);

  const filteredBugs = useMemo(() => {
    const q = bugSearch.trim().toLowerCase();
    const pq = projectSearch.trim().toLowerCase();
    return (bugs || [])
      .filter((b) => {
        const title = (b?.title || "").toLowerCase();
        const project = (getProjectNameFromBug(b) || "").toLowerCase();
        return (
          (!q || title.includes(q)) &&
          (!pq || project.includes(pq)) &&
          (filterSeverity === "ALL" ||
            (b?.severity || "MEDIUM") === filterSeverity) &&
          (filterStatus === "ALL" || (b?.status || "OPEN") === filterStatus)
        );
      })
      .slice(0, 50);
  }, [bugs, bugSearch, projectSearch, filterSeverity, filterStatus]);

  const handleRefresh = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/bugs");
      const data =
        res?.data?.data ||
        res?.data?.bugs ||
        (Array.isArray(res?.data) ? res.data : []);
      setBugs(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Failed to refresh");
    } finally {
      setLoading(false);
    }
  };

  const handleViewBug = (bug) => {
    // Ensure view modal receives fully populated bug fields.
    // Some list responses may miss nested project details; BugDetailModal should still render safely.
    setSelectedBug(bug);
    setShowBugModal(true);
  };

  const handleCloseBugModal = () => {
    setShowBugModal(false);
    setSelectedBug(null);
  };

  const handleDeleteBug = async (bugId) => {
    try {
      try {
        const { deleteBug } = await import("../services/api");
        if (typeof deleteBug === "function") {
          await deleteBug(bugId);
        } else {
          await API.delete(`/bugs/${bugId}`);
        }
      } catch {
        await API.delete(`/bugs/${bugId}`);
      }
      setBugs((prev) => prev.filter((b) => b._id !== bugId));
      toast.success("Bug deleted");
      handleCloseBugModal();
    } catch (e) {
      toast.error("Failed to delete bug");
    }
  };

  const handleUpdateStatus = async (bugId, newStatus) => {
    try {
      const res = await API.put(`/bugs/${bugId}`, { status: newStatus });
      const updated = res?.data?.data || res?.data;
      setBugs((prev) =>
        prev.map((b) =>
          b._id === bugId ? { ...b, ...(updated || {}), status: newStatus } : b,
        ),
      );
      setSelectedBug((prev) =>
        prev?._id === bugId
          ? { ...prev, ...(updated || {}), status: newStatus }
          : prev,
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update status");
    }
  };

  const handleBugUpdated = (updatedBug) => {
    if (!updatedBug?._id) return;
    setBugs((prev) =>
      prev.map((bug) => (bug._id === updatedBug._id ? updatedBug : bug)),
    );
    setSelectedBug(updatedBug);
  };

  const doExportCSV = () => {
    const header = [
      "Bug ID",
      "Title",
      "Reporter",
      "Project",
      "Severity",
      "Status",
      "Related Task",
      "Created At",
      "Description",
    ];
    const csv = [
      header.map(escapeCSV).join(","),
      ...filteredBugs.map((b) =>
        [
          b?._id,
          b?.title,
          b?.reportedBy?.name || "Unknown",
          getProjectNameFromBug(b),
          b?.severity,
          b?.status,
          b?.taskId?.title || "N/A",
          formatDateTime(b?.createdAt),
          b?.description || "",
        ]
          .map(escapeCSV)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bug_reports_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleReportBug = async (e) => {
    e.preventDefault();

    const title = newBug.title.trim();
    if (!title || !newBug.taskId) {
      setFormError("Bug title and related task are required");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const attachments = await Promise.all(
        newBug.attachments.map(fileToBlobPayload),
      );
      const res = await API.post("/bugs", {
        title,
        description: newBug.description,
        severity: newBug.severity,
        status: newBug.status,
        taskId: newBug.taskId,
        attachments,
      });
      const created = res?.data?.data || res?.data;
      setBugs((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
      setNewBug({
        title: "",
        description: "",
        severity: "MEDIUM",
        status: "OPEN",
        taskId: "",
        attachments: [],
      });
      setShowForm(false);
      toast.success("Bug reported successfully");
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to report bug");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        (t?.title || "").toLowerCase().includes(q) ||
        (t?.status || "").toLowerCase().includes(q),
    );
  }, [tasks, taskSearch]);

  const hasFilters =
    filterSeverity !== "ALL" ||
    filterStatus !== "ALL" ||
    bugSearch ||
    projectSearch;

  return (
    <div className="w-full space-y-2">
      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-1 text-[12.5px] text-red-700">
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
          <span className="font-medium flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600 transition"
          >
            <Icons.X />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">Bug Reports </h2>
          <p className="text-[11.5px] text-slate-400 mt-0.5">
            {counts.total} total bugs · {filteredBugs.length} shown
          </p>
          <p className="text-[11.5px] text-slate-500 mt-1">{rolePolicyText}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={doExportCSV}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <Icons.Download /> Export CSV
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
            title="Refresh"
          >
            <Icons.Refresh spin={loading} />
          </button>
          {canReportBug && (
            <button
              onClick={() => {
                setShowForm((v) => !v);
                setFormError("");
              }}
              className="h-8 px-3.5 rounded-lg bg-blue-700 text-white text-[12.5px] font-semibold hover:bg-blue-800 transition flex items-center gap-1.5"
            >
              <Icons.Plus /> Report Bug
            </button>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total"
          value={counts.total}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-500"
          icon={<Icons.Bug />}
          onClick={() => setFilterStatus("ALL")}
          active={filterStatus === "ALL"}
        />
        <StatCard
          label="Open"
          value={counts.open}
          iconBg="bg-red-50"
          iconColor="text-red-500"
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
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          onClick={() =>
            setFilterStatus(filterStatus === "OPEN" ? "ALL" : "OPEN")
          }
          active={filterStatus === "OPEN"}
        />
        <StatCard
          label="In Progress"
          value={counts.inProgress}
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
          onClick={() =>
            setFilterStatus(
              filterStatus === "IN_PROGRESS" ? "ALL" : "IN_PROGRESS",
            )
          }
          active={filterStatus === "IN_PROGRESS"}
        />
        <StatCard
          label="Resolved"
          value={counts.resolved}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
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
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
          onClick={() =>
            setFilterStatus(filterStatus === "RESOLVED" ? "ALL" : "RESOLVED")
          }
          active={filterStatus === "RESOLVED"}
        />
        <StatCard
          label="Critical"
          value={counts.critical}
          iconBg="bg-red-50"
          iconColor="text-red-500"
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
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          onClick={() =>
            setFilterSeverity(
              filterSeverity === "CRITICAL" ? "ALL" : "CRITICAL",
            )
          }
          active={filterSeverity === "CRITICAL"}
        />
        <StatCard
          label="Won't Fix"
          value={counts.wontFix}
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
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          }
          onClick={() =>
            setFilterStatus(filterStatus === "WONT_FIX" ? "ALL" : "WONT_FIX")
          }
          active={filterStatus === "WONT_FIX"}
        />
      </div>

      {/* ── Search + Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Bug search */}
        <div className="relative flex-1 min-w-[160px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icons.Search />
          </span>
          <input
            type="text"
            value={bugSearch}
            onChange={(e) => setBugSearch(e.target.value)}
            placeholder="Search bugs..."
            className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
          />
          {bugSearch && (
            <button
              onClick={() => setBugSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <Icons.X />
            </button>
          )}
        </div>
        {/* Project search */}
        <div className="relative min-w-[140px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icons.Search />
          </span>
          <input
            type="text"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Filter project..."
            className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
          />
          {projectSearch && (
            <button
              onClick={() => setProjectSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
            >
              <Icons.X />
            </button>
          )}
        </div>
        {/* Severity */}
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
        >
          <option value="ALL">All Severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        {/* Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
        >
          <option value="ALL">All Status</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="WONT_FIX">Won't Fix</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => {
              setBugSearch("");
              setProjectSearch("");
              setFilterSeverity("ALL");
              setFilterStatus("ALL");
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Report Bug Form ── */}
      {canReportBug && showForm && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-purple-50/40 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm">
                <Icons.Bug />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Report New Bug
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Describe the issue clearly so the team can reproduce and
                  resolve it faster.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <Icons.X />
            </button>
          </div>

          <form onSubmit={handleReportBug} className="space-y-5 p-4 sm:p-6">
            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] text-red-700">
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
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Bug Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  disabled={submitting}
                  value={newBug.title}
                  onChange={(e) =>
                    setNewBug((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="e.g. Login button broken on mobile"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[13px] font-medium text-slate-800 transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Severity */}
              <div>
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Severity
                </label>
                <select
                  value={newBug.severity}
                  disabled={submitting}
                  onChange={(e) =>
                    setNewBug((p) => ({ ...p, severity: e.target.value }))
                  }
                  className={`h-11 w-full rounded-xl border px-3.5 text-[12.5px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    newBug.severity === "CRITICAL"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : newBug.severity === "HIGH"
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : newBug.severity === "MEDIUM"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={newBug.status}
                  disabled={submitting}
                  onChange={(e) =>
                    setNewBug((p) => ({ ...p, status: e.target.value }))
                  }
                  className={`h-11 w-full rounded-xl border px-3.5 text-[12.5px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    newBug.status === "RESOLVED"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : newBug.status === "IN_PROGRESS"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : newBug.status === "WONT_FIX"
                          ? "border-slate-200 bg-slate-100 text-slate-700"
                          : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="WONT_FIX">Won't Fix</option>
                </select>
              </div>

              {/* Attachments */}
              <div className="md:col-span-2">
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Attachments
                </label>
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-slate-400 hover:bg-white">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    multiple
                    disabled={submitting}
                    className="w-full text-[11px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-blue-700 file:px-2.5 file:py-1 file:text-[10.5px] file:font-semibold file:text-white hover:file:bg-blue-800"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) {
                        setNewBug((p) => ({ ...p, attachments: [] }));
                        return;
                      }
                      const allowed = new Set([".xlsx", ".xls", ".csv"]);
                      const bad = files.filter((f) => {
                        const ext = f.name
                          .slice(f.name.lastIndexOf("."))
                          .toLowerCase();
                        return !allowed.has(ext);
                      });
                      if (bad.length) {
                        setFormError("Only .xlsx, .xls, .csv allowed");
                        return;
                      }
                      setFormError("");
                      setNewBug((p) => ({ ...p, attachments: files }));
                    }}
                  />
                  {newBug.attachments?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2">
                      {newBug.attachments.map((attachment, index) => (
                        <span
                          key={`${attachment.name}-${index}`}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-purple-100 bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-700"
                        >
                          <Icons.File />
                          <span className="max-w-[240px] truncate">
                            {attachment.name}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-[10px] text-slate-400">
                    .xlsx · .xls · .csv
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={5}
                  disabled={submitting}
                  maxLength={2000}
                  value={newBug.description}
                  onChange={(e) =>
                    setNewBug((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Steps to reproduce, expected vs actual behaviour..."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-[13px] leading-relaxed text-slate-800 transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <div className="text-right text-[10px] text-slate-400 mt-0.5">
                  {newBug.description?.length || 0}/2000
                </div>
              </div>

              {/* Related task */}
              <div className="md:col-span-2">
                <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Related Task <span className="text-red-500">*</span>
                </label>
                <div className="relative mb-2">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icons.Search />
                  </span>
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Search tasks..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3.5 text-[13px] text-slate-700 transition placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-inner">
                  {taskLoading ? (
                    <div className="flex items-center gap-2 p-3 text-[12px] text-slate-400">
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 border-r-slate-700 rounded-full animate-spin" />{" "}
                      Loading tasks...
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="p-3 text-[12px] text-slate-400">
                      No matching tasks
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <label
                        key={task._id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition ${newBug.taskId === task._id ? "bg-indigo-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name="taskId"
                          value={task._id}
                          checked={newBug.taskId === task._id}
                          onChange={() =>
                            setNewBug((p) => ({ ...p, taskId: task._id }))
                          }
                          className="accent-slate-900"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-medium text-slate-800 truncate">
                            {task.title}
                          </p>
                          <p className="text-[10.5px] text-slate-400">
                            {task.status}
                          </p>
                        </div>
                        {newBug.taskId === task._id && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#4f46e5"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Form footer */}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowForm(false);
                  setFormError("");
                }}
                className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-9 px-5 rounded-lg bg-blue-700 text-white text-[13px] font-semibold hover:bg-blue-800 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-r-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icons.Bug /> Submit Bug
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Bug table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[12.5px] font-bold text-slate-700">
            {filteredBugs.length} bug{filteredBugs.length !== 1 ? "s" : ""}{" "}
            {hasFilters ? "matching filters" : "found"}
          </p>
          {hasFilters && (
            <span className="text-[11px] text-slate-400">
              {counts.total - filteredBugs.length} hidden by filters
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-[12px] text-slate-400">Loading bug reports...</p>
          </div>
        ) : filteredBugs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Icons.Bug />
            </div>
            <p className="text-[13px] font-semibold text-slate-700">
              No bugs found
            </p>
            <p className="text-[12px] text-slate-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-2.5 bg-slate-50">
              {["Bug", "Project", "Severity", "Status", "Reporter", ""].map(
                (h, i) => (
                  <span
                    key={i}
                    className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {h}
                  </span>
                ),
              )}
            </div>

            {filteredBugs.map((bug) => {
              const project = getProjectNameFromBug(bug);
              const reporter = bug?.reportedBy?.name || "Unknown";
              const created = formatDateTime(bug?.createdAt);
              const canEditRow = canEditBugForRole(role, user?._id, bug);
              return (
                <div
                  key={bug._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleViewBug(bug)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleViewBug(bug);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 items-center hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 transition-colors group"
                >
                  {/* Bug title */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            bug.status === "RESOLVED"
                              ? "#10b981"
                              : bug.status === "IN_PROGRESS"
                                ? "#3b82f6"
                                : bug.status === "WONT_FIX"
                                  ? "#94a3b8"
                                  : "#ef4444",
                        }}
                      />
                      <p className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                        {bug.title}
                      </p>
                    </div>
                    <p className="text-[10.5px] text-slate-400 ml-3.5">
                      {created}
                    </p>
                  </div>

                  {/* Project */}
                  <p className="text-[12px] text-slate-500 truncate">
                    {project}
                  </p>

                  {/* Severity */}
                  <div>
                    <SeverityChip sev={bug.severity || "MEDIUM"} />
                  </div>

                  {/* Status — inline select if canEdit */}
                  <div>
                    {canEditRow ? (
                      <select
                        value={bug.status || "OPEN"}
                        onChange={(e) =>
                          handleUpdateStatus(bug._id, e.target.value)
                        }
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className={`h-7 px-2 rounded-full border text-[10.5px] font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 transition cursor-pointer ${
                          bug.status === "RESOLVED"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : bug.status === "IN_PROGRESS"
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : bug.status === "WONT_FIX"
                                ? "bg-slate-100 border-slate-200 text-slate-600"
                                : "bg-red-50 border-red-200 text-red-700"
                        }`}
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="WONT_FIX">Won't Fix</option>
                      </select>
                    ) : (
                      <StatusChip status={bug.status || "OPEN"} />
                    )}
                  </div>

                  {/* Reporter */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                      {reporter.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[12px] text-slate-600 truncate">
                      {reporter}
                    </span>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleViewBug(bug);
                    }}
                    className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition"
                    title="View details"
                  >
                    <Icons.Eye />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bug detail modal ── */}
      {showBugModal && selectedBug && (
        <BugDetailModal
          bug={selectedBug}
          isOpen={showBugModal}
          onClose={handleCloseBugModal}
          onDelete={selectedCanDelete ? handleDeleteBug : undefined}
          canDelete={selectedCanDelete}
          canEdit={selectedCanEdit}
          onUpdateBug={handleBugUpdated}
        />
      )}
    </div>
  );
}
