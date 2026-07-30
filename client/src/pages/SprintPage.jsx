import { useState, useEffect, useRef } from "react";
import { API, DATA_MUTATED_EVENT } from "../services/api";
import { useAuth } from "../context/AuthContext";
import SprintDetail from "./SprintDetail";
import { useAppDispatch, useAppSelector } from "../store/hooks.js";
import {
  fetchProjects,
  fetchSprints,
  selectProjects,
  selectProjectsStatus,
  selectSprints,
  selectSprintsStatus,
} from "../store/sharedDataSlice.js";
import Icons from "../components/Icons.jsx";

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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${styles[variant] || styles.default}`}
    >
      {label}
    </span>
  );
}

function getStatusVariant(s) {
  const m = { Active: "active", Planning: "planning", Completed: "completed" };
  return m[s] || "default";
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required = false, error, children }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="text-sm font-bold leading-none text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function SearchableProjectSelect({ projects, value, onChange, error }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const selected = projects.find((project) => String(project._id) === String(value));
  const matches = projects.filter((project) =>
    (project.name || "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm transition focus:outline-none focus:ring-2 ${error ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:border-transparent focus:ring-slate-900"}`}>
        <span className={selected ? "truncate text-slate-800" : "truncate text-slate-400"}>{selected?.name || "Choose project..."}</span>
        <svg className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2"><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div>
          <div role="listbox" className="max-h-56 overflow-y-auto p-1.5">
            {matches.length ? matches.map((project) => (
              <button key={project._id} type="button" role="option" aria-selected={String(project._id) === String(value)} onClick={() => { onChange(project._id); setOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${String(project._id) === String(value) ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}><span className="truncate">{project.name}</span>{String(project._id) === String(value) && <span className="ml-2 text-blue-600">✓</span>}</button>
            )) : <p className="px-3 py-5 text-center text-xs text-slate-400">No projects found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-[11px] font-bold text-slate-700">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SprintPage({ searchRequest }) {
  const { user, hasRole } = useAuth();
  const dispatch = useAppDispatch();
  const sprints = useAppSelector(selectSprints);
  const projects = useAppSelector(selectProjects);
  const sprintsStatus = useAppSelector(selectSprintsStatus);
  const projectsStatus = useAppSelector(selectProjectsStatus);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterProject, setFilterProject] = useState("All");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [mutationVersion, setMutationVersion] = useState(0);

  useEffect(() => {
    if (searchRequest?.type !== "sprint") return;
    setSearch(searchRequest.query || "");
    setFilterStatus("All");
    setFilterProject("All");
    setSelectedSprint(null);
  }, [searchRequest]);

  const [form, setForm] = useState({
    name: "",
    projectId: "",
    startDate: "",
    endDate: "",
    goal: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const force = mutationVersion > 0;
    dispatch(fetchSprints({ force }));
    dispatch(fetchProjects({ force }));
  }, [dispatch, mutationVersion]);

  useEffect(() => {
    const handleDataMutation = () =>
      setMutationVersion((version) => version + 1);

    window.addEventListener(DATA_MUTATED_EVENT, handleDataMutation);
    return () =>
      window.removeEventListener(DATA_MUTATED_EVENT, handleDataMutation);
  }, []);

  const refreshSprintData = async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    await Promise.all([
      dispatch(fetchSprints({ force: true })),
      dispatch(fetchProjects({ force: true })),
    ]);
    if (showIndicator) setRefreshing(false);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Sprint name is required";
    if (!form.projectId) e.projectId = "Project is required";
    if (!form.startDate) e.startDate = "Start date is required";
    if (!form.endDate) e.endDate = "End date is required";
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (start >= end) e.endDate = "End date must be after start date";
    const projectMin = selectedProject?.startDate
      ? new Date(selectedProject.startDate)
      : new Date("1970-01-01");
    if (start < projectMin)
      e.startDate = `Cannot be before project start (${projectMin.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })})`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const createSprint = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await API.post("/sprints", form);
      setSuccessMsg("Sprint created successfully!");
      setForm({
        name: "",
        projectId: "",
        startDate: "",
        endDate: "",
        goal: "",
      });
      setErrors({});
      setShowForm(false);
      await refreshSprintData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrors({
        submit: err.response?.data?.message || "Failed to create sprint",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canManage = hasRole(["ADMIN", "PM"]);
  const selectedProject = projects.find((p) => p._id === form.projectId);
  const projectMinDateStr = selectedProject?.startDate
    ? new Date(selectedProject.startDate).toISOString().split("T")[0]
    : "";

  const filteredSprints = sprints.filter((sprint) => {
    let ok = true;
    if (filterStatus !== "All") ok = ok && sprint.status === filterStatus;
    if (filterProject !== "All")
      ok = ok && sprint.projectId._id === filterProject;
    if (search.trim())
      ok =
        ok && sprint.name.toLowerCase().includes(search.trim().toLowerCase());
    return ok;
  });

  // Summary counts
  const totalSprints = sprints.length;
  const activeSprints = sprints.filter((s) => s.status === "Active").length;
  const planningSprints = sprints.filter((s) => s.status === "Planning").length;
  const doneSprints = sprints.filter((s) => s.status === "Completed").length;

  if (selectedSprint) {
    return (
      <SprintDetail
        initialSprint={sprints.find((s) => s._id === selectedSprint)}
        onBack={() => setSelectedSprint(null)}
        projects={projects}
        onSprintUpdated={async () => {
          await refreshSprintData();
          setSelectedSprint(null);
        }}
      />
    );
  }

  const isLoading = sprintsStatus === "loading" || projectsStatus === "loading";

  return (
    <div className="w-full space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sprints</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">
            {filteredSprints.length} of {totalSprints} sprint
            {totalSprints !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshSprintData(true)}
            disabled={refreshing}
            title="Refresh Sprint"
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14" 
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? "animate-spin" : ""}
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {canManage && (
            <button
              onClick={() => {
                setShowForm(true);
                setErrors({});
              }}
              className="h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition flex items-center gap-1.5"
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
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Sprint
            </button>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-4 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Total",
            value: totalSprints,
            bg: "bg-slate-900",
            text: "text-white",
            iconBg: "bg-white/10",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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
            value: activeSprints,
            bg: "bg-blue-50",
            text: "text-blue-700",
            iconBg: "bg-blue-100",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            ),
          },

          {
            label: "Plannings ",
            value: planningSprints,
            bg: "bg-amber-50",
            text: "text-amber-700",
            iconBg: "bg-amber-100",
            icon: <Icons.InProgess />,
          },

          {
            label: "Completed",
            value: doneSprints,
            bg: "bg-emerald-50",
            text: "text-emerald-700",
            iconBg: "bg-emerald-100",
            icon: (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ),
          },
].map((s, i) => (
  <div
    key={i}
    onClick={() => setFilterStatus(i === 0 ? "All" : s.label)}
    className={`
      rounded-xl border cursor-pointer
      px-3 py-2.5 transition-all duration-200
      ${
        i === 0
          ? `${s.bg} ${s.text} border-slate-800`
          : `${s.bg} border-slate-200 hover:border-slate-300`
      }
      ${
        (i === 0 ? filterStatus === "All" : filterStatus === s.label)
          ? "ring-1 ring-slate-900 border-slate-900"
          : ""
      }
    `}
  >
    <div className="flex items-center justify-between">
      <div>
        <p
          className={`text-[9px] font-bold uppercase tracking-wider ${
            i === 0 ? "text-slate-300" : "text-slate-500"
          }`}
        >
          {s.label}
        </p>

        <h3
          className={`mt-1 text-[22px] font-extrabold leading-none ${
            i === 0 ? "text-white" : "text-slate-900"
          }`}
        >
          {s.value}
        </h3>
      </div>

      <div
        className={`
          h-8 w-8 rounded-lg flex items-center justify-center
          ${s.iconBg}
          ${i === 0 ? "text-white" : s.text}
        `}
      >
        {s.icon}
      </div>
    </div>

    <div className="mt-2 flex items-center justify-between">
      <span
        className={`text-[10px] ${
          i === 0 ? "text-slate-400" : "text-slate-500"
        }`}
      >
        Sprints
      </span>

      {(i === 0 ? filterStatus === "All" : filterStatus === s.label) && (
        <span
          className={`text-[9px] font-semibold ${
            i === 0 ? "text-white" : "text-slate-700"
          }`}
        >
          ● Selected
        </span>
      )}
    </div>
  </div>
))}
      </div>

      {/* ── Search + Filters ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
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
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sprints..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition"
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
          )}
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
        >
          <option value="All">All Status</option>
          <option value="Planning">Planning </option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
        >
          <option value="All">All Projects</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
        {(filterStatus !== "All" || filterProject !== "All" || search) && (
          <button
            onClick={() => {
              setFilterStatus("All");
              setFilterProject("All");
              setSearch("");
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Success ── */}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-medium text-emerald-700 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
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

      {/* ── Sprint grid ── */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-slate-400">Loading sprints...</p>
        </div>
      ) : filteredSprints.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold text-slate-700">
            No sprints found
          </p>
          <p className="text-[12px] text-slate-400 mt-1">
            Try adjusting your filters or create a new sprint
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredSprints.map((sprint) => {
            const project = projects.find(
              (p) => p._id === sprint.projectId?._id,
            );
            const startDate = new Date(sprint.startDate).toLocaleDateString(
              "en-US",
              { year: "numeric", month: "short", day: "numeric" },
            );
            const endDate = new Date(sprint.endDate).toLocaleDateString(
              "en-US",
              { year: "numeric", month: "short", day: "numeric" },
            );
            const daysLeft = Math.ceil(
              (new Date(sprint.endDate) - new Date()) / (1000 * 60 * 60 * 24),
            );
            const totalDays = Math.ceil(
              (new Date(sprint.endDate) - new Date(sprint.startDate)) /
                (1000 * 60 * 60 * 24),
            );
            const elapsed = totalDays - daysLeft;
            const progress = Math.min(
              100,
              Math.max(0, Math.round((elapsed / totalDays) * 100)),
            );

            const statusConfig = {
              Active: {
                cls: "bg-blue-50 text-blue-700 border border-blue-200",
                dot: "#3b82f6",
              },
              Planning: {
                cls: "bg-amber-50 text-amber-700 border border-amber-200",
                dot: "#f59e0b",
              },
              Completed: {
                cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
                dot: "#10b981",
              },
            };
            const sc = statusConfig[sprint.status] || {
              cls: "bg-slate-50 text-slate-600 border border-slate-200",
              dot: "#94a3b8",
            };

            return (
              <div
                key={sprint._id}
                onClick={() => setSelectedSprint(sprint._id)}
                className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all group"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: sc.dot }}
                      />
                      <h3 className="text-[14px] font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                        {sprint.name}
                      </h3>
                    </div>
                    {project && (
                      <p className="text-[11.5px] text-slate-400 ml-4 truncate">
                        {project.name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold shrink-0 ${sc.cls}`}
                  >
                    {sprint.status}
                  </span>
                </div>

                {/* Goal */}
                <p className="text-[12.5px] text-slate-500 line-clamp-2 leading-relaxed mb-3 min-h-[38px]">
                  {sprint.goal || (
                    <span className="italic text-slate-300">
                      No sprint goal added
                    </span>
                  )}
                </p>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      Timeline Progress
                    </span>
                    <span className="text-[10.5px] font-bold text-slate-600">
                      {progress}%
                    </span>
                  </div>
                  <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${progress}%`,
                        backgroundColor:
                          sprint.status === "Completed"
                            ? "#10b981"
                            : daysLeft < 0
                              ? "#ef4444"
                              : "#3b82f6",
                      }}
                    />
                  </div>
                </div>

                {/* Date row */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[9.5px] uppercase font-semibold text-slate-400 mb-0.5">
                      Start
                    </p>
                    <p className="text-[12px] font-bold text-slate-700">
                      {startDate}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[9.5px] uppercase font-semibold text-slate-400 mb-0.5">
                      End
                    </p>
                    <p className="text-[12px] font-bold text-slate-700">
                      {endDate}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
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
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>
                      {totalDays} day{totalDays !== 1 ? "s" : ""} total
                    </span>
                  </div>
                  <span
                    className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full ${
                      sprint.status === "Completed"
                        ? "bg-emerald-50 text-emerald-600"
                        : daysLeft > 7
                          ? "bg-slate-100 text-slate-600"
                          : daysLeft > 0
                            ? "bg-amber-50 text-amber-600"
                            : "bg-red-50 text-red-600"
                    }`}
                  >
                    {sprint.status === "Completed"
                      ? "✓ Done"
                      : daysLeft > 0
                        ? `${daysLeft}d left`
                        : `${Math.abs(daysLeft)}d overdue`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Sprint Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
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
                    Create a sprint for your project
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setErrors({});
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

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
              {errors.submit && (
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
                  {errors.submit}
                </div>
              )}

              <Field label="Sprint Name" required error={errors.name}>
                <input
                  type="text"
                  value={form.name}
                  autoFocus
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Sprint 1 – Authentication"
                  className={inputCls}
                />
              </Field>

              <Field label="Project" required error={errors.projectId}>
                <SearchableProjectSelect
                  projects={projects}
                  value={form.projectId}
                  error={errors.projectId}
                  onChange={(projectId) => {
                    setForm({ ...form, projectId });
                    setErrors((current) => ({ ...current, projectId: undefined }));
                  }}
                />
                {selectedProject?.startDate && (
                  <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
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
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Project starts{" "}
                    <span className="font-semibold text-slate-600">
                      {new Date(selectedProject.startDate).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </span>
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date" required error={errors.startDate}>
                  <input
                    type="date"
                    min={projectMinDateStr}
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="End Date" required error={errors.endDate}>
                  <input
                    type="date"
                    min={form.startDate}
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Sprint Goal (optional)">
                <textarea
                  rows="3"
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  placeholder="What does this sprint aim to achieve?"
                  className={`${inputCls} resize-none min-h-[80px]`}
                />
              </Field>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowForm(false);
                  setForm({
                    name: "",
                    projectId: "",
                    startDate: "",
                    endDate: "",
                    goal: "",
                  });
                  setErrors({});
                }}
                className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={createSprint}
                disabled={submitting}
                className="h-9 px-5 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-black transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? (
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
      )}
    </div>
  );
}
