import React, {
    useState, useEffect, useMemo, useRef, useCallback, memo,
} from "react";
import { useNavigate } from "react-router-dom";
import { Users, Check, X, Flag, RefreshCw, Download } from "lucide-react";
import * as XLSX from "xlsx";
import getAuthAxios from "../utils/authAxios";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { confirmDialog } from "../components/ConfirmDialog";
import StatsCard from "./components/StatsCard";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Constants (outside component to avoid re-creation) ────────────────────────
const EMPTY_GOAL = {
    title: "", successMeasure: "", checkpointDate: "",
    progressStatus: "not_started", notes: "",
};
const EMPTY_PIP_FORM = {
    id: "", employee_id: "", status: "active", outcome: "pending",
    startDate: "", targetEndDate: "", reason: "", reviewNotes: "",
    goals: [{ ...EMPTY_GOAL }],
};
const PIP_STATUS_OPTIONS = [
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "extended", label: "Extended" },
    { value: "cancelled", label: "Cancelled" },
];
const PIP_OUTCOME_OPTIONS = [
    { value: "pending", label: "Pending" },
    { value: "improved", label: "Improved" },
    { value: "extended", label: "Extended" },
    { value: "exited", label: "Exited" },
    { value: "cancelled", label: "Cancelled" },
];
const PIP_GOAL_STATUS_OPTIONS = [
    { value: "not_started", label: "Yet To Start" },
    { value: "on_track", label: "In Progress" },
    { value: "met", label: "Completed" },
];
const PAGE_SIZE_OPTIONS = [10, 25, 50];

// ── PMS Role management (HR only) ──────────────────────────────────────────────
const PMS_ROLE_META = {
    hr: { label: "HR", icon: "🛡️", classes: "bg-violet-100 text-violet-700 border-violet-200" },
    manager: { label: "Manager", icon: "⭐", classes: "bg-teal-100 text-teal-700 border-teal-200" },
    employee: { label: "Employee", icon: "👤", classes: "bg-slate-100 text-slate-600 border-slate-200" },
};
const PMS_ROLE_OPTIONS = [
    { value: "employee", label: "Employee" },
    { value: "manager", label: "Manager" },
    { value: "hr", label: "HR" },
];

// ── Pure helpers ──────────────────────────────────────────────────────────────
const getProofDocuments = (goal) => {
    if (goal?.proofDocuments?.length) return goal.proofDocuments;
    if (goal?.proofDocument) return [goal.proofDocument];
    return [];
};
const fetchProofUrl = async (path) => {
    if (!path) return null;
    try {
        const api = await getAuthAxios();
        const res = await api.get("/pms/pips/proof-url", { params: { blob_name: path } });
        return res.data?.url || null;
    } catch (err) {
        console.error("Failed to get proof URL", err);
        return null;
    }
};

const proofFileName = (path) =>
  path ? path.split("/").pop().replace(/^\d+\.\d+_/, "") : null;

const formatDateTime = (timestamp) => {
    if (!timestamp) return { date: "-", time: "-" };
    const d = new Date(
        typeof timestamp === "string" && !timestamp.endsWith("Z")
            ? `${timestamp}Z`
            : timestamp
    );
    return {
        date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
    };
};

const getKraType = (kra) =>
    kra.type === "organizational" || kra.isOrganizational || kra.category === "organizational"
        ? "organizational"
        : "job-specific";

const getPipSummary = (pip) => {
    if (!pip) return { label: "PIP", hasPip: false, tone: "bg-white text-slate-600 border-2 border-slate-300 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 shadow-sm", dot: "bg-slate-400" };
    if (pip.status === "active") return { label: "PIP", hasPip: true, tone: "bg-red-50 text-red-600 border-2 border-red-200 hover:bg-red-100 shadow-sm", dot: "bg-red-500" };
    if (pip.status === "completed") return { label: "Completed", hasPip: true, tone: "bg-white text-emerald-600 border-2 border-emerald-400 hover:bg-emerald-50 shadow-sm", dot: "bg-emerald-500" };
    if (pip.status === "extended") return { label: "Extended", hasPip: true, tone: "bg-white text-violet-600 border-2 border-violet-400 hover:bg-violet-50 shadow-sm", dot: "bg-violet-500" };
    if (pip.status === "cancelled") return { label: "Cancelled", hasPip: true, tone: "bg-white text-slate-500 border-2 border-slate-300 hover:bg-slate-50 shadow-sm", dot: "bg-slate-400" };
    return { label: pip.status, hasPip: true, tone: "bg-white text-slate-500 border-2 border-slate-300 shadow-sm", dot: "bg-slate-400" };
};

const initials = (name = "") =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

const buildDownloadCSV = (filteredUsers, formatDateTimeFn) => () => {
    if (!filteredUsers.length) return;
    const header = ["User Name", "PMS Role", "KRA Assigned", "Assigned By", "Assigned Date", "Assigned Time", "Reports To"];
    const rows = [header];
    filteredUsers.forEach((u) => {
        const { date, time } = formatDateTimeFn(u.assignedAt);
        rows.push([
            u.name,
            (PMS_ROLE_META[u.pms_role] || PMS_ROLE_META.employee).label,
            u.hasKra ? "Yes" : "No",
            u.assignedBy || "-",
            date,
            time,
            u.managerName || "-",
        ]);
    });

    // A plain CSV carries no column-width info, so Excel auto-fits each
    // column to its narrowest default and dates/times show up as "####" —
    // writing a real .xlsx with explicit column widths avoids that.
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
        { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 22 },
    ];
    header.forEach((_, colIdx) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
        if (sheet[addr]) sheet[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: "EDE9FE" } } };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "User KRA Assignments");
    XLSX.writeFile(workbook, "user-kra-assignments.xlsx");
};

// ── Shared spinner ─────────────────────────────────────────────────────────────
const Spinner = ({ size = "w-8 h-8", color = "border-violet-200 border-t-violet-600" }) => (
    <div className={`${size} border-4 ${color} rounded-full animate-spin`} />
);

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = memo(({ toast, onClose }) => {
    if (!toast) return null;
    const isSuccess = toast.type === "success";
    return (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl text-white text-sm font-medium ${isSuccess ? "bg-emerald-500" : "bg-red-500"}`}>
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSuccess ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
            </svg>
            <span>{toast.message}</span>
            <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
});

// ── PIP Goal Card ─────────────────────────────────────────────────────────────
const PipGoalCard = memo(({ goal, index, savedGoal, employeeUpdatedAt, totalGoals, onUpdate, onRemove, onViewProof }) => {
    const proofDocs = getProofDocuments(savedGoal);
    const totalAttachments = proofDocs.length;

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-700">Goal {index + 1}</p>
                    {totalAttachments > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold">
                            📎 {totalAttachments} {totalAttachments === 1 ? "attachment" : "attachments"}
                        </span>
                    )}
                </div>
                {totalGoals > 1 && (
                    <button type="button" onClick={() => onRemove(index)} className="text-xs text-red-500 hover:text-red-700 font-medium">
                        Remove
                    </button>
                )}
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 font-medium block mb-1">
                        Goal Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={goal.title}
                        onChange={(e) => onUpdate(index, "title", e.target.value)}
                        placeholder="Describe the improvement goal…"
                        className={`w-full border px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${!goal.title?.trim() ? "border-red-300 bg-red-50 focus:ring-red-400" : "border-slate-200"}`}
                    />
                    {!goal.title?.trim() && <p className="text-xs text-red-500 mt-1">Goal title is required.</p>}
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Success Measure</label>
                    <input type="text" value={goal.successMeasure}
                        onChange={(e) => onUpdate(index, "successMeasure", e.target.value)}
                        placeholder="How will success be measured?"
                        className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Checkpoint Date</label>
                    <input type="date" value={goal.checkpointDate} max="2100-12-31"
                        onChange={(e) => {
                            const v = e.target.value;
                            // Native date inputs don't clamp the year segment while typing —
                            // without this, keying digits straight through can leave a
                            // value like "11-11-111111" in state (see bug report).
                            if (v && Number(v.slice(0, 4)) > 2100) return;
                            onUpdate(index, "checkpointDate", v);
                        }}
                        className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Progress Status</label>
                    <select value={goal.progressStatus} onChange={(e) => onUpdate(index, "progressStatus", e.target.value)}
                        className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                        {PIP_GOAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 font-medium block mb-1">Manager Notes</label>
                    <textarea value={goal.notes} rows={2} onChange={(e) => onUpdate(index, "notes", e.target.value)}
                        placeholder="Any notes or context…"
                        className="w-full border border-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                </div>
            </div>
            {/* Employee Submission panel */}
            <div className="px-4 pb-4">
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Submission</span>
                        {employeeUpdatedAt && (
                            <span className="text-xs text-slate-400">
                                Last updated: {new Date(employeeUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Employee Status:</span>
                        {savedGoal?.progressStatus ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${savedGoal.progressStatus === "met" ? "bg-emerald-100 text-emerald-700" : savedGoal.progressStatus === "on_track" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${savedGoal.progressStatus === "met" ? "bg-emerald-500" : savedGoal.progressStatus === "on_track" ? "bg-violet-500" : "bg-slate-400"}`} />
                                {PIP_GOAL_STATUS_OPTIONS.find((o) => o.value === savedGoal.progressStatus)?.label || savedGoal.progressStatus}
                            </span>
                        ) : (
                            <span className="text-xs text-slate-400 italic">Not submitted yet</span>
                        )}
                    </div>
                    {totalAttachments > 0 ? (
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                {totalAttachments} {totalAttachments === 1 ? "Attachment" : "Attachments"}
                            </p>
                            {proofDocs.map((path, fileIdx) => (
                                <div key={fileIdx} className="flex items-center gap-3 p-2.5 bg-violet-50 border border-violet-200 rounded-lg">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                                        <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-violet-700 truncate">{proofFileName(path) || `Attachment ${fileIdx + 1}`}</p>
                                        <p className="text-xs text-slate-400">Employee uploaded proof</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            const url = await fetchProofUrl(path);
                                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                                        }}
                                        className="shrink-0 px-3 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition">
                                        View
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">No proof uploaded yet</p>
                    )}
                </div>
            </div>
        </div>
    );
});

// ── User Table Row ─────────────────────────────────────────────────────────────
const UserRow = memo(({
    userData, isChecked, filterStatus, pms_role,
    canManageReporting, canManagePip,
    pipSummary, onView, onReporting, onArchive, onPip, onToggleSelect,
}) => {
    const { date, time } = formatDateTime(userData.assignedAt);
    const isArchived = userData.isArchived === true;

    return (
        <tr className={`flex w-full items-center transition-colors ${isArchived ? "bg-slate-50 opacity-70 hover:opacity-90" : isChecked ? "bg-violet-50" : "hover:bg-slate-50"}`}>
            {filterStatus !== "archived" && pms_role === "hr" && (
                <td className="px-4 py-3 w-[48px] flex items-center justify-center">
                    <input type="checkbox" checked={isChecked} onChange={() => onToggleSelect(userData.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded accent-violet-600 cursor-pointer" />
                </td>
            )}
            <td className={`px-6 py-3 min-w-0 ${filterStatus !== "archived" && pms_role === "hr" ? "w-[26%]" : "w-[32%]"}`}>
                <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0 ${isArchived ? "bg-slate-400" : "bg-gradient-to-br from-violet-700 to-violet-500"}`}>
                        {initials(userData.name)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold block truncate ${isArchived ? "text-slate-400" : "text-slate-800"}`}>{userData.name}</span>
                        </div>
                        {userData.email && (
                            <span className="text-xs text-slate-400 truncate block">{userData.email}</span>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-4 py-3 text-center w-[10%]">
                {userData.hasKra ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Yes
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />No
                    </span>
                )}
            </td>
            <td className="px-4 py-3 w-[16%] min-w-0">
                {!isArchived && userData.assignedBy ? (
                    <div className="min-w-0">
                        <span className="text-xs font-medium text-slate-700 flex items-center gap-1 truncate">
                            <svg className="w-3 h-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            <span className="truncate">{userData.assignedBy}</span>
                        </span>
                        {userData.assignedAt && (
                            <span className="text-[11px] text-slate-400 block truncate mt-0.5">{date}, {time}</span>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-slate-300">—</span>
                )}
            </td>
            {canManageReporting && (
                <td className="px-4 py-3 text-center w-[13%]">
                    {userData.managerName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium border border-teal-200 max-w-full truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                            <span className="truncate">{userData.managerName}</span>
                        </span>
                    ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                </td>
            )}
            <td className="px-4 py-3 text-center w-[10%]">
                {isArchived ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />Archived
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active
                    </span>
                )}
            </td>
            <td className="px-4 py-3 flex-1 min-w-[260px]">
                <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                    {isArchived ? (
                        // Restore moved to HRMS Manage > PMS (single centralized place for module access).
                        // <button onClick={() => onArchive(userData.id, userData.name, true)}
                        //     className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition active:scale-95">
                        //     Restore
                        // </button>
                        <span className="text-xs text-slate-400 italic">Archived</span>
                    ) : (
                        <>
                            <button onClick={() => onView(userData)} title="View KRA Details"
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50 text-violet-600 hover:bg-violet-100 transition shrink-0">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
                            <button onClick={() => canManageReporting && onReporting(userData)}
                                disabled={!canManageReporting}
                                title={canManageReporting ? "Manage Reporting Line" : "You don't have permission to manage reporting"}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition shrink-0 ${canManageReporting ? "bg-teal-50 text-teal-600 hover:bg-teal-100" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </button>
                            {/* Archive moved to HRMS Manage > PMS (single centralized place for module access).
                            <button onClick={() => pms_role === "hr" && onArchive(userData.id, userData.name, false)}
                                disabled={pms_role !== "hr"}
                                title={pms_role === "hr" ? "Archive User" : "Only HR can archive users"}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition shrink-0 ${pms_role === "hr" ? "bg-orange-50 text-orange-500 hover:bg-orange-100 hover:text-orange-700" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v4m4-4v4" /></svg>
                            </button>
                            */}
                            {canManagePip ? (
                                <button onClick={() => onPip(userData)}
                                    title={pipSummary.hasPip ? "Manage PIP" : "Start PIP"}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${pipSummary.tone}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pipSummary.dot}`} />
                                    {pipSummary.label}
                                </button>
                            ) : (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 whitespace-nowrap ${pipSummary.tone}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pipSummary.dot}`} />
                                    {pipSummary.label}
                                </span>
                            )}
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
});

// ── Main Component ─────────────────────────────────────────────────────────────
export default function UserKraSearch() {
    const { user } = useAuth();
    const navigate = useNavigate();
    // NOTE: users have TWO separate role fields — `role` (TimeFlow) and
    // `pms_role` (this PMS app). This page's permissions must be gated on
    // `pms_role`, since the two can differ per user (e.g. TimeFlow role
    // "manager" but pms_role "hr"). `user` comes from useAuth() (/api/auth/me),
    // which carries both fields — so we read pms_role directly instead of
    // going through getUserRole(), which only ever reads `role`.
    const pms_role = (user?.roles?.pms || "employee").toLowerCase();

    // ── Core state ────────────────────────────────────────────────────────────
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sortType, setSortType] = useState("name");
    const [filterStatus, setFilterStatus] = useState("all");
    const [roleFilter, setRoleFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [archivedUsers, setArchivedUsers] = useState([]);
    const [archivedLoading, setArchivedLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [myReportIds, setMyReportIds] = useState(null);
    const [userPips, setUserPips] = useState({});

    // ── KRA modal state (view-only — editing weights/assignment now happens
    // via Access Grants > Manage Roles and the /pms/templates assign flow) ──
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userKraDetails, setUserKraDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // ── PIP modal state ───────────────────────────────────────────────────────
    const [pipModalOpen, setPipModalOpen] = useState(false);
    const [pipUser, setPipUser] = useState(null);
    const [pipForm, setPipForm] = useState(EMPTY_PIP_FORM);
    const [savingPip, setSavingPip] = useState(false);
    const pipSubmitting = useRef(false);
    const pipOriginalForm = useRef(null);

    // ── Reporting modal state ─────────────────────────────────────────────────
    const [reportingModalOpen, setReportingModalOpen] = useState(false);
    const [reportingUser, setReportingUser] = useState(null);
    const [managers, setManagers] = useState([]);
    const [managersLoading, setManagersLoading] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState("");
    const [savingManager, setSavingManager] = useState(false);

    // ── Bulk state ────────────────────────────────────────────────────────────
    const [bulkSelected, setBulkSelected] = useState(new Set());
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkManagerId, setBulkManagerId] = useState("");
    const [savingBulk, setSavingBulk] = useState(false);

    // ── Derived flags ─────────────────────────────────────────────────────────
    const canManagePip = pms_role === "hr" || pms_role === "manager" || pms_role === "admin";
    const canManageReporting = pms_role === "hr";
    const isPipDirty = pipOriginalForm.current !== JSON.stringify(pipForm);
    const tableLoading = filterStatus === "archived" ? archivedLoading : loading;

    // ── Toast helper ──────────────────────────────────────────────────────────
    const showToast = useCallback((message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // ── API helpers ───────────────────────────────────────────────────────────
    const fetchAllUsers = useCallback(async () => {
        setLoading(true);
        try {
            const api = await getAuthAxios();
            const res = await api.get("/pms/kra/users/search");
            const formatted = (res.data || []).map((u) => {
                let latest = null, assignedBy = null;
                (u.kras || []).forEach((k) => {
                    if (!latest || new Date(k.assignedAt) > new Date(latest)) {
                        latest = k.assignedAt; assignedBy = k.assignedBy;
                    }
                });
                return {
                    id: u.id, name: u.name, email: u.email,
                    pms_role: (u.role || "employee").toLowerCase(),
                    hasKra: u.hasKRA, kraCount: u.kras?.length || 0,
                    assignedBy, assignedAt: latest, isArchived: false,
                    managerId: u.managerId || null, managerName: u.managerName || null,
                };
            });
            setAllUsers(formatted);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchArchivedUsers = useCallback(async () => {
        setArchivedLoading(true);
        try {
            const api = await getAuthAxios();
            const res = await api.get("/pms/kra/users/search", { params: { archived: true } });
            setArchivedUsers((res.data || []).map((u) => ({
                id: u.id, name: u.name, email: u.email,
                pms_role: (u.role || "employee").toLowerCase(),
                hasKra: u.hasKRA, kraCount: u.kras?.length || 0,
                assignedBy: null, assignedAt: null, isArchived: true,
                managerId: u.managerId || null, managerName: u.managerName || null,
            })));
        } catch (error) {
            console.error("Error fetching archived users:", error);
        } finally {
            setArchivedLoading(false);
        }
    }, []);

    const fetchAllPips = useCallback(async () => {
        try {
            const api = await getAuthAxios();
            const pips = (await api.get("/pms/pips")).data || [];
            const pipMap = {};
            pips.forEach((pip) => {
                const uid = String(pip.employeeId?._id || pip.employeeId);
                if (!pipMap[uid] || pip.status === "active") pipMap[uid] = pip;
            });
            setUserPips(pipMap);
        } catch (error) {
            console.error("Error fetching PIPs:", error);
        }
    }, []);

    // The search endpoint matches by name substring, so a name like "1234"
    // can match multiple users (e.g. "1234" and "12345") — picking the exact
    // id out of the result set avoids showing the wrong person's KRAs just
    // because they sorted first.
    const fetchUserDetails = useCallback(async (userId, userName) => {
        setDetailsLoading(true);
        try {
            const api = await getAuthAxios();
            const res = await api.get("/pms/kra/users/search", { params: { name: userName } });
            const match = (res.data || []).find((u) => u.id === userId) || res.data?.[0] || null;
            setUserKraDetails(match);
        } catch (error) {
            console.error("Error fetching user details:", error);
        } finally {
            setDetailsLoading(false);
        }
    }, []);

    const fetchManagers = useCallback(async () => {
        try {
            const api = await getAuthAxios();
            const res = await api.get("/pms/kra/managers");
            setManagers(res.data || []);
        } catch (err) {
            console.error("Failed to load managers", err);
        }
    }, []);

    useEffect(() => {
        fetchAllUsers();
        fetchAllPips();
        if (pms_role === "manager") {
            getAuthAxios()
                .then((api) => api.get("/users/my-reports"))
                .then((res) => setMyReportIds(res.data?.report_ids || []))
                .catch(() => setMyReportIds([]));
        }
    }, [fetchAllUsers, fetchAllPips, pms_role]);

    useEffect(() => {
        if (filterStatus === "archived") fetchArchivedUsers();
    }, [filterStatus, fetchArchivedUsers]);

    // ── Archive ───────────────────────────────────────────────────────────────
    const handleArchive = useCallback(async (userId, userName, restore = false) => {
        const confirmed = await confirmDialog({
            title: restore ? "Restore User?" : "Archive User?",
            text: restore
                ? `${userName} will regain full access to the PMS.`
                : `${userName} will lose access to the entire PMS. They won't appear anywhere and cannot log in.`,
            confirmText: restore ? "Yes, Restore" : "Yes, Archive",
            danger: !restore,
        });
        if (!confirmed) return;
        try {
            const api = await getAuthAxios();
            await api.patch(`/users/${userId}/archive`, { module: "pms", archived: !restore });
            if (restore) {
                setArchivedUsers((prev) => prev.filter((u) => u.id !== userId));
                // Restoring only removes the user from the archived list above —
                // they also need to reappear in the active list, which is only
                // ever populated by this fetch (on mount), not patched locally.
                await fetchAllUsers();
                toast.success(`${userName} has been restored.`);
            } else {
                setAllUsers((prev) => prev.filter((u) => u.id !== userId));
                toast.success(`${userName} has been archived.`);
            }
        } catch {
            toast.error(`Failed to ${restore ? "restore" : "archive"} user.`);
        }
    }, [fetchAllUsers]);

    // ── Reporting ─────────────────────────────────────────────────────────────
    const openReportingModal = useCallback(async (userData) => {
        setReportingUser(userData);
        setSelectedManagerId(userData.managerId || "");
        setReportingModalOpen(true);
        setManagersLoading(true);
        await fetchManagers();
        setManagersLoading(false);
    }, [fetchManagers]);

    const closeReportingModal = useCallback(() => {
        if (savingManager) return;
        setReportingModalOpen(false); setReportingUser(null);
        setManagers([]); setSelectedManagerId("");
    }, [savingManager]);

    const handleAssignManager = useCallback(async () => {
        if (savingManager) return;
        setSavingManager(true);
        try {
            const api = await getAuthAxios();
            const chosen = managers.find((m) => String(m.id) === String(selectedManagerId));
            const mgrName = chosen?.username || chosen?.name || chosen?.email?.split("@")[0] || "";
            await api.patch(`/users/${reportingUser.id}/manager`, { manager_id: selectedManagerId || null, manager_name: mgrName });
            setAllUsers((prev) => prev.map((u) => u.id === reportingUser.id ? { ...u, managerId: selectedManagerId || null, managerName: mgrName || null } : u));
            showToast(selectedManagerId ? `${reportingUser.name} now reports to ${mgrName}` : `Reporting line cleared for ${reportingUser.name}`);
            closeReportingModal();
        } catch (err) {
            console.error("Failed to assign manager", err);
            showToast("Failed to save. Please try again.", "error");
        } finally {
            setSavingManager(false);
        }
    }, [savingManager, managers, selectedManagerId, reportingUser, showToast, closeReportingModal]);

    // ── Bulk ──────────────────────────────────────────────────────────────────
    const filteredUsers = useMemo(() => {
        if (filterStatus === "archived") {
            const q = searchQuery.trim().toLowerCase();
            return q ? archivedUsers.filter((u) => u.name.toLowerCase().includes(q)) : archivedUsers;
        }
        let users = pms_role === "manager" && myReportIds !== null
            ? allUsers.filter((u) => myReportIds.includes(u.id))
            : [...allUsers];
        const q = searchQuery.trim().toLowerCase();
        if (q) users = users.filter((u) => u.name.toLowerCase().includes(q));
        if (filterStatus === "assigned") users = users.filter((u) => u.hasKra);
        else if (filterStatus === "unassigned") users = users.filter((u) => !u.hasKra);
        else if (filterStatus === "pip") users = users.filter((u) => userPips[u.id]?.status === "active");
        if (roleFilter !== "all") users = users.filter((u) => u.pms_role === roleFilter);
        if (sortType === "name") users.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortType === "recent") users.sort((a, b) => new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0));
        return users;
    }, [allUsers, archivedUsers, searchQuery, filterStatus, roleFilter, sortType, myReportIds, pms_role, userPips]);

    useEffect(() => setPage(1), [searchQuery, filterStatus, roleFilter, sortType, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);
    const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

    const baseScopeUsers = pms_role === "manager" && myReportIds !== null
        ? allUsers.filter((u) => myReportIds.includes(u.id))
        : allUsers;
    const totalUsersCount = baseScopeUsers.length;
    const kraAssignedCount = baseScopeUsers.filter((u) => u.hasKra).length;
    const noKraCount = baseScopeUsers.filter((u) => !u.hasKra).length;
    const pipActiveCount = baseScopeUsers.filter((u) => userPips[u.id]?.status === "active").length;

    const allFilteredSelected = filteredUsers.length > 0 && bulkSelected.size === filteredUsers.length;

    const toggleBulkSelect = useCallback((userId) => {
        setBulkSelected((prev) => { const next = new Set(prev); next.has(userId) ? next.delete(userId) : next.add(userId); return next; });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setBulkSelected(allFilteredSelected ? new Set() : new Set(filteredUsers.map((u) => u.id)));
    }, [allFilteredSelected, filteredUsers]);

    const openBulkModal = useCallback(async () => {
        setBulkManagerId(""); setBulkModalOpen(true); await fetchManagers();
    }, [fetchManagers]);

    const closeBulkModal = useCallback(() => {
        if (savingBulk) return; setBulkModalOpen(false); setBulkManagerId("");
    }, [savingBulk]);

    const handleBulkManagerAssign = useCallback(async () => {
        if (savingBulk) return;
        setSavingBulk(true);
        try {
            const api = await getAuthAxios();
            const chosen = managers.find((m) => String(m.id) === String(bulkManagerId));
            const mgrName = chosen?.username || chosen?.name || chosen?.email?.split("@")[0] || "";
            const res = await api.post("/users/bulk-assign-manager", {
                user_ids: Array.from(bulkSelected), manager_id: bulkManagerId || null, manager_name: mgrName,
            });
            showToast(`Manager updated for ${res.data.updated} user(s)`);
            closeBulkModal(); setBulkSelected(new Set()); await fetchAllUsers();
        } catch (err) {
            console.error("Bulk manager assign failed", err);
            showToast("Bulk manager assign failed. Please try again.", "error");
        } finally {
            setSavingBulk(false);
        }
    }, [savingBulk, managers, bulkManagerId, bulkSelected, showToast, closeBulkModal, fetchAllUsers]);

    // ── KRA modal (view-only) ─────────────────────────────────────────────────
    const openViewModal = useCallback((userData) => {
        setSelectedUser(userData);
        setModalOpen(true); fetchUserDetails(userData.id, userData.name);
    }, [fetchUserDetails]);

    const closeModal = useCallback(() => {
        setModalOpen(false); setSelectedUser(null); setUserKraDetails(null);
    }, []);

    // ── PIP ───────────────────────────────────────────────────────────────────
    const openPipModal = useCallback(async (userData) => {
        setPipUser(userData); setPipModalOpen(true);
        try {
            const api = await getAuthAxios();
            const pips = (await api.get("/pms/pips")).data || [];
            const pipMap = {};
            pips.forEach((pip) => { const uid = String(pip.employeeId?._id || pip.employeeId); if (!pipMap[uid] || pip.status === "active") pipMap[uid] = pip; });
            setUserPips(pipMap);
            const existing = pipMap[userData.id] || null;
            const formData = existing ? {
                id: existing._id || "",
                employee_id: userData.id,
                status: existing.status || "active",
                outcome: existing.outcome || "pending",
                startDate: existing.startDate ? new Date(existing.startDate).toISOString().slice(0, 10) : "",
                targetEndDate: existing.targetEndDate ? new Date(existing.targetEndDate).toISOString().slice(0, 10) : "",
                reason: existing.reason || "",
                reviewNotes: existing.reviewNotes || "",
                goals: existing.goals?.length
                    ? existing.goals.map((g) => ({
                        title: g.title || "", successMeasure: g.successMeasure || "",
                        checkpointDate: g.checkpointDate ? new Date(g.checkpointDate).toISOString().slice(0, 10) : "",
                        progressStatus: g.progressStatus || "not_started", notes: g.notes || "",
                        proofDocuments: g.proofDocuments || (g.proofDocument ? [g.proofDocument] : []),
                    }))
                    : [{ ...EMPTY_GOAL }],
            } : { ...EMPTY_PIP_FORM, employee_id: userData.id };
            pipOriginalForm.current = JSON.stringify(formData);
            setPipForm(formData);
        } catch (err) {
            console.error("Failed to refresh PIP data", err);
        }
    }, []);

    const closePipModal = useCallback(() => {
        if (pipSubmitting.current) return;
        pipOriginalForm.current = null;
        setPipModalOpen(false); setPipUser(null); setPipForm(EMPTY_PIP_FORM);
    }, []);

    const updatePipGoalField = useCallback((index, field, value) => {
        setPipForm((prev) => ({
            ...prev,
            goals: prev.goals.map((g, i) => i === index ? { ...g, [field]: value } : g),
        }));
    }, []);

    const addPipGoal = useCallback(() => {
        const emptyIdx = pipForm.goals.findIndex((g) => !g.title?.trim());
        if (emptyIdx !== -1) { showToast(`Please fill Goal ${emptyIdx + 1} title before adding a new goal.`, "error"); return; }
        setPipForm((prev) => ({ ...prev, goals: [...prev.goals, { ...EMPTY_GOAL }] }));
    }, [pipForm.goals, showToast]);

    const removePipGoal = useCallback((index) => {
        setPipForm((prev) => ({ ...prev, goals: prev.goals.filter((_, i) => i !== index) }));
    }, []);

    const handlePipSubmit = useCallback(async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (pipSubmitting.current || savingPip) return;
        if (!pipForm.goals.length) { showToast("At least one goal is required.", "error"); return; }
        const emptyIdx = pipForm.goals.findIndex((g) => !g.title?.trim());
        if (emptyIdx !== -1) { showToast(`Goal ${emptyIdx + 1} title is required.`, "error"); return; }
        pipSubmitting.current = true; setSavingPip(true);
        try {
            const api = await getAuthAxios();
            const payload = {
                employeeId: pipForm.employee_id, status: pipForm.status,
                outcome: pipForm.outcome, startDate: pipForm.startDate,
                targetEndDate: pipForm.targetEndDate, reason: pipForm.reason,
                reviewNotes: pipForm.reviewNotes,
                goals: pipForm.goals.filter((g) => g.title.trim()).map((g) => ({
                    ...g, proofDocuments: g.proofDocuments || [], proofDocument: g.proofDocuments?.[0] || null,
                })),
            };
            pipForm.id ? await api.put(`/pms/pips/${pipForm.id}`, payload) : await api.post("/pms/pips", payload);
            await fetchAllPips();
            closePipModal();
            showToast(pipForm.id ? "PIP updated successfully!" : "PIP created successfully!");
        } catch (err) {
            console.error("PIP save failed", err);
            showToast("Failed to save PIP. Please try again.", "error");
        } finally {
            setSavingPip(false); pipSubmitting.current = false;
        }
    }, [pipForm, savingPip, showToast, fetchAllPips, closePipModal]);

    const downloadCSV = useMemo(() => buildDownloadCSV(filteredUsers, formatDateTime), [filteredUsers]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
            <div className="space-y-5">
                {/* ── Header ── */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900">User KRA Assignments</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Search and manage KRAs assigned to users</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={filterStatus === "archived" ? fetchArchivedUsers : fetchAllUsers}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition">
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                        <button onClick={downloadCSV} disabled={!filteredUsers.length}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition disabled:opacity-50">
                            <Download className="w-4 h-4" />
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* ── Stat cards ── */}
                {filterStatus !== "archived" && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatsCard icon={Users} label="Total Users" value={totalUsersCount} accent="violet"
                            active={filterStatus === "all"} onClick={() => setFilterStatus("all")} />
                        <StatsCard icon={Check} label="KRA Assigned" value={kraAssignedCount} accent="emerald"
                            active={filterStatus === "assigned"} onClick={() => setFilterStatus("assigned")} />
                        <StatsCard icon={X} label="No KRA Assigned" value={noKraCount} accent="amber"
                            active={filterStatus === "unassigned"} onClick={() => setFilterStatus("unassigned")} />
                        <StatsCard icon={Flag} label="PIP Users" value={pipActiveCount} accent="red"
                            active={filterStatus === "pip"} onClick={() => setFilterStatus("pip")} />
                    </div>
                )}

                {/* ── Search + filters ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative flex-1 min-w-[220px]">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search users by name or email..."
                                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100" />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                                { value: "all", label: "All" },
                                { value: "assigned", label: "KRA ✓" },
                                { value: "unassigned", label: "No KRA" },
                                { value: "pip", label: "PIP" },
                                ...(pms_role === "hr" ? [{ value: "archived", label: "Archived" }] : []),
                            ].map((opt) => (
                                <button key={opt.value} onClick={() => setFilterStatus(opt.value)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${filterStatus === opt.value ? "bg-gradient-to-r from-violet-700 to-violet-500 text-white border-transparent shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600"}`}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <button type="button" disabled title="Department grouping isn't available yet"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /></svg>
                            All Departments
                        </button>

                        <div className="relative shrink-0">
                            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 outline-none focus:border-violet-300 cursor-pointer">
                                <option value="all">All Roles</option>
                                {PMS_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>

                        {pms_role === "hr" && (
                            <div className="relative shrink-0">
                                <select value={filterStatus === "archived" ? "archived" : "active"}
                                    onChange={(e) => setFilterStatus(e.target.value === "archived" ? "archived" : "all")}
                                    className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 outline-none focus:border-violet-300 cursor-pointer">
                                    <option value="active">All Status</option>
                                    <option value="archived">Archived</option>
                                </select>
                                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        )}

                        <div className="relative ml-auto flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-slate-400 shrink-0">Sort by</span>
                            <div className="relative">
                                <select value={sortType} onChange={(e) => setSortType(e.target.value)}
                                    className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 outline-none focus:border-violet-300 cursor-pointer">
                                    <option value="name">User Name (A-Z)</option>
                                    <option value="recent">Recently Assigned</option>
                                </select>
                                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Archived banner */}
                {filterStatus === "archived" && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 flex items-center gap-3">
                        <svg className="w-5 h-5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v4m4-4v4" /></svg>
                        <p className="text-sm text-orange-700 font-medium">
                            Archived users have no access to the PMS. Use <span className="font-semibold">Restore</span> to reinstate.
                        </p>
                    </div>
                )}

                {/* Bulk action bar */}
                {bulkSelected.size > 0 && filterStatus !== "archived" && pms_role === "hr" && (
                    <div className="flex items-center gap-3 px-5 py-3 bg-violet-50 border border-violet-200 rounded-xl flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <span className="text-sm font-semibold text-violet-700">{bulkSelected.size} user{bulkSelected.size !== 1 ? "s" : ""} selected</span>
                        </div>
                        <button onClick={openBulkModal} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition flex items-center gap-2">Bulk Action</button>
                        <button onClick={() => setBulkSelected(new Set())} className="text-sm text-violet-500 hover:text-violet-700 underline">Clear selection</button>
                    </div>
                )}

                {/* ── Users Table ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {tableLoading ? (
                        <div className="p-12 text-center flex flex-col items-center gap-4">
                            <Spinner />
                            <p className="text-slate-500">Loading users…</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-12 text-center">
                            <svg className="w-16 h-16 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            <p className="text-slate-500 mt-4">
                                {pms_role === "manager" && myReportIds?.length === 0
                                    ? "No direct reports assigned to you yet. Contact HR to set up reporting relationships."
                                    : filterStatus === "archived" ? "No archived users found" : "No users found"}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full table-fixed">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="flex w-full">
                                        {filterStatus !== "archived" && pms_role === "hr" && (
                                            <th className="px-4 py-3 w-[48px] flex items-center justify-center">
                                                <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                                                    className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
                                                    title={allFilteredSelected ? "Deselect all" : "Select all"} />
                                            </th>
                                        )}
                                        <th className={`px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider ${filterStatus !== "archived" && pms_role === "hr" ? "w-[26%]" : "w-[32%]"}`}>
                                            <button onClick={() => setSortType((s) => s === "name" ? "recent" : "name")}
                                                className="flex items-center gap-1 hover:text-violet-600 transition group">
                                                User Name
                                                <span className="flex flex-col gap-0.5 ml-0.5">
                                                    <svg className={`w-2.5 h-2.5 ${sortType === "name" ? "text-violet-600" : "text-slate-300 group-hover:text-slate-400"}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l8 8H4z" /></svg>
                                                    <svg className={`w-2.5 h-2.5 ${sortType === "recent" ? "text-violet-600" : "text-slate-300 group-hover:text-slate-400"}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l-8-8h16z" /></svg>
                                                </span>
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-center w-[10%] text-xs font-semibold text-slate-600 uppercase tracking-wider">KRA Assigned</th>
                                        <th className="px-4 py-3 text-left w-[16%] text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned By</th>
                                        {canManageReporting && (
                                            <th className="px-4 py-3 text-center w-[13%] text-xs font-semibold text-slate-600 uppercase tracking-wider">Reports To</th>
                                        )}
                                        <th className="px-4 py-3 text-center w-[10%] text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 flex-1 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 block">
                                    {pagedUsers.map((userData) => (
                                        <UserRow
                                            key={userData.id}
                                            userData={userData}
                                            isChecked={bulkSelected.has(userData.id)}
                                            filterStatus={filterStatus}
                                            pms_role={pms_role}
                                            canManageReporting={canManageReporting}
                                            canManagePip={canManagePip}
                                            pipSummary={getPipSummary(userPips[userData.id])}
                                            onView={openViewModal}
                                            onReporting={openReportingModal}
                                            onArchive={handleArchive}
                                            onPip={openPipModal}
                                            onToggleSelect={toggleBulkSelect}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {!tableLoading && filteredUsers.length > 0 && (
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <p className="text-xs text-slate-400">
                            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length} users
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                                    .reduce((acc, n) => {
                                        if (acc.length && n - acc[acc.length - 1] > 1) acc.push("…");
                                        acc.push(n);
                                        return acc;
                                    }, [])
                                    .map((n, idx) =>
                                        n === "…" ? (
                                            <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs">…</span>
                                        ) : (
                                            <button key={n} onClick={() => setPage(n)}
                                                className={`w-8 h-8 rounded-lg text-xs font-semibold ${
                                                    n === page ? "bg-gradient-to-r from-violet-700 to-violet-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 border border-slate-200"
                                                }`}>
                                                {n}
                                            </button>
                                        )
                                    )}
                                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                                className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                                {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>{n} per page</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* ════ Bulk Action Modal ════ */}
            {bulkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeBulkModal} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-cyan-600">
                            <div>
                                <h2 className="text-lg font-bold text-white">Assign Manager</h2>
                                <p className="text-teal-100 text-sm mt-0.5">{bulkSelected.size} user{bulkSelected.size !== 1 ? "s" : ""} selected</p>
                            </div>
                            <button onClick={closeBulkModal} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-3 max-h-[420px] overflow-y-auto">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select manager</p>
                            <div className="space-y-2">
                                {[{ id: "", name: "No manager", sub: "Clear reporting line for selected users" }, ...managers].map((m) => (
                                    <label key={m.id ?? "none"}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${bulkManagerId === (m.id ?? "") ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-teal-200 hover:bg-slate-50"}`}>
                                        <input type="radio" name="bulkManager" value={m.id ?? ""}
                                            checked={bulkManagerId === (m.id ?? "")}
                                            onChange={() => setBulkManagerId(m.id ?? "")}
                                            className="accent-teal-600" />
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!m.id ? "bg-slate-200" : "bg-gradient-to-br from-teal-400 to-cyan-500 text-white font-bold text-sm"}`}>
                                            {!m.id ? <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                : initials(m.username || m.name || "")}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">{m.name || m.full_name || m.username || "No manager"}</p>
                                            {m.sub && <p className="text-xs text-slate-400">{m.sub}</p>}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                            <button onClick={closeBulkModal} disabled={savingBulk} className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300 transition disabled:opacity-50">Cancel</button>
                            <button onClick={handleBulkManagerAssign} disabled={savingBulk}
                                className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 transition flex items-center gap-2">
                                {savingBulk ? <><Spinner size="w-4 h-4" color="border-white border-t-transparent" />Saving…</> : <>Assign Manager to {bulkSelected.size} user{bulkSelected.size !== 1 ? "s" : ""}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ Reporting Modal ════ */}
            {reportingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeReportingModal} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-cyan-600">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                                    {initials(reportingUser?.name)}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Manage Reporting Line</h2>
                                    <p className="text-teal-100 text-sm">{reportingUser?.name}</p>
                                </div>
                            </div>
                            <button onClick={closeReportingModal} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Current Reporting Line</p>
                                {reportingUser?.managerName ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-semibold text-xs">
                                            {initials(reportingUser.managerName)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">{reportingUser.managerName}</p>
                                            <p className="text-xs text-slate-400">Current manager</p>
                                        </div>
                                    </div>
                                ) : <p className="text-sm text-slate-400 italic">No manager assigned</p>}
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Assign Manager</label>
                                {managersLoading ? (
                                    <div className="flex items-center gap-3 py-3"><Spinner size="w-5 h-5" color="border-teal-400 border-t-transparent" /><span className="text-sm text-slate-400">Loading managers…</span></div>
                                ) : managers.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic">No managers found in the system.</p>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {[{ id: "", name: "No manager", sub: "Clear reporting line" }, ...managers.filter((m) => m.id !== reportingUser?.id)].map((m) => (
                                            <label key={m.id ?? "none"}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${selectedManagerId === (m.id ?? "") ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-teal-200 hover:bg-slate-50"}`}>
                                                <input type="radio" name="manager" value={m.id ?? ""}
                                                    checked={selectedManagerId === (m.id ?? "")}
                                                    onChange={() => setSelectedManagerId(m.id ?? "")}
                                                    className="accent-teal-600" />
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!m.id ? "bg-slate-200" : "bg-gradient-to-br from-teal-400 to-cyan-500 text-white font-bold text-sm"}`}>
                                                    {!m.id ? <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        : initials(m.username || m.name || "")}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">{m.name || m.full_name || m.username || "No manager"}</p>
                                                    {m.sub && <p className="text-xs text-slate-400">{m.sub}</p>}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                            <button onClick={handleAssignManager} disabled={savingManager}
                                className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition flex items-center gap-2">
                                {savingManager ? <><Spinner size="w-4 h-4" color="border-white border-t-transparent" />Saving…</> : "Save Reporting Line"}
                            </button>
                            <button onClick={closeReportingModal} className="px-6 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ KRA Modal ════ */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-violet-700 to-violet-500">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                                    {initials(selectedUser?.name)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedUser?.name}</h2>
                                    <p className="text-sm text-violet-200">KRA &amp; KPI Details</p>
                                </div>
                            </div>
                            <button onClick={closeModal} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {detailsLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-4">
                                    <Spinner />
                                    <p className="text-slate-400 text-sm">Loading details…</p>
                                </div>
                            ) : userKraDetails?.kras?.length > 0 ? (
                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 text-sm text-slate-500 pb-4 border-b border-slate-100 flex-wrap">
                                        <span><span className="font-bold text-slate-800">{userKraDetails.kras.length}</span> KRAs</span>
                                        <span className="text-slate-300">·</span>
                                        <span><span className="font-bold text-slate-800">{userKraDetails.kras.filter((k) => getKraType(k) === "job-specific").length}</span> Job Specific</span>
                                        <span className="text-slate-300">·</span>
                                        <span><span className="font-bold text-slate-800">{userKraDetails.kras.filter((k) => getKraType(k) === "organizational").length}</span> Organizational</span>
                                        <span className="text-slate-300">·</span>
                                        <span><span className="font-bold text-slate-800">{userKraDetails.kras.reduce((acc, k) => acc + (k.kpis?.length || 0), 0)}</span> KPIs</span>
                                    </div>
                                    <div className="space-y-3">
                                        {userKraDetails.kras.map((kra, index) => {
                                            const isOrg = getKraType(kra) === "organizational";
                                            const { date } = kra.assignedAt ? formatDateTime(kra.assignedAt) : { date: "N/A" };
                                            return (
                                                <div key={index} className="rounded-xl border border-slate-200 overflow-hidden">
                                                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h3 className="font-semibold text-slate-800 text-sm truncate">{kra.name}</h3>
                                                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${isOrg ? "bg-violet-50 text-violet-600" : "bg-emerald-50 text-emerald-600"}`}>
                                                                    {isOrg ? "Organizational" : "Job Specific"}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-0.5 truncate">Assigned by {kra.assignedBy || "N/A"} · {date}</p>
                                                        </div>
                                                        <span className="shrink-0 text-sm font-bold text-slate-700">{kra.weight || 0}%</span>
                                                    </div>
                                                    <div className="h-1 bg-slate-100">
                                                        <div className={`h-full ${isOrg ? "bg-violet-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, kra.weight || 0)}%` }} />
                                                    </div>
                                                    {kra.kpis?.length > 0 && (
                                                        <div className="px-4 py-3 space-y-2 border-t border-slate-100">
                                                            {kra.kpis.map((kpi, kpiIndex) => (
                                                                <div key={kpiIndex} className="flex items-center justify-between gap-3 text-sm">
                                                                    <span className="text-slate-600 truncate">{kpi.title || kpi.name || "Untitled KPI"}</span>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {(kpi.target || kpi.actual) && (
                                                                            <span className="text-xs text-slate-400">{kpi.target ?? "—"} → {kpi.actual ?? "—"}</span>
                                                                        )}
                                                                        <span className="text-xs font-semibold text-slate-500">{kpi.weight || 0}%</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <svg className="w-16 h-16 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    <p className="text-slate-500 mt-4">No KRA assigned to this user</p>
                                    <button onClick={() => { closeModal(); navigate("/pms/templates"); }}
                                        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        Assign a KRA Template
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end items-center">
                            <button onClick={closeModal} className="px-6 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ PIP Modal ════ */}
            {pipModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePipModal} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-violet-700 to-violet-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                                    {initials(pipUser?.name)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{pipForm.id ? "Manage PIP" : "Start PIP"} — {pipUser?.name}</h2>
                                    <p className="text-violet-100 text-sm">Performance Improvement Plan</p>
                                </div>
                            </div>
                            <button onClick={closePipModal} className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <form id="pip-form" onSubmit={handlePipSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Status</label>
                                        <select value={pipForm.status} onChange={(e) => setPipForm((p) => ({ ...p, status: e.target.value }))}
                                            className="w-full border border-slate-200 px-4 py-2.5 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                                            {PIP_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Outcome</label>
                                        <select value={pipForm.outcome} onChange={(e) => setPipForm((p) => ({ ...p, outcome: e.target.value }))}
                                            className="w-full border border-slate-200 px-4 py-2.5 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                                            {PIP_OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                    <div />
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Start Date</label>
                                        <input type="date" value={pipForm.startDate} required
                                            onChange={(e) => setPipForm((p) => ({ ...p, startDate: e.target.value }))}
                                            className="w-full border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Target End Date</label>
                                        <input type="date" value={pipForm.targetEndDate} required min={pipForm.startDate || undefined}
                                            onChange={(e) => { if (pipForm.startDate && e.target.value <= pipForm.startDate) return; setPipForm((p) => ({ ...p, targetEndDate: e.target.value })); }}
                                            className="w-full border border-slate-200 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">PIP Outcome</label>
                                    <textarea value={pipForm.reason} required rows={3}
                                        onChange={(e) => setPipForm((p) => ({ ...p, reason: e.target.value }))}
                                        placeholder="Describe the outcome of this PIP…"
                                        className="w-full border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">Improvement Goals</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Add one card per measurable commitment.</p>
                                        </div>
                                        <button type="button" onClick={addPipGoal}
                                            className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200 transition flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            Add Goal
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {pipForm.goals.map((goal, index) => (
                                            <PipGoalCard
                                                key={index}
                                                goal={goal}
                                                index={index}
                                                savedGoal={userPips[pipUser?.id]?.goals?.[index] || {}}
                                                employeeUpdatedAt={userPips[pipUser?.id]?.updatedAt}
                                                totalGoals={pipForm.goals.length}
                                                onUpdate={updatePipGoalField}
                                                onRemove={removePipGoal}
                                                onViewProof={fetchProofUrl} 
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Review Notes</label>
                                    <textarea value={pipForm.reviewNotes} rows={3}
                                        onChange={(e) => setPipForm((p) => ({ ...p, reviewNotes: e.target.value }))}
                                        placeholder="Overall review notes or observations…"
                                        className="w-full border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                                </div>
                            </form>
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                            <button form="pip-form" type="submit"
                                disabled={savingPip || pipSubmitting.current || !isPipDirty}
                                title={!isPipDirty ? "No changes to save" : ""}
                                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${(!isPipDirty || savingPip || pipSubmitting.current) ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-violet-600 text-white hover:bg-violet-700"}`}>
                                {savingPip ? <><Spinner size="w-4 h-4" color="border-white border-t-transparent" />Saving…</> : (pipForm.id ? "Update PIP" : "Create PIP")}
                            </button>
                            <button onClick={closePipModal} className="px-6 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <Toast toast={toast} onClose={() => setToast(null)} />
        </main>
    );
}