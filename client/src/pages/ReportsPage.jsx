import { useState, useEffect } from "react";
import { isTaskOverdue } from "../utils/taskDates";

import { useAuth } from "../context/AuthContext";
import { API } from "../services/api";
import Icons from "../components/Icons";
import { BugDetailModal } from "../components/BugComponents";
import * as XLSX from "xlsx";

function SkeletonReports() {
  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 border border-slate-200 bg-white shadow-sm"
          >
            <div className="h-3 w-24 bg-slate-200 rounded skeleton" />
            <div className="mt-4 h-7 w-16 bg-slate-200 rounded skeleton" />
            <div className="mt-2 h-3 w-20 bg-slate-200 rounded skeleton" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="h-12 bg-slate-50 border-b border-slate-100 flex items-center px-5">
              <div className="h-7 w-7 bg-slate-200 rounded-full skeleton" />
              <div className="ml-3 space-y-2 flex-1">
                <div className="h-3 w-36 bg-slate-200 rounded skeleton" />
                <div className="h-3 w-28 bg-slate-200 rounded skeleton" />
              </div>
            </div>

            <div className="p-5">
              <div className="h-56 w-full bg-slate-100 rounded-xl skeleton" />
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-12 bg-slate-50 border-b border-slate-100 skeleton" />

        <div className="p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg skeleton" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function Donut({ value, total, label, size = 80, stroke = "#00a21d" }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = size * 0.4;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={size * 0.1}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={size * 0.1}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.7s ease" }}
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={size * 0.16}
          fontWeight="700"
          fill="#0f172a"
        >
          {pct}%
        </text>
      </svg>
      {label && <p className="text-[10px] text-slate-400 mt-1">{label}</p>}
    </div>
  );
}

// ── Horizontal bar ────────────────────────────────────────────────────────────
function StatusDonut({ metrics, size = 96 }) {
  const data = [
    { label: "Done", value: metrics.done, color: "#10b981" },
    { label: "In Progress", value: metrics.inProgress, color: "#4f46e5" },
    { label: "QA Testing", value: metrics.qa, color: "#8b5cf6" },
    { label: "On Hold", value: metrics.onHold, color: "#d97706" },
    { label: "Todo", value: metrics.todo, color: "#cbd5e1" },
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size * 0.38;
  const circumference = 2 * Math.PI * radius;
  let consumed = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label="Task status distribution"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={size * 0.11}
        />
        {data.map((item) => {
          const segment = total ? (item.value / total) * circumference : 0;
          const offset = consumed;
          consumed += segment;
          return (
            <circle
              key={item.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={size * 0.11}
              strokeDasharray={`${segment} ${circumference - segment}`}
              strokeDashoffset={-offset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-800">
          {metrics.rate}%
        </span>
        <span className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
          done
        </span>
      </div>
    </div>
  );
}
function HBar({ label, value, total, color, sub }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
          <span className="text-[11px] font-bold text-slate-800">{value}</span>
        </div>
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

// ── Vertical bar chart ────────────────────────────────────────────────────────
function VBar({ data, height = 80 }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[9px] font-bold text-slate-600">{d.value}</span>
          <div
            className="w-full rounded-t transition-all duration-700"
            style={{
              height: `${Math.max((d.value / max) * (height - 20), d.value > 0 ? 4 : 0)}px`,
              backgroundColor: d.color,
            }}
          />
          <span className="text-[9px] text-slate-400 text-center leading-tight">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, Icon, warn, ok }) {
  return (
    <div className="rounded-lg p-2.5 border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </p>
        {Icon && (
          <div
            className={`w-5 h-5 rounded flex items-center justify-center ${warn ? "bg-red-50 text-red-500" : ok ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}
          >
            <Icon />
          </div>
        )}
      </div>
      <p
        className={`text-lg font-bold leading-tight ${warn ? "text-red-600" : ok ? "text-emerald-600" : "text-slate-900"}`}
      >
        {value}
      </p>
      {sub && <p className="text-[9px] mt-0.5 text-slate-400">{sub}</p>}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, variant }) {
  const s = {
    done: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    progress: "bg-blue-50 text-blue-700 border border-blue-200",
    todo: "bg-slate-50 text-slate-600 border border-slate-200",
    hold: "bg-amber-50 text-amber-700 border border-amber-200",
    qa: "bg-violet-50 text-violet-700 border border-violet-200",
    high: "bg-red-50 text-red-700 border border-red-200",
    medium: "bg-amber-50 text-amber-700 border border-amber-200",
    low: "bg-green-50 text-green-700 border border-green-200",
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    planning: "bg-violet-50 text-violet-700 border border-violet-200",
    completed: "bg-slate-100 text-slate-600 border border-slate-200",
    default: "bg-slate-50 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${s[variant] || s.default}`}
    >
      {label}
    </span>
  );
}

function statusVariant(s) {
  return (
    {
      DONE: "done",
      IN_PROGRESS: "progress",
      TODO: "todo",
      QA_TESTING: "qa",
      ON_HOLD: "hold",
      Active: "active",
      Planning: "planning",
      Completed: "completed",
    }[s] || "default"
  );
}
function priorityVariant(p) {
  return { High: "high", Medium: "medium", Low: "low" }[p] || "default";
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, icon: Icon, action, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center text-white">
              <Icon />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-slate-800">{title}</p>
            {subtitle && (
              <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Compute metrics from tasks ────────────────────────────────────────────────
function computeTaskMetrics(tasks = []) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const todo = tasks.filter((t) => t.status === "TODO").length;
  const qa = tasks.filter((t) => t.status === "QA_TESTING").length;
  const onHold = tasks.filter((t) => t.status === "ON_HOLD").length;
  const overdue = tasks.filter((t) => {
    if (!t.dueDate) return false;
    return (
      isTaskOverdue(t)
    );
  }).length;
  const highPri = tasks.filter((t) => t.priority === "High").length;
  const medPri = tasks.filter((t) => t.priority === "Medium").length;
  const lowPri = tasks.filter((t) => t.priority === "Low").length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  return {
    total,
    done,
    inProgress,
    todo,
    qa,
    onHold,
    overdue,
    highPri,
    medPri,
    lowPri,
    rate,
  };
}

// ── Developer / Employee report ───────────────────────────────────────────────
function DeveloperReport({
  tasks = [],
  projects = [],
  bugs = [],
  currentUser,
}) {
  const m = computeTaskMetrics(tasks);
  const [sortBy, setSortBy] = useState("name");
  const formatTaskStatus = (status) =>
    ({
      TODO: "Todo",
      IN_PROGRESS: "In Progress",
      QA_TESTING: "QA Testing",
      ON_HOLD: "On Hold",
      DONE: "Done",
    })[status] ||
    status ||
    "";
  const formatDate = (value) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const exportMyTasksExcel = () => {
    // =========================================================
    // TASK ROWS
    // =========================================================

    const taskRows = tasks.length
      ? tasks.map((task, index) => ({
          "#": index + 1,

          Title: task.title || "",

          Description: task.description || "",

          Project: task?.projectId?.name || task?.project?.name || "Unassigned",

          Priority: task.priority || "",

          Status: formatTaskStatus(task.status),

          Assignees:
            task.assignees?.length > 0
              ? task.assignees
                  .map((a) => (typeof a === "object" ? a.name || a.email : a))
                  .join(", ")
              : currentUser?.name || "Unassigned",

          Created: formatDate(task.createdAt),

          Due: formatDate(task.dueDate),
        }))
      : [
          {
            Title: "No tasks found",
          },
        ];

    // =========================================================
    // SUMMARY
    // =========================================================

    const summary = [
      {
        Employee: currentUser?.name || "",

        Role: currentUser?.role || "",

        "Total Tasks": m.total,

        Done: m.done,

        "In Progress": m.inProgress,

        "QA Testing": m.qa,

        "On Hold": m.onHold,
        Todo: m.todo,

        Overdue: m.overdue,

        "Completion Rate": `${m.rate}%`,
      },
    ];

    // =========================================================
    // WORKBOOK
    // =========================================================

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(summary);

    const tasksSheet = XLSX.utils.json_to_sheet(taskRows);

    // =========================================================
    // COLUMN WIDTHS
    // =========================================================

    summarySheet["!cols"] = [
      { wch: 24 },
      { wch: 18 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 10 },
      { wch: 12 },
      { wch: 18 },
    ];

    tasksSheet["!cols"] = [
      { wch: 6 }, // #
      { wch: 34 }, // Title
      { wch: 48 }, // Description
      { wch: 28 }, // Project
      { wch: 14 }, // Priority
      { wch: 18 }, // Status
      { wch: 30 }, // Assignees
      { wch: 16 }, // Created
      { wch: 16 }, // Due
    ];

    // =========================================================
    // APPEND SHEETS
    // =========================================================

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    XLSX.utils.book_append_sheet(workbook, tasksSheet, "Tasks");

    // =========================================================
    // DOWNLOAD
    // =========================================================

    XLSX.writeFile(
      workbook,
      `my_tasks_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };
  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "status")
      return (a.status || "").localeCompare(b.status || "");
    if (sortBy === "priority")
      return (a.priority || "").localeCompare(b.priority || "");
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Stat strip */}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Tasks"
          value={m.total}
          sub={`${m.rate}% done`}
          Icon={Icons.Tasks}
        />
        <StatCard
          label="Completed"
          value={m.done}
          sub="tasks finished"
          Icon={Icons.Check}
          ok
        />
        <StatCard
          label="In Progress"
          value={m.inProgress}
          sub="actively working"
          Icon={Icons.TrendUp}
        />
        <StatCard
          label="Overdue"
          value={m.overdue}
          sub="past due date"
          Icon={Icons.Alert}
          warn={m.overdue > 0}
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={exportMyTasksExcel}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-2 rounded-lg text-sm font-semibold transition"
        >
          <Icons.Download />
          Export My Tasks
        </button>
      </div>
      {/* Task overview + Project overview, side by side — was 3 separate
          charts (Completion Rate / By Status / By Priority) showing mostly
          the same status counts twice; now one card, next to Project Overview
          instead of stacked full-width below it. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <Section
          title="Task Overview"
          subtitle="Status & priority breakdown"
          icon={Icons.BarChart}
        >
          <div className="flex items-center gap-4">
            <StatusDonut metrics={m} />
            <div className="space-y-2 flex-1">
              {[
                { label: "Done", val: m.done, color: "#0f172a" },
                { label: "In Progress", val: m.inProgress, color: "#4f46e5" },
                { label: "QA Testing", val: m.qa, color: "#7c3aed" },
                { label: "On Hold", val: m.onHold, color: "#d97706" },
                { label: "Todo", val: m.todo, color: "#cbd5e1" },
                { label: "Overdue", val: m.overdue, color: "#ef4444" },
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <div
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-slate-500">{d.label}</span>
                  <span className="ml-auto font-bold text-slate-700">
                    {d.val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              By Priority
            </p>
            <HBar
              label="High"
              value={m.highPri}
              total={m.total}
              color="#dc2626"
            />
            <HBar
              label="Medium"
              value={m.medPri}
              total={m.total}
              color="#d97706"
            />
            <HBar
              label="Low"
              value={m.lowPri}
              total={m.total}
              color="#94a3b8"
            />
          </div>
        </Section>

        {/* Project overview */}
        <Section
          title="Project Overview"
          subtitle="Progress per project"
          icon={Icons.Folder}
          action={
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-slate-200 bg-white px-2.5 py-1.5 pr-7 rounded-lg text-[11px] text-slate-600 font-semibold focus:outline-none appearance-none"
              >
                <option value="name">Sort: Name</option>
                <option value="status">Sort: Status</option>
                <option value="priority">Sort: Priority</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Icons.ChevronDown />
              </div>
            </div>
          }
        >
          {projects.length === 0 ? (
            <p className="text-xs text-slate-400">No projects assigned.</p>
          ) : (
            <div className="space-y-3">
              {sortedProjects.map((p) => {
                const pt = tasks.filter(
                  (t) =>
                    (typeof t.projectId === "object"
                      ? t.projectId?._id
                      : t.projectId) === p._id,
                );
                const done = pt.filter((t) => t.status === "DONE").length;
                const pct =
                  pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
                return (
                  <div key={p._id} className="flex items-center gap-3 flex-wrap">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          p.status === "Active"
                            ? "#059669"
                            : p.status === "Planning"
                              ? "#7c3aed"
                              : "#94a3b8",
                      }}
                    />
                    <p className="text-xs font-medium text-slate-700 w-28 truncate">
                      {p.name}
                    </p>
                    <div className="flex-1 min-w-[60px] bg-slate-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-blue-600 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 w-8 text-right">
                      {pct}%
                    </span>
                    <span className="text-[10px] text-slate-400 w-12">
                      {done}/{pt.length} tasks
                    </span>
                    <Badge label={p.status} variant={statusVariant(p.status)} />
                    <Badge
                      label={p.priority}
                      variant={priorityVariant(p.priority)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* Bug summary (if bugs provided) */}
      {bugs.length > 0 && (
        <Section
          title="Bug Reports"
          subtitle={`${bugs.length} total bugs reported`}
          icon={Icons.Bug}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
            {[
              { label: "Total", v: bugs.length, color: "#0f172a" },
              {
                label: "Open",
                v: bugs.filter((b) => b.status === "OPEN").length,
                color: "#dc2626",
              },
              {
                label: "In Progress",
                v: bugs.filter((b) => b.status === "IN_PROGRESS").length,
                color: "#4f46e5",
              },
              {
                label: "Resolved",
                v: bugs.filter((b) => b.status === "RESOLVED").length,
                color: "#059669",
              },
            ].map((d, i) => (
              <div
                key={i}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"
              >
                <p className="text-xl font-bold" style={{ color: d.color }}>
                  {d.v}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{d.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Critical", color: "#dc2626", sev: "CRITICAL" },
              { label: "High", color: "#ea580c", sev: "HIGH" },
              { label: "Medium", color: "#d97706", sev: "MEDIUM" },
              { label: "Low", color: "#22c55e", sev: "LOW" },
            ].map((row) => {
              const cnt = bugs.filter((b) => b.severity === row.sev).length;
              return (
                <HBar
                  key={row.sev}
                  label={row.label}
                  value={cnt}
                  total={bugs.length}
                  color={row.color}
                />
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── QA Report ─────────────────────────────────────────────────────────────────
function QAReport({ tasks = [], bugs = [], projects = [] }) {
  const m = computeTaskMetrics(tasks);
  const bugCounts = {
    total: bugs.length,
    open: bugs.filter((b) => b.status === "OPEN").length,
    progress: bugs.filter((b) => b.status === "IN_PROGRESS").length,
    resolved: bugs.filter((b) => b.status === "RESOLVED").length,
    wontFix: bugs.filter((b) => b.status === "WONT_FIX").length,
  };

  const formatTaskStatus = (status) =>
    ({
      TODO: "Todo",
      IN_PROGRESS: "In Progress",
      QA_TESTING: "QA Testing",
      ON_HOLD: "On Hold",
      DONE: "Done",
    })[status] ||
    status ||
    "";

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const getProjectName = (task) => {
    const pid =
      typeof task?.projectId === "object"
        ? task?.projectId?._id
        : task?.projectId;
    return (
      projects.find((p) => p._id === pid || p.id === pid)?.name ||
      projects.find((p) => p._id === pid || p.id === pid)?.title ||
      "Unassigned Project"
    );
  };

  const exportQAReportExcel = () => {
    const summaryRows = [
      {
        "My Tasks": m.total,
        Done: m.done,
        "In Progress": m.inProgress,
        "QA Testing": m.qa,
        "On Hold": m.onHold,
        Todo: m.todo,
        Overdue: m.overdue,
        "Completion Rate": `${m.rate}%`,
        "Bugs Total": bugCounts.total,
        "Bugs Open": bugCounts.open,
        "Bugs In Progress": bugCounts.progress,
        "Bugs Resolved": bugCounts.resolved,
        "Bugs Won't Fix": bugCounts.wontFix,
      },
    ];

    // =========================================================
    // TASK ROWS
    // =========================================================

    const taskRows = tasks.length
      ? tasks.map((task, index) => ({
          "#": index + 1,

          Title: task.title || "",

          Description: task.description || "",

          Project:
            task.projectId?.name ||
            task.project?.name ||
            getProjectName(task) ||
            "",

          Priority: task.priority || "",

          Status: formatTaskStatus(task.status),

          Assignees:
            task.assignees?.length > 0
              ? task.assignees.map((a) => a.name || a.email).join(", ")
              : "Unassigned",

          Created: formatDate(task.createdAt),

          Due: formatDate(task.dueDate),
        }))
      : [
          {
            Title: "No task data found for QA report",
          },
        ];

    // =========================================================
    // WORKBOOK
    // =========================================================

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

    const taskSheet = XLSX.utils.json_to_sheet(taskRows);

    // =========================================================
    // BUG ROWS
    // =========================================================

    const bugRows = bugs.length
      ? bugs.map((b, index) => ({
          "#": index + 1,

          Title: b.title || b.bugTitle || "",

          Message: b.message || b.description || "",

          Task: b.taskId?.title || "",

          Project: b.taskId?.projectId?.name || "",

          "Reported By": b.reportedBy?.name || b.reporter?.name || "",

          Severity: b.severity || "",

          Status: b.status || "",

          "Created At": formatDate(b.createdAt),

          "Updated At": formatDate(b.updatedAt),
        }))
      : [];

    // =========================================================
    // APPEND SHEETS
    // =========================================================

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    XLSX.utils.book_append_sheet(workbook, taskSheet, "Tasks");

    if (bugRows.length) {
      const bugSheet = XLSX.utils.json_to_sheet(bugRows);

      XLSX.utils.book_append_sheet(workbook, bugSheet, "Bugs");
    }

    // =========================================================
    // DOWNLOAD
    // =========================================================

    XLSX.writeFile(
      workbook,
      `qa_task_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My Tasks"
          value={m.total}
          sub={`${m.rate}% done`}
          Icon={Icons.Tasks}
        />
        <StatCard
          label="Bugs Reported"
          value={bugCounts.total}
          sub="all time"
          Icon={Icons.Bug}
        />
        <StatCard
          label="Open Bugs"
          value={bugCounts.open}
          sub="need attention"
          Icon={Icons.Alert}
          warn={bugCounts.open > 0}
        />
        <StatCard
          label="Resolved"
          value={bugCounts.resolved}
          sub="bugs fixed"
          Icon={Icons.Check}
          ok
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={exportQAReportExcel}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-2 rounded-lg text-sm font-semibold transition"
        >
          <Icons.Download />
          Export QA Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Task progress */}
        <Section
          title="QA Task Progress"
          subtitle="Personal task breakdown"
          icon={Icons.Tasks}
        >
          <div className="flex items-start gap-5 mb-4">
            <StatusDonut metrics={m} size={88} />
            <div className="flex-1 space-y-2.5">
              <HBar
                label="Done"
                value={m.done}
                total={m.total}
                color="#0f172a"
              />
              <HBar
                label="In Progress"
                value={m.inProgress}
                total={m.total}
                color="#4f46e5"
              />
              <HBar
                label="QA Testing"
                value={m.qa}
                total={m.total}
                color="#7c3aed"
              />
              <HBar
                label="On Hold"
                value={m.onHold}
                total={m.total}
                color="#d97706"
              />
              <HBar
                label="Todo"
                value={m.todo}
                total={m.total}
                color="#94a3b8"
              />
              <HBar
                label="Overdue"
                value={m.overdue}
                total={m.total}
                color="#ef4444"
              />
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <Icons.TrendUp />
            <span className="text-xs font-semibold text-emerald-700">
              {m.rate}% completion rate
            </span>
          </div>
        </Section>

        {/* Bug breakdown */}
        <Section
          title="Bug Report Summary"
          subtitle="Status and severity breakdown"
          icon={Icons.Bug}
        >
          <div className="space-y-2.5 mb-4">
            <HBar
              label="Open"
              value={bugCounts.open}
              total={bugCounts.total}
              color="#dc2626"
            />
            <HBar
              label="In Progress"
              value={bugCounts.progress}
              total={bugCounts.total}
              color="#4f46e5"
            />
            <HBar
              label="Resolved"
              value={bugCounts.resolved}
              total={bugCounts.total}
              color="#059669"
            />
            <HBar
              label="Won't Fix"
              value={bugCounts.wontFix}
              total={bugCounts.total}
              color="#94a3b8"
            />
          </div>
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              Severity
            </p>
            {[
              { label: "Critical", sev: "CRITICAL", color: "#dc2626" },
              { label: "High", sev: "HIGH", color: "#ea580c" },
              { label: "Medium", sev: "MEDIUM", color: "#d97706" },
              { label: "Low", sev: "LOW", color: "#22c55e" },
            ].map((row) => (
              <HBar
                key={row.sev}
                label={row.label}
                value={bugs.filter((b) => b.severity === row.sev).length}
                total={bugCounts.total}
                color={row.color}
              />
            ))}
          </div>
        </Section>
      </div>

      {/* Project overview */}
      <Section
        title="Project Progress"
        subtitle="Task completion per project"
        icon={Icons.Folder}
      >
        {projects.length === 0 ? (
          <p className="text-xs text-slate-400">No projects assigned.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const pt = tasks.filter(
                (t) =>
                  (typeof t.projectId === "object"
                    ? t.projectId?._id
                    : t.projectId) === p._id,
              );
              const done = pt.filter((t) => t.status === "DONE").length;
              const pct =
                pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
              return (
                <div key={p._id} className="flex items-center gap-4">
                  <p className="text-xs font-medium text-slate-700 w-36 truncate">
                    {p.name}
                  </p>
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-blue-600 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 w-8 text-right">
                    {pct}%
                  </span>
                  <Badge label={p.status} variant={statusVariant(p.status)} />
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Admin Report ──────────────────────────────────────────────────────────────
function AdminReport({
  allTasks = [],
  allBugs = [],
  allProjects = [],
  allUsers = [],
  currentUser,
  employeeReportRequest,
}) {
  // Safety normalization
  allTasks = Array.isArray(allTasks) ? allTasks : [];
  allBugs = Array.isArray(allBugs) ? allBugs : [];
  allProjects = Array.isArray(allProjects) ? allProjects : [];
  allUsers = Array.isArray(allUsers) ? allUsers : [];
  const toId = (v) => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      if (typeof v._id === "string") return v._id;
      if (typeof v.id === "string") return v.id;
    }
    return null;
  };

  const getTaskAssigneeIds = (t) => {
    const ids = new Set();
    const assigneeArrays = [t?.assignees, t?.members].filter(Array.isArray);

    assigneeArrays.forEach((arr) => {
      arr.forEach((item) => {
        const id = toId(item);
        if (id) ids.add(id);
      });
    });

    [
      t?.assignee,
      t?.assignedTo,
      t?.assigneeId,
      t?.assignedToId,
      t?.developerId,
      t?.owner,
    ].forEach((item) => {
      const id = toId(item);
      if (id) ids.add(id);
    });

    return [...ids];
  };

  const taskBelongsToEmployee = (task, employeeId) =>
    getTaskAssigneeIds(task).includes(employeeId);

  const getBugReporterId = (b) => {
    const candidates = [
      b?.reportedBy,
      b?.reporter,
      b?.reportedById,
      b?.reporterId,
    ];

    for (const c of candidates) {
      const id = toId(c);
      if (id) return id;
    }

    return null;
  };

  const getProjectTeamMemberIds = (p) => {
    const arr = p?.teamMembers ?? p?.members ?? p?.team ?? [];
    if (!Array.isArray(arr)) return [];
    return arr.map((m) => toId(m)).filter(Boolean);
  };

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const getPersonName = (value) => {
    if (!value) return "";
    if (typeof value === "string") {
      return (
        allUsers.find((u) => u._id === value || u.id === value)?.name || ""
      );
    }
    return value.name || value.email || "";
  };

  const getTaskProjectId = (task) => toId(task?.projectId ?? task?.project);

  const getTaskProjectName = (task) => {
    const projectValue = task?.projectId ?? task?.project;
    if (projectValue && typeof projectValue === "object") {
      return projectValue.name || projectValue.title || "";
    }
    const projectId = getTaskProjectId(task);
    return (
      allProjects.find((p) => p._id === projectId || p.id === projectId)
        ?.name || "Unassigned Project"
    );
  };

  const getTaskAssigneeNames = (task) => {
    const names = [];
    const assignees = Array.isArray(task?.assignees) ? task.assignees : [];

    assignees.forEach((assignee) => {
      const name = getPersonName(assignee);
      if (name) names.push(name);
    });

    if (!names.length) {
      getTaskAssigneeIds(task).forEach((id) => {
        const name = allUsers.find((u) => u._id === id || u.id === id)?.name;
        if (name) names.push(name);
      });
    }

    return names.length ? [...new Set(names)].join(", ") : "Unassigned";
  };

  const formatTaskStatus = (status) =>
    ({
      TODO: "Todo",
      IN_PROGRESS: "In Progress",
      QA_TESTING: "QA Testing",
      ON_HOLD: "On Hold",
      DONE: "Done",
    })[status] ||
    status ||
    "";

  const safeFileName = (value) =>
    String(value || "employee")
      .trim()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();

  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");

  // Keep for future filters (currently not used in UI beyond state)
  void filterStatus;

  const employees = allUsers.filter((u) =>
    ["DEVELOPER", "QA", "EMPLOYEE"].includes(u.role),
  );

  useEffect(() => {
    if (!employeeReportRequest?.employeeId) return;
    const employee = employees.find(
      (item) =>
        String(item._id || item.id) ===
        String(employeeReportRequest.employeeId),
    );
    if (employee) {
      setSelectedEmp(employee);
      setEmpSearch("");
      setFilterRole("ALL");
    }
  }, [
    employeeReportRequest?.employeeId,
    employeeReportRequest?.requestId,
    allUsers,
  ]);
  const filteredEmps = employees
    .filter((e) => {
      if (filterRole !== "ALL" && e.role !== filterRole) return false;
      if (
        empSearch &&
        !e.name.toLowerCase().includes(empSearch.toLowerCase()) &&
        !e.email?.toLowerCase().includes(empSearch.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "role") return a.role.localeCompare(b.role);
      if (sortBy === "tasks") {
        const aTasks = allTasks.filter((t) =>
          taskBelongsToEmployee(t, a._id),
        ).length;
        const bTasks = allTasks.filter((t) =>
          taskBelongsToEmployee(t, b._id),
        ).length;
        return bTasks - aTasks;
      }
      return 0;
    });

  // Global metrics
  const gm = computeTaskMetrics(allTasks);
  const bugCounts = {
    total: allBugs.length,
    open: allBugs.filter((b) => b.status === "OPEN").length,
    resolved: allBugs.filter((b) => b.status === "RESOLVED").length,
    critical: allBugs.filter((b) => b.severity === "CRITICAL").length,
  };

  const empTasks = selectedEmp
    ? allTasks.filter((t) => taskBelongsToEmployee(t, selectedEmp._id))
    : [];
  const empBugs = selectedEmp
    ? allBugs.filter((b) => getBugReporterId(b) === selectedEmp._id)
    : [];
  const empProjects = selectedEmp
    ? allProjects.filter((p) =>
        getProjectTeamMemberIds(p).includes(selectedEmp._id),
      )
    : [];
  const empM = computeTaskMetrics(empTasks);
  const quickExportEmp =
    selectedEmp || (filteredEmps.length === 1 ? filteredEmps[0] : null);
  const canExportEmployeeReport = currentUser?.role === "ADMIN" || "PM";

  const exportEmployeeReportExcel = (employee) => {
    const employeeTasks = allTasks
      .filter((task) => taskBelongsToEmployee(task, employee._id))
      .sort((a, b) => {
        const projectCompare = getTaskProjectName(a).localeCompare(
          getTaskProjectName(b),
        );

        if (projectCompare !== 0) return projectCompare;

        return (a.title || "").localeCompare(b.title || "");
      });

    // =========================================================
    // METRICS
    // =========================================================

    const metrics = computeTaskMetrics(employeeTasks);

    const tasksByProject = employeeTasks.reduce((acc, task) => {
      const projectName = getTaskProjectName(task);

      if (!acc[projectName]) {
        acc[projectName] = [];
      }

      acc[projectName].push(task);

      return acc;
    }, {});

    // =========================================================
    // SUMMARY SHEET
    // =========================================================

    const summaryRows = [
      {
        "Employee Name": employee.name || "",

        Email: employee.email || "",

        Role: employee.role || "",

        "Total Tasks": metrics.total,

        Done: metrics.done,

        "In Progress": metrics.inProgress,

        "QA Testing": metrics.qa,
        "On Hold": metrics.onHold,

        Todo: metrics.todo,

        Overdue: metrics.overdue,

        "Completion Rate": `${metrics.rate}%`,
      },

      {},

      ...Object.entries(tasksByProject).map(([projectName, tasks]) => {
        const projectMetrics = computeTaskMetrics(tasks);

        return {
          Project: projectName,

          "Total Tasks": projectMetrics.total,

          Done: projectMetrics.done,

          "In Progress": projectMetrics.inProgress,

          "QA Testing": projectMetrics.qa,
          "On Hold": projectMetrics.onHold,

          Todo: projectMetrics.todo,

          Overdue: projectMetrics.overdue,

          "Completion Rate": `${projectMetrics.rate}%`,
        };
      }),
    ];

    // =========================================================
    // TASK ROWS
    // =========================================================

    const taskRows = employeeTasks.length
      ? employeeTasks.map((task, index) => ({
          "#": index + 1,

          Title: task.title || "",

          Description: task.description || "",

          Project: getTaskProjectName(task),

          Priority: task.priority || "",

          Status: formatTaskStatus(task.status),

          Assignees: getTaskAssigneeNames(task),

          Created: formatDate(task.createdAt),

          Due: formatDate(task.dueDate),

          "Created By": getPersonName(task.createdBy),
        }))
      : [
          {
            Title: "No task data found for this employee",
          },
        ];

    // =========================================================
    // WORKBOOK
    // =========================================================

    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
      skipHeader: false,
    });

    const taskSheet = XLSX.utils.json_to_sheet(taskRows, {
      skipHeader: false,
    });

    // =========================================================
    // COLUMN WIDTHS
    // =========================================================

    summarySheet["!cols"] = Array(10).fill({ wch: 18 });

    taskSheet["!cols"] = [
      { wch: 6 }, // #
      { wch: 34 }, // Title
      { wch: 48 }, // Description
      { wch: 28 }, // Project
      { wch: 14 }, // Priority
      { wch: 18 }, // Status
      { wch: 28 }, // Assignees
      { wch: 16 }, // Created
      { wch: 16 }, // Due
      { wch: 24 }, // Created By
    ];

    // =========================================================
    // APPEND SHEETS
    // =========================================================

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    XLSX.utils.book_append_sheet(workbook, taskSheet, "Project Wise Tasks");

    // =========================================================
    // DOWNLOAD
    // =========================================================

    XLSX.writeFile(
      workbook,
      `${safeFileName(employee.name)}_employee_task_report_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`,
    );
  };

  return (
    <div className="space-y-4">
      {/* Global overview */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Tasks"
          value={gm.total}
          sub={`${gm.rate}% done`}
          Icon={Icons.Tasks}
        />
        <StatCard
          label="Total Projects"
          value={allProjects.length}
          sub={`${allProjects.filter((p) => p.status === "Active").length} active`}
          Icon={Icons.Folder}
        />
        <StatCard
          label="Bug Reports"
          value={bugCounts.total}
          sub={`${bugCounts.open} open`}
          Icon={Icons.Bug}
          warn={bugCounts.open > 0}
        />
        <StatCard
          label="Team Members"
          value={employees.length}
          sub={`${allUsers.length} total users`}
          Icon={Icons.Users}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Task status chart */}
        <Section
          title="Task Overview"
          subtitle="System-wide status"
          icon={Icons.BarChart}
        >
          <div className="flex justify-center mb-3">
            <StatusDonut metrics={gm} size={88} />
          </div>
          <div className="space-y-2">
            <HBar
              label="Done"
              value={gm.done}
              total={gm.total}
              color="#059669"
            />
            <HBar
              label="In Progress"
              value={gm.inProgress}
              total={gm.total}
              color="#4f46e5"
            />
            <HBar
              label="QA Testing"
              value={gm.qa}
              total={gm.total}
              color="#7c3aed"
            />
            <HBar
              label="On Hold"
              value={gm.onHold}
              total={gm.total}
              color="#d97706"
            />
            <HBar
              label="Todo"
              value={gm.todo}
              total={gm.total}
              color="#94a3b8"
            />
            <HBar
              label="Overdue"
              value={gm.overdue}
              total={gm.total}
              color="#ef4444"
            />
          </div>
        </Section>

        {/* Priority split */}
        <Section
          title="Priority Split"
          subtitle="Across all tasks"
          icon={Icons.Alert}
        >
          <VBar
            height={100}
            data={[
              { label: "High", value: gm.highPri, color: "#dc2626" },
              { label: "Medium", value: gm.medPri, color: "#d97706" },
              { label: "Low", value: gm.lowPri, color: "#94a3b8" },
            ]}
          />
          <div className="mt-3 space-y-2">
            <HBar
              label="High"
              value={gm.highPri}
              total={gm.total}
              color="#dc2626"
            />
            <HBar
              label="Medium"
              value={gm.medPri}
              total={gm.total}
              color="#d97706"
            />
            <HBar
              label="Low"
              value={gm.lowPri}
              total={gm.total}
              color="#94a3b8"
            />
          </div>
        </Section>

        {/* Bug summary */}
        <Section
          title="Bug Summary"
          subtitle="System-wide bugs"
          icon={Icons.Bug}
        >
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: "Total", v: bugCounts.total, color: "#0f172a" },
              { label: "Open", v: bugCounts.open, color: "#dc2626" },
              { label: "Resolved", v: bugCounts.resolved, color: "#059669" },
              { label: "Critical", v: bugCounts.critical, color: "#ea580c" },
            ].map((d, i) => (
              <div
                key={i}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center"
              >
                <p className="text-lg font-bold" style={{ color: d.color }}>
                  {d.v}
                </p>
                <p className="text-[10px] text-slate-400">{d.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[
              { label: "Critical", sev: "CRITICAL", color: "#dc2626" },
              { label: "High", sev: "HIGH", color: "#ea580c" },
              { label: "Medium", sev: "MEDIUM", color: "#d97706" },
              { label: "Low", sev: "LOW", color: "#22c55e" },
            ].map((row) => (
              <HBar
                key={row.sev}
                label={row.label}
                value={allBugs.filter((b) => b.severity === row.sev).length}
                total={bugCounts.total}
                color={row.color}
              />
            ))}
          </div>
        </Section>
      </div>

      {/* ── Employee section ──────────────────────────────────────────── */}
      <Section
        title="Employee Reports"
        subtitle="Search and inspect individual performance"
        icon={Icons.Users}
        action={
          <div className="flex items-center gap-2">
            {/* Role filter */}
            <div className="relative">
              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value);
                  setSelectedEmp(null);
                }}
                className="border border-slate-200 bg-white px-2.5 py-1.5 pr-7 rounded-lg text-[11px] font-semibold text-slate-600 focus:outline-none appearance-none"
              >
                <option value="ALL">All Roles</option>
                <option value="DEVELOPER">Developer</option>
                <option value="QA">QA</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Icons.ChevronDown />
              </div>
            </div>
            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-slate-200 bg-white px-2.5 py-1.5 pr-7 rounded-lg text-[11px] font-semibold text-slate-600 focus:outline-none appearance-none"
              >
                <option value="name">Sort: Name</option>
                <option value="role">Sort: Role</option>
                <option value="tasks">Sort: Tasks</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Icons.ChevronDown />
              </div>
            </div>
          </div>
        }
      >
        {/* Employee report summary */}
        <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            {
              label: "Employees",
              value: employees.length,
              sub: `${filteredEmps.length} shown`,
              color: "bg-slate-100 text-slate-700",
            },
            {
              label: "Developers",
              value: employees.filter((item) => item.role === "DEVELOPER")
                .length,
              sub: "engineering",
              color: "bg-blue-50 text-blue-700",
            },
            {
              label: "QA Members",
              value: employees.filter((item) => item.role === "QA").length,
              sub: "quality team",
              color: "bg-violet-50 text-violet-700",
            },
            {
              label: "Assigned Tasks",
              value: allTasks.filter((task) =>
                employees.some((employee) =>
                  taskBelongsToEmployee(task, employee._id),
                ),
              ).length,
              sub: "across employees",
              color: "bg-emerald-50 text-emerald-700",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-lg border border-slate-100 px-3 py-2.5 ${item.color}`}
            >
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">
                    {item.label}
                  </p>
                  <p className="mt-1 text-lg font-bold leading-none">
                    {item.value}
                  </p>
                </div>
                <p className="text-[9px] opacity-60">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icons.Search />
          </span>
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            placeholder="Search by employee name or email..."
            value={empSearch}
            onChange={(e) => {
              setEmpSearch(e.target.value);
              setSelectedEmp(null);
            }}
          />
          {empSearch && (
            <button
              onClick={() => {
                setEmpSearch("");
                setSelectedEmp(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
              aria-label="Clear employee search"
            >
              <Icons.X />
            </button>
          )}
        </div>

        <div
          className={`grid grid-cols-1 gap-3 ${selectedEmp ? "xl:grid-cols-[300px_minmax(0,1fr)]" : ""}`}
        >
          {/* Employee list */}
          <div
            className={`grid max-h-[430px] grid-cols-1 gap-2 overflow-y-auto pr-1 ${selectedEmp ? "" : "sm:grid-cols-2 xl:grid-cols-3"}`}
          >
            {filteredEmps.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                <p className="text-xs font-semibold text-slate-600">
                  No employees found
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  Try another name, email, or role.
                </p>
              </div>
            ) : (
              filteredEmps.map((emp) => {
                const empT = allTasks.filter((task) =>
                  taskBelongsToEmployee(task, emp._id),
                );
                const doneT = empT.filter(
                  (task) => task.status === "DONE",
                ).length;
                const onHoldT = empT.filter(
                  (task) => task.status === "ON_HOLD",
                ).length;
                const overdueT = empT.filter(
                  (task) =>
                    isTaskOverdue(task),
                ).length;
                const rate = empT.length
                  ? Math.round((doneT / empT.length) * 100)
                  : 0;
                const isSelected = selectedEmp?._id === emp._id;
                const roleStyle =
                  emp.role === "QA"
                    ? "bg-violet-50 text-violet-700"
                    : emp.role === "DEVELOPER"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-slate-100 text-slate-600";
                return (
                  <button
                    key={emp._id}
                    onClick={() => setSelectedEmp(isSelected ? null : emp)}
                    className={`group flex min-w-0 flex-col rounded-xl border p-3 text-left transition-all ${isSelected ? "border-blue-700 bg-blue-700 text-white shadow-md" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-sm"}`}
                  >
                    <div className="flex w-full items-center gap-2.5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${isSelected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}
                      >
                        {emp.name?.charAt(0)?.toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-xs font-bold ${isSelected ? "text-white" : "text-slate-800"}`}
                        >
                          {emp.name}
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-[9px] ${isSelected ? "text-white/55" : "text-slate-400"}`}
                        >
                          {emp.email}
                        </span>
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${isSelected ? "bg-white/15 text-white" : roleStyle}`}
                      >
                        {emp.role === "DEVELOPER" ? "DEV" : emp.role}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                      <span
                        className={`rounded-md px-1 py-1.5 ${isSelected ? "bg-white/10" : "bg-slate-50"}`}
                      >
                        <strong className="block text-[11px]">
                          {empT.length}
                        </strong>
                        <small
                          className={`text-[8px] ${isSelected ? "text-white/50" : "text-slate-400"}`}
                        >
                          Tasks
                        </small>
                      </span>
                      <span
                        className={`rounded-md px-1 py-1.5 ${isSelected ? "bg-white/10" : "bg-amber-50"}`}
                      >
                        <strong
                          className={`block text-[11px] ${isSelected ? "" : "text-amber-700"}`}
                        >
                          {onHoldT}
                        </strong>
                        <small
                          className={`text-[8px] ${isSelected ? "text-white/50" : "text-amber-500"}`}
                        >
                          On Hold
                        </small>
                      </span>
                      <span
                        className={`rounded-md px-1 py-1.5 ${isSelected ? "bg-white/10" : overdueT ? "bg-red-50" : "bg-slate-50"}`}
                      >
                        <strong
                          className={`block text-[11px] ${isSelected ? "" : overdueT ? "text-red-600" : "text-slate-700"}`}
                        >
                          {overdueT}
                        </strong>
                        <small
                          className={`text-[8px] ${isSelected ? "text-white/50" : overdueT ? "text-red-400" : "text-slate-400"}`}
                        >
                          Overdue
                        </small>
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div
                        className={`h-1.5 flex-1 overflow-hidden rounded-full ${isSelected ? "bg-white/15" : "bg-slate-100"}`}
                      >
                        <div
                          className={`h-full rounded-full ${isSelected ? "bg-emerald-400" : "bg-emerald-500"}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span
                        className={`w-8 text-right text-[9px] font-bold ${isSelected ? "text-white/70" : "text-slate-500"}`}
                      >
                        {rate}%
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {/* Employee detail panel */}
          {selectedEmp && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {selectedEmp.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {selectedEmp.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {selectedEmp.email}
                  </p>
                </div>
                {canExportEmployeeReport && quickExportEmp && (
                  <button
                    onClick={() => exportEmployeeReportExcel(quickExportEmp)}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
                    title={`Export ${quickExportEmp.name || "employee"} task report to Excel`}
                  >
                    <Icons.Download />
                    Export Excel
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <Badge label={selectedEmp.role} variant="default" />
                  <button
                    onClick={() => setSelectedEmp(null)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition"
                  >
                    <Icons.X />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Mini stat strip */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Tasks", v: empM.total, color: "text-slate-900" },
                    { label: "Done", v: empM.done, color: "text-emerald-600" },
                    {
                      label: "Overdue",
                      v: empM.overdue,
                      color:
                        empM.overdue > 0 ? "text-red-600" : "text-slate-400",
                    },
                    {
                      label: "Rate",
                      v: `${empM.rate}%`,
                      color: "text-blue-600",
                    },
                  ].map((d, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-center"
                    >
                      <p className={`text-lg font-bold ${d.color}`}>{d.v}</p>
                      <p className="text-[10px] text-slate-400">{d.label}</p>
                    </div>
                  ))}
                </div>

                {/* Task status bars */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Task Breakdown
                  </p>
                  <div className="space-y-2">
                    <HBar
                      label="Done"
                      value={empM.done}
                      total={empM.total}
                      color="#0f172a"
                    />
                    <HBar
                      label="In Progress"
                      value={empM.inProgress}
                      total={empM.total}
                      color="#4f46e5"
                    />
                    <HBar
                      label="QA Testing"
                      value={empM.qa}
                      total={empM.total}
                      color="#8b5cf6"
                    />
                    <HBar
                      label="On Hold"
                      value={empM.onHold}
                      total={empM.total}
                      color="#d97706"
                    />{" "}
                    <HBar
                      label="Todo"
                      value={empM.todo}
                      total={empM.total}
                      color="#94a3b8"
                    />
                    <HBar
                      label="Overdue"
                      value={empM.overdue}
                      total={empM.total}
                      color="#ef4444"
                    />
                  </div>
                </div>

                {/* Bugs */}
                {empBugs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Bugs Reported ({empBugs.length})
                    </p>
                    <div className="space-y-2">
                      <HBar
                        label="Open"
                        value={
                          empBugs.filter((b) => b.status === "OPEN").length
                        }
                        total={empBugs.length}
                        color="#dc2626"
                      />
                      <HBar
                        label="Resolved"
                        value={
                          empBugs.filter((b) => b.status === "RESOLVED").length
                        }
                        total={empBugs.length}
                        color="#059669"
                      />
                    </div>
                  </div>
                )}

                {/* Projects */}
                {empProjects.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Projects ({empProjects.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {empProjects.map((p) => (
                        <div
                          key={p._id}
                          className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1"
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor:
                                p.status === "Active"
                                  ? "#059669"
                                  : p.status === "Planning"
                                    ? "#7c3aed"
                                    : "#94a3b8",
                            }}
                          />
                          <span className="text-[11px] font-medium text-slate-700">
                            {p.name}
                          </span>
                          <Badge
                            label={p.status}
                            variant={statusVariant(p.status)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent tasks */}
                {empTasks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                      Recent Tasks
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {empTasks.slice(0, 8).map((t) => (
                        <div
                          key={t._id}
                          className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-lg"
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              t.status === "DONE"
                                ? "bg-emerald-500"
                                : t.status === "IN_PROGRESS"
                                  ? "bg-blue-500"
                                  : "bg-slate-300"
                            }`}
                          />
                          <p className="text-[11px] font-medium text-slate-700 flex-1 truncate">
                            {t.title}
                          </p>
                          <Badge
                            label={t.priority}
                            variant={priorityVariant(t.priority)}
                          />
                          <Badge
                            label={t.status.replace("_", " ")}
                            variant={statusVariant(t.status)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* All projects */}
      <Section
        title="All Projects"
        subtitle="System-wide project health"
        icon={Icons.Folder}
        action={
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-slate-200 bg-white px-2.5 py-1.5 pr-7 rounded-lg text-[11px] font-semibold text-slate-600 focus:outline-none appearance-none"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Planning">Planning</option>
              <option value="Completed">Completed</option>
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Icons.ChevronDown />
            </div>
          </div>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            {
              label: "Total Projects",
              value: allProjects.length,
              color: "bg-slate-100 text-slate-700",
            },
            {
              label: "Active",
              value: allProjects.filter(
                (project) => project.status === "Active",
              ).length,
              color: "bg-emerald-50 text-emerald-700",
            },
            {
              label: "Planning",
              value: allProjects.filter(
                (project) => project.status === "Planning",
              ).length,
              color: "bg-violet-50 text-violet-700",
            },
            {
              label: "Completed",
              value: allProjects.filter(
                (project) => project.status === "Completed",
              ).length,
              color: "bg-blue-50 text-blue-700",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-lg border border-slate-100 px-3 py-2.5 ${item.color}`}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-65">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-bold leading-none">
                {item.value}
              </p>
            </div>
          ))}
        </div>
        {allProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
            <p className="text-xs font-semibold text-slate-600">
              No projects available
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Created projects will appear in this report.
            </p>
          </div>
        ) : allProjects.filter(
            (project) =>
              filterStatus === "ALL" || project.status === filterStatus,
          ).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
            <p className="text-xs font-semibold text-slate-600">
              No {filterStatus.toLowerCase()} projects
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Choose another status to view projects.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {allProjects
              .filter(
                (project) =>
                  filterStatus === "ALL" || project.status === filterStatus,
              )
              .map((project) => {
                const projectTasks = allTasks.filter(
                  (task) =>
                    String(
                      typeof task.projectId === "object"
                        ? task.projectId?._id
                        : task.projectId,
                    ) === String(project._id),
                );
                const done = projectTasks.filter(
                  (task) => task.status === "DONE",
                ).length;
                const inProgress = projectTasks.filter(
                  (task) => task.status === "IN_PROGRESS",
                ).length;
                const onHold = projectTasks.filter(
                  (task) => task.status === "ON_HOLD",
                ).length;
                const qaTesting = projectTasks.filter(
                  (task) => task.status === "QA_TESTING",
                ).length;
                const completion = projectTasks.length
                  ? Math.round((done / projectTasks.length) * 100)
                  : 0;
                const members = (project.teamMembers || []).length;
                const endDate = project.endDate
                  ? new Date(project.endDate)
                  : null;
                const statusColor =
                  project.status === "Active"
                    ? "#10b981"
                    : project.status === "Planning"
                      ? "#8b5cf6"
                      : "#4f46e5";
                return (
                  <article
                    key={project._id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-xs font-bold text-slate-800">
                          {project.name}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-[9px] text-slate-400">
                          {project.description || "No project description"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge
                          label={project.status}
                          variant={statusVariant(project.status)}
                        />
                        <Badge
                          label={project.priority}
                          variant={priorityVariant(project.priority)}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-500">
                        Task completion
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {completion}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${completion}%`,
                          backgroundColor: statusColor,
                        }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                      {[
                        {
                          label: "Tasks",
                          value: projectTasks.length,
                          style: "bg-slate-50 text-slate-700",
                        },
                        {
                          label: "Progress",
                          value: inProgress,
                          style: "bg-blue-50 text-blue-700",
                        },
                        {
                          label: "On Hold",
                          value: onHold,
                          style: "bg-amber-50 text-amber-700",
                        },
                        {
                          label: "Done",
                          value: done,
                          style: "bg-emerald-50 text-emerald-700",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`rounded-md px-1 py-1.5 ${item.style}`}
                        >
                          <strong className="block text-[11px]">
                            {item.value}
                          </strong>
                          <span className="text-[8px] opacity-65">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2.5 text-[9px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Icons.Users />
                        {members} members
                      </span>
                      <span>
                        {done}/{projectTasks.length} completed
                      </span>
                      {qaTesting > 0 && (
                        <span className="font-semibold text-violet-500">
                          {qaTesting} in QA
                        </span>
                      )}
                      <span className="ml-auto">
                        {endDate && !Number.isNaN(endDate.getTime())
                          ? `Due ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : "No end date"}
                      </span>
                    </div>
                  </article>
                );
              })}
          </div>
        )}{" "}
      </Section>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ReportsPage({
  metrics,
  projects,
  tasks,
  bugs,
  allTasks,
  allBugs,
  allProjects,
  allUsers,
  employeeReportRequest,
}) {
  const { user } = useAuth();
  const role = user?.role;
  const canSeeEmployeeReports = user?.role === "ADMIN" || user?.role === "PM";

  const [adminUsers, setAdminUsers] = useState(allUsers || []);
  const [adminProjects, setAdminProjects] = useState(
    allProjects || projects || [],
  );
  const [adminTasks, setAdminTasks] = useState(allTasks || tasks || []);
  const [adminBugs, setAdminBugs] = useState(allBugs || bugs || []);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminData() {
      // Only needed when AdminDashboard doesn't pass the heavy collections
      const needUsers = !Array.isArray(adminUsers) || adminUsers.length === 0;

      const needTasks = !Array.isArray(adminTasks) || adminTasks.length === 0;

      const needBugs = !Array.isArray(adminBugs) || adminBugs.length === 0;

      const needProjects =
        !Array.isArray(adminProjects) || adminProjects.length === 0;

      if (!(needUsers || needTasks || needBugs || needProjects)) {
        return;
      }

      setAdminLoading(true);

      try {
        const [usersRes, projectsRes, tasksRes, bugsRes] = await Promise.all([
          API.get("/users").catch(() => ({
            data: [],
          })),

          API.get("/projects").catch(() => ({
            data: [],
          })),

          API.get("/tasks").catch(() => ({
            data: [],
          })),

          API.get("/bugs").catch(() => ({
            data: [],
          })),
        ]);

        // ─────────────────────────────────────
        // Universal array normalizer
        // Handles:
        // []
        // { data: [] }
        // { users: [] }
        // { tasks: [] }
        // { projects: [] }
        // { bugs: [] }
        // ─────────────────────────────────────
        const normalizeArray = (response, possibleKeys = []) => {
          const data = response?.data;

          // Direct array
          if (Array.isArray(data)) {
            return data;
          }

          // Nested direct keys
          for (const key of possibleKeys) {
            if (Array.isArray(data?.[key])) {
              return data[key];
            }
          }

          // Generic nested data array
          if (Array.isArray(data?.data)) {
            return data.data;
          }

          // Deep nested possible keys
          for (const key of possibleKeys) {
            if (Array.isArray(data?.data?.[key])) {
              return data.data[key];
            }
          }

          return [];
        };

        const users = normalizeArray(usersRes, ["users"]);

        const projectsData = normalizeArray(projectsRes, ["projects"]);

        const tasksData = normalizeArray(tasksRes, ["tasks"]);

        const bugsData = normalizeArray(bugsRes, ["bugs"]);

        // Safety fallback
        const safeUsers = Array.isArray(users) ? users : [];

        const safeProjects = Array.isArray(projectsData) ? projectsData : [];

        const safeTasks = Array.isArray(tasksData) ? tasksData : [];

        const safeBugs = Array.isArray(bugsData) ? bugsData : [];

        if (cancelled) return;

        if (needUsers) {
          setAdminUsers(safeUsers);
        }

        if (needProjects) {
          setAdminProjects(safeProjects);
        }

        if (needTasks) {
          setAdminTasks(safeTasks);
        }

        if (needBugs) {
          setAdminBugs(safeBugs);
        }
      } catch (error) {
        console.error("Failed loading admin report data:", error);

        // Prevent UI crash
        if (!cancelled) {
          setAdminUsers([]);
          setAdminProjects([]);
          setAdminTasks([]);
          setAdminBugs([]);
        }
      } finally {
        if (!cancelled) {
          setAdminLoading(false);
        }
      }
    }

    const isAdminLike = role === "ADMIN";
    const isPmLike = role === "PM" || role === "MANAGER" || role === "HR";

    if (isAdminLike || isPmLike) {
      loadAdminData();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  void canSeeEmployeeReports;

  if (
    role === "ADMIN" ||
    role === "PM" ||
    role === "MANAGER" ||
    role === "HR"
  ) {
    if (adminLoading) {
      return (
        <div className="py-6 px-2">
          <SkeletonReports />
        </div>
      );
    }

    return (
      <AdminReport
        allTasks={adminTasks || []}
        allBugs={adminBugs || []}
        allProjects={adminProjects || []}
        allUsers={adminUsers || []}
        currentUser={user}
        employeeReportRequest={employeeReportRequest}
      />
    );
  }

  if (role === "QA") {
    return (
      <QAReport
        tasks={tasks || []}
        bugs={bugs || []}
        projects={projects || []}
      />
    );
  }

  // Developer / Employee
  return (
    <DeveloperReport
      metrics={metrics}
      tasks={tasks || []}
      projects={projects || []}
      bugs={bugs || []}
      currentUser={user}
    />
  );
}
