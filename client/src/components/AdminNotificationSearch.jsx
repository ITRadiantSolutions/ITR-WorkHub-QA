import { useMemo } from "react";

export default function AdminNotificationSearch({
  employees = [],
  projects = [],
  employeeId,
  onEmployeeId,
  projectId,
  onProjectId,
  statusFilter,
  onStatusFilter,
  query,
  onQuery,
  onClear,
}) {
  const activeFilterCount = useMemo(
    () =>
      [query?.trim(), employeeId, projectId, statusFilter !== "all"].filter(
        Boolean,
      ).length,
    [employeeId, projectId, query, statusFilter],
  );

  const controlClass =
    "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)_130px_auto]">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(event) => onQuery?.(event.target.value)}
            placeholder="Search title, message, activity..."
            aria-label="Search notifications"
            className={controlClass + " pl-9 pr-8"}
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery?.("")}
              aria-label="Clear notification search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 transition hover:text-slate-600"
            >
              ×
            </button>
          )}
        </div>

        <select
          value={employeeId}
          onChange={(event) => onEmployeeId?.(event.target.value)}
          aria-label="Filter by employee"
          className={controlClass}
        >
          <option value="">All employees</option>
          {employees.map((employee) => (
            <option
              key={employee._id || employee.id}
              value={employee._id || employee.id}
            >
              {employee.name || employee.email || "Unnamed employee"}
            </option>
          ))}
        </select>

        <select
          value={projectId}
          onChange={(event) => onProjectId?.(event.target.value)}
          aria-label="Filter by project"
          className={controlClass}
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name || "Unnamed project"}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => onStatusFilter?.(event.target.value)}
          aria-label="Filter by read status"
          className={controlClass}
        >
          <option value="all">All activity</option>
          <option value="unread">Unread only</option>
          <option value="read">Read only</option>
        </select>

        <button
          type="button"
          onClick={onClear}
          disabled={activeFilterCount === 0}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Clear</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}