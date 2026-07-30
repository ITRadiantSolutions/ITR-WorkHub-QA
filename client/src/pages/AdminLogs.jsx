import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_ORIGIN = import.meta.env.VITE_API_URL || "http://localhost:5000";
const LOGS_PAGE_SIZE = 20;

/* ─────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────── */
const PATHS = {
  back: "M15 18l-6-6 6-6",
  refresh:
    "M20 11a8.1 8.1 0 00-15.5-2M4 4v5h5m-5 4a8.1 8.1 0 0015.5 2M20 20v-5h-5",
  check: "M20 6L9 17l-5-5",
  warning:
    "M12 9v4m0 4h.01M10.3 3.7L2.4 18a2 2 0 001.8 3h15.6a2 2 0 001.8-3L13.7 3.7a2 2 0 00-3.4 0z",
  database:
    "M20 6c0 1.7-3.6 3-8 3S4 7.7 4 6s3.6-3 8-3 8 1.3 8 3zm0 0v6c0 1.7-3.6 3-8 3s-8-1.3-8-3V6m16 6v6c0 1.7-3.6 3-8 3s-8-1.3-8-3v-6",
  cloud: "M17.5 19H6a4 4 0 01-.4-8 6.5 6.5 0 0112.5-1.7A5 5 0 0117.5 19z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  clock: "M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z",
  search: "M21 21l-4.4-4.4m2.4-5.1a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  server:
    "M20 9V7a2 2 0 00-2-2H6a2 2 0 00-2 2v2m16 0a2 2 0 010 4H4a2 2 0 010-4m16 0H4m4 4h.01M12 17h.01M16 17h.01",
  filter: "M3 4h18M7 8h10M10 12h4M13 16h-2",
  x: "M18 6L6 18M6 6l12 12",
  eye: "M1 12S4.6 5 12 5s11 7 11 7-3.6 7-11 7S1 12 1 12zm11 3a3 3 0 100-6 3 3 0 000 6z",
  chevronDown: "M6 9l6 6 6-6",
  info: "M12 16v-4m0-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z",
};

function Icon({ name, className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ─────────────────────────────────────────────────
   FORMATTERS
───────────────────────────────────────────────── */
const formatTime = (value) => {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
};
const formatRelativeTime = (value) => {
  if (!value) return "";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return fmt.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return fmt.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return fmt.format(hours, "hour");
  return fmt.format(Math.round(hours / 24), "day");
};
const formatDuration = (ms) => {
  const v = Number(ms) || 0;
  if (v < 1000) return `${v} ms`;
  if (v < 60000) return `${(v / 1000).toFixed(1)}s`;
  if (v < 3600000) return `${(v / 60000).toFixed(1)}m`;
  return `${(v / 3600000).toFixed(1)}h`;
};
const changePreview = (changes) => {
  if (!changes || typeof changes !== "object")
    return "No field details recorded";
  const keys = Object.keys(changes);
  if (!keys.length) return "No field details recorded";
  return (
    keys.slice(0, 4).join(", ") +
    (keys.length > 4 ? ` +${keys.length - 4} more` : "")
  );
};

/* ─────────────────────────────────────────────────
   STYLE MAPS
───────────────────────────────────────────────── */
const METHOD_STYLES = {
  GET: "bg-sky-50 text-sky-700 ring-sky-200",
  POST: "bg-violet-50 text-violet-700 ring-violet-200",
  PUT: "bg-amber-50 text-amber-700 ring-amber-200",
  PATCH: "bg-orange-50 text-orange-700 ring-orange-200",
  DELETE: "bg-rose-50 text-rose-700 ring-rose-200",
};
const LEVEL_STYLES = {
  info: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  error: "bg-rose-50 text-rose-700 ring-rose-200",
};
const TYPE_LEFT_BORDER = {
  api: "border-l-sky-400",
  database: "border-l-violet-400",
  cloud: "border-l-cyan-400",
  server: "border-l-orange-400",
  audit: "border-l-slate-400",
  change: "border-l-fuchsia-400",
};

/* ─────────────────────────────────────────────────
   SKELETON ROW
───────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[40, 24, 64, 20, 20, 28].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div
            className={`h-3.5 rounded-full bg-slate-100`}
            style={{ width: `${w}%` }}
          />
          {i === 0 && (
            <div className="mt-1.5 h-2.5 w-16 rounded-full bg-slate-100" />
          )}
        </td>
      ))}
    </tr>
  );
}

/* ─────────────────────────────────────────────────
   METRIC CARD
───────────────────────────────────────────────── */
function MetricCard({ label, value, sub, icon, color }) {
  const colors = {
    blue: {
      wrap: "bg-blue-50 text-blue-600",
      bar: "bg-blue-500",
      ring: "ring-blue-100",
    },
    emerald: {
      wrap: "bg-emerald-50 text-emerald-600",
      bar: "bg-emerald-500",
      ring: "ring-emerald-100",
    },
    rose: {
      wrap: "bg-rose-50 text-rose-600",
      bar: "bg-rose-500",
      ring: "ring-rose-100",
    },
    violet: {
      wrap: "bg-violet-50 text-violet-600",
      bar: "bg-violet-500",
      ring: "ring-violet-100",
    },
  };
  const c = colors[color] || colors.blue;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div
        className={`absolute top-0 left-0 h-1 w-full ${c.bar} opacity-60 rounded-t-2xl`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 leading-none">
            {value}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-slate-500">{sub}</p>
        </div>
        <span
          className={`shrink-0 rounded-xl p-2.5 ring-1 ${c.wrap} ${c.ring}`}
        >
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────
   SERVICE PILL
───────────────────────────────────────────────── */
function ServicePill({ name, value, icon, detail }) {
  const ok = value === "connected" || value === "configured";
  return (
    <article className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`rounded-xl p-2.5 ${ok ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
        >
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-800">{name}</p>
          <p className="text-[11px] text-slate-400">{detail}</p>
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold capitalize ${ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${ok ? "animate-pulse bg-emerald-500" : "bg-rose-500"}`}
        />
        {(value || "unknown").replaceAll("_", " ")}
      </span>
    </article>
  );
}

/* ─────────────────────────────────────────────────
   CHANGE CARD
───────────────────────────────────────────────── */
function ChangeCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const ts = log.createdAt || log.timestamp;
  const code = Number(log.statusCode);
  const ok = code < 400;
  const actor = log.actorName || log.actor?.name || log.userName || "System";
  const role = log.actorRole || log.actor?.role || log.userRole || "SYSTEM";

  return (
    <article className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 hover:border-fuchsia-200 hover:bg-fuchsia-50/20 transition-colors duration-200">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-sm font-black text-fuchsia-700">
          {actor.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-800 truncate">
                {actor}
              </p>
              <p className="text-[10px] font-semibold text-fuchsia-600 uppercase tracking-wide">
                {role}
              </p>
            </div>
            <span
              className={`shrink-0 text-[10px] font-black rounded-full px-2 py-0.5 ${ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
            >
              {ok ? "OK" : code || "ERR"}
            </span>
          </div>

          <p className="mt-2 text-[13px] font-semibold text-slate-700 leading-snug">
            {log.action || `${log.method} ${log.path}`}
          </p>
          <p className="mt-1 text-[11px] text-slate-400 truncate">
            {changePreview(log.changes)}
          </p>

          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 truncate pr-3">
              {log.path}
            </span>
            <span className="shrink-0 text-[10px] text-slate-400">
              {formatRelativeTime(ts)}
            </span>
          </div>

          {log.changes && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-fuchsia-600 hover:text-fuchsia-800 transition-colors"
            >
              <Icon name="eye" className="h-3 w-3" />
              {expanded ? "Hide" : "View"} changes
              <Icon
                name="chevronDown"
                className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
          {expanded && log.changes && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-slate-900 p-3 text-[10px] leading-4 text-slate-200 whitespace-pre-wrap">
              {JSON.stringify(log.changes, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────
   LOG TABLE ROW
───────────────────────────────────────────────── */
function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const ts = log.createdAt || log.timestamp;
  const code = Number(log.statusCode);
  const isFailed = code >= 500 || log.level === "error";
  const isWarning = code >= 400 && code < 500;
  const borderClass = TYPE_LEFT_BORDER[log.type] || "border-l-slate-300";

  return (
    <>
      <tr
        className={`group border-l-2 ${borderClass} transition-colors hover:bg-slate-50/80 cursor-pointer`}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Time */}
        <td className="whitespace-nowrap px-4 py-3.5">
          <p className="text-[12px] font-semibold text-slate-700">
            {formatTime(ts)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">
            {formatRelativeTime(ts)}
          </p>
        </td>

        {/* Method + Type */}
        <td className="px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {log.method ? (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ring-1 ${METHOD_STYLES[log.method] || "bg-slate-50 text-slate-600 ring-slate-200"}`}
              >
                {log.method}
              </span>
            ) : (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ring-1 ${LEVEL_STYLES[log.level] || "bg-slate-50 text-slate-600 ring-slate-200"}`}
              >
                {log.level?.toUpperCase()}
              </span>
            )}
            <span className="text-[10px] font-semibold capitalize text-slate-400">
              {log.type}
            </span>
          </div>
        </td>

        {/* Endpoint / Event */}
        <td className="px-4 py-3.5 max-w-xs">
          <p className="text-[12px] font-semibold text-slate-800 truncate">
            {log.action || log.path || log.event || "System operation"}
          </p>
          {log.error?.message && (
            <p className="mt-0.5 text-[11px] text-rose-500 line-clamp-1">
              {log.error.message}
            </p>
          )}
        </td>

        {/* Status */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isFailed
                ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                : isWarning
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isFailed ? "bg-rose-500" : isWarning ? "bg-amber-400" : "bg-emerald-500"}`}
            />
            {log.statusCode || (isFailed ? "Error" : isWarning ? "Warn" : "OK")}
          </span>
        </td>

        {/* Duration */}
        <td className="px-4 py-3.5 whitespace-nowrap">
          {log.durationMs != null ? (
            <div>
              <p
                className={`text-[12px] font-bold ${
                  log.durationMs > 1000
                    ? "text-rose-600"
                    : log.durationMs > 500
                      ? "text-amber-600"
                      : "text-slate-700"
                }`}
              >
                {log.durationMs} ms
              </p>
              {log.cacheStatus && log.cacheStatus !== "BYPASS" ? (
                <p
                  className={`mt-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    log.cacheStatus === "HIT"
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }`}
                >
                  Cache {log.cacheStatus.toLowerCase()}
                </p>
              ) : null}
              <div className="mt-1 h-1 w-16 rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${log.durationMs > 1000 ? "bg-rose-400" : log.durationMs > 500 ? "bg-amber-400" : "bg-emerald-400"}`}
                  style={{
                    width: `${Math.min(100, (log.durationMs / 2000) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-slate-300">—</span>
          )}
        </td>

        {/* User */}
        <td className="px-4 py-3.5">
          <p className="text-[12px] font-bold text-slate-700">
            {log.actorName || log.actor?.name || log.userName || "System"}
          </p>
          <p className="text-[10px] text-slate-400 capitalize truncate max-w-[90px]">
            {log.actorRole || log.actor?.role || log.userRole || "Automated"}
          </p>
        </td>

        {/* Expand toggle */}
        <td className="px-4 py-3.5">
          <span
            className={`text-slate-300 transition-transform duration-200 inline-block ${expanded ? "rotate-180" : ""} group-hover:text-slate-500`}
          >
            <Icon name="chevronDown" className="h-3.5 w-3.5" />
          </span>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded &&
        (log.error?.message || (log.type === "change" && log.changes)) && (
          <tr className={`border-l-2 ${borderClass} bg-slate-50/70`}>
            <td colSpan={7} className="px-4 py-3">
              {log.error?.message && (
                <div className="mb-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
                  <p className="text-[11px] font-bold text-rose-700 mb-1">
                    Error detail
                  </p>
                  <p className="text-[12px] text-rose-600">
                    {log.error.message}
                  </p>
                </div>
              )}
              {log.type === "change" && log.changes && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                    Changed values
                  </p>
                  <pre className="max-h-40 overflow-auto rounded-xl bg-slate-900 p-3 text-[10px] leading-4 text-slate-200 whitespace-pre-wrap">
                    {JSON.stringify(log.changes, null, 2)}
                  </pre>
                </div>
              )}
            </td>
          </tr>
        )}
    </>
  );
}

/* ─────────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────────── */
function SectionHeader({ title, sub, badge, badgeColor = "slate" }) {
  const colors = {
    slate: "bg-slate-100 text-slate-600",
    violet: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
    sky: "bg-sky-50 text-sky-700",
    fuchsia: "bg-fuchsia-50 text-fuchsia-700",
  };
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-[15px] font-black text-slate-900">{title}</h2>
        {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
      </div>
      {badge && (
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${colors[badgeColor]}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────── */
export default function AdminLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [services, setServices] = useState({});
  const [generatedAt, setGeneratedAt] = useState(null);
  const [deployment, setDeployment] = useState({ current: null, history: [] });
  const [storage, setStorage] = useState("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [changeSearch, setChangeSearch] = useState("");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [visibleLogCount, setVisibleLogCount] = useState(LOGS_PAGE_SIZE);

  const loadLogs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_ORIGIN}/api/admin/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1000 },
      });
      setLogs(response.data.logs || []);
      setServices(response.data.services || {});
      setGeneratedAt(response.data.generatedAt);
      setDeployment(response.data.deployment || { current: null, history: [] });
      setStorage(response.data.storage || "unknown");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load audit logs. Confirm the backend is running.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => loadLogs({ silent: true }), 30000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadLogs]);

  const metrics = useMemo(() => {
    const apiLogs = logs.filter((l) => l.type === "api");
    const successful = apiLogs.filter((l) => Number(l.statusCode) < 400);
    const clientErrors = apiLogs.filter((l) => {
      const c = Number(l.statusCode);
      return c >= 400 && c < 500;
    });
    const failed = apiLogs.filter((l) => Number(l.statusCode) >= 500);
    const durations = apiLogs
      .map((l) => Number(l.durationMs))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const average = durations.length
      ? Math.round(durations.reduce((s, v) => s + v, 0) / durations.length)
      : 0;
    const p95 = durations.length
      ? durations[
          Math.min(Math.ceil(durations.length * 0.95) - 1, durations.length - 1)
        ]
      : 0;
    return {
      total: apiLogs.length,
      successful: successful.length,
      clientErrors: clientErrors.length,
      failed: failed.length,
      successRate: apiLogs.length
        ? ((successful.length / apiLogs.length) * 100).toFixed(1)
        : "0.0",
      average,
      p95,
    };
  }, [logs]);

  const failedEndpoints = useMemo(() => {
    const endpointStates = new Map();
    const newestFirst = logs
      .filter((log) => log.type === "api")
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.timestamp) -
          new Date(a.createdAt || a.timestamp),
      );

    newestFirst.forEach((log) => {
      const normalizedPath = String(log.path || "Unknown").replace(
        /\/[0-9a-fA-F]{24}(?=\/|$)/g,
        "/:id",
      );
      const key = `${log.method || "API"} ${normalizedPath}`;
      const current = endpointStates.get(key);

      if (!current) {
        endpointStates.set(key, {
          key,
          method: log.method,
          path: normalizedPath,
          count: Number(log.statusCode) >= 500 ? 1 : 0,
          lastStatus: log.statusCode,
          lastSeen: log.createdAt || log.timestamp,
        });
      } else if (Number(log.statusCode) >= 500) {
        current.count += 1;
      }
    });

    // Historical failures disappear as soon as the endpoint succeeds again.
    return [...endpointStates.values()]
      .filter((endpoint) => Number(endpoint.lastStatus) >= 500)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [logs]);
  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const code = Number(log.statusCode);
      const statusMatch =
        !status ||
        (status === "success" && code < 400) ||
        (status === "client" && code >= 400 && code < 500) ||
        (status === "failed" && (code >= 500 || log.level === "error"));
      const searchMatch =
        !term ||
        [
          log.method,
          log.path,
          log.event,
          log.statusCode,
          log.userRole,
          log.userId,
          log.error?.message,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      return (
        (!type || log.type === type) &&
        (!level || log.level === level) &&
        statusMatch &&
        searchMatch
      );
    });
  }, [logs, search, type, level, status]);
  const paginatedLogs = useMemo(
    () => visibleLogs.slice(0, visibleLogCount),
    [visibleLogs, visibleLogCount],
  );
  const hasMoreLogs = paginatedLogs.length < visibleLogs.length;

  useEffect(() => {
    setVisibleLogCount(LOGS_PAGE_SIZE);
  }, [search, type, level, status]);

  const displayedDeployment =
    deployment.azureProduction ||
    deployment.azure ||
    deployment.production ||
    deployment.current;
  const hasFilters = search || type || level || status;
  const clearFilters = () => {
    setSearch("");
    setType("");
    setLevel("");
    setStatus("");
  };

  return (
    <main className="min-h-screen bg-[#f4f6fb]">
      {/* ─── HEADER ──────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              aria-label="Back"
            >
              <Icon name="back" className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">
                  System Audit
                </h1>
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                  Admin
                </span>
                {autoRefresh && (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                API • Database • Cloud • Server — all in one view
                {generatedAt && ` · Updated ${formatRelativeTime(generatedAt)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              Auto-refresh
            </label>
            <button
              type="button"
              onClick={() => loadLogs()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Icon
                name="refresh"
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 md:px-8">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-bold">Could not load system logs</p>
              <p className="mt-0.5 text-[12px]">{error}</p>
            </div>
          </div>
        )}

        {/* ─── METRIC CARDS ───────────────────────────────── */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="API Calls"
            value={metrics.total.toLocaleString()}
            sub="Recorded requests"
            icon="activity"
            color="blue"
          />
          <MetricCard
            label="Successful"
            value={metrics.successful.toLocaleString()}
            sub={`${metrics.successRate}% success rate`}
            icon="check"
            color="emerald"
          />
          <MetricCard
            label="Active Failures"
            value={failedEndpoints.length.toLocaleString()}
            sub={`${metrics.failed} recorded server errors · ${metrics.clientErrors} client errors`}
            icon="warning"
            color={failedEndpoints.length > 0 ? "rose" : "emerald"}
          />
          <MetricCard
            label="Avg Response"
            value={`${metrics.average} ms`}
            sub={`95th percentile: ${metrics.p95} ms`}
            icon="clock"
            color="violet"
          />
        </section>

        {/* ─── SERVICES ───────────────────────────────────── */}
        <section className="grid gap-3 lg:grid-cols-2">
          <ServicePill
            name="MongoDB Database"
            value={services.database}
            icon="database"
            detail="Current application connection"
          />
          <ServicePill
            name="Azure Blob Storage"
            value={services.azureBlobStorage}
            icon="cloud"
            detail="Attachment storage configuration"
          />
        </section>

        {/* ─── DEPLOYMENT + STORAGE ───────────────────────── */}
        <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          {/* Deployment card */}
          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 px-5 py-5 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
                  {displayedDeployment?.provider === "azure"
                    ? "Latest Azure Production Deployment"
                    : "Latest Deployment"}
                </p>
                <h2 className="mt-1.5 text-2xl font-black">
                  {displayedDeployment?.version || "Awaiting data"}
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-400">
                  {displayedDeployment?.environment || "Unknown environment"}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  displayedDeployment?.status === "running"
                    ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                    : "bg-white/10 text-slate-300 ring-1 ring-white/20"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${displayedDeployment?.status === "running" ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`}
                />
                {displayedDeployment?.status || "Not tracked"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
              {[
                [
                  "Last deployed",
                  displayedDeployment?.deployedAt
                    ? formatTime(displayedDeployment.deployedAt)
                    : "—",
                ],
                [
                  "Startup",
                  displayedDeployment
                    ? formatDuration(displayedDeployment.startupDurationMs)
                    : "—",
                ],
                [
                  "Downtime",
                  displayedDeployment
                    ? formatDuration(displayedDeployment.downtimeMs)
                    : "—",
                ],
                [
                  "Heartbeat",
                  displayedDeployment?.lastHeartbeatAt
                    ? formatRelativeTime(displayedDeployment.lastHeartbeatAt)
                    : "—",
                ],
              ].map(([lbl, val]) => (
                <div key={lbl} className="bg-white px-4 py-3.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {lbl}
                  </p>
                  <p className="mt-1 text-[13px] font-black text-slate-800">
                    {val}
                  </p>
                </div>
              ))}
            </div>
          </article>

          {/* Storage card */}
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <SectionHeader
              title="Audit Storage"
              sub="Where operational records are retained"
              badge={storage === "mongodb" ? "MongoDB" : "File fallback"}
              badgeColor={storage === "mongodb" ? "emerald" : "slate"}
            />
            <div className="rounded-xl bg-slate-50 p-4 flex items-center gap-3">
              <span className="rounded-lg bg-blue-100 p-2 text-blue-700">
                <Icon name="database" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-bold text-slate-800">
                  audit_logs
                </p>
                <p className="text-[11px] text-slate-500">
                  Persistent MongoDB collection
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <Icon
                name="shield"
                className="h-4 w-4 shrink-0 text-slate-400 mt-0.5"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Credentials, tokens, passwords, cookies, and attachment content
                are automatically redacted before storage.
              </p>
            </div>
          </article>
        </section>

        {/* ─── CHANGE MONITOR ─────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <SectionHeader
            title="Admin & PM Change Monitor"
            sub="Who changed what, where, and whether it succeeded"
            badge={`${logs.filter((l) => l.type === "change").length} changes`}
            badgeColor="fuchsia"
          />
          <label className="relative mb-4 block max-w-xl">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              value={changeSearch}
              onChange={(event) => setChangeSearch(event.target.value)}
              placeholder="Search person, role, endpoint, or changed field…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[12px] outline-none transition focus:border-fuchsia-400 focus:bg-white focus:ring-2 focus:ring-fuchsia-100"
            />
          </label>
          {(() => {
            const term = changeSearch.trim().toLowerCase();
            const changeLogs = logs
              .filter((l) => l.type === "change")
              .filter((log) => {
                if (!term) return true;
                return [
                  log.actorName,
                  log.actorEmail,
                  log.actorRole,
                  log.method,
                  log.action,
                  log.path,
                  log.route,
                  log.projectName,
                  log.ticketNo,
                  ...(log.bodyKeys || []),
                  ...Object.keys(log.changes || {}),
                ].some((value) =>
                  String(value || "").toLowerCase().includes(term),
                );
              })
              .slice(0, 6);
            return changeLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                <Icon
                  name="activity"
                  className="mx-auto h-8 w-8 text-slate-300"
                />
                <p className="mt-2 text-[13px] font-bold text-slate-500">
                  No changes recorded yet
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Create, update, and delete actions will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {changeLogs.map((log, i) => (
                  <ChangeCard
                    key={`${log.createdAt || log.timestamp}-${i}`}
                    log={log}
                  />
                ))}
              </div>
            );
          })()}
        </section>

        {/* ─── API HEALTH + FAILED ENDPOINTS ──────────────── */}
        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          {/* API health */}
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <SectionHeader
              title="API Health Overview"
              sub={`Outcome breakdown for ${metrics.total.toLocaleString()} recorded requests`}
              badge={`${metrics.successRate}% healthy`}
              badgeColor={
                Number(metrics.successRate) >= 95 ? "emerald" : "rose"
              }
            />
            {/* Segmented bar */}
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 flex">
              {metrics.total > 0 && (
                <>
                  <div
                    style={{
                      width: `${(metrics.successful / metrics.total) * 100}%`,
                    }}
                    className="bg-emerald-500"
                    title={`${metrics.successful.toLocaleString()} successful requests`}
                  />
                  <div
                    style={{
                      width: `${(metrics.clientErrors / metrics.total) * 100}%`,
                    }}
                    className="bg-amber-400"
                    title={`${metrics.clientErrors.toLocaleString()} client errors (4xx)`}
                  />
                  <div
                    style={{
                      width: `${(metrics.failed / metrics.total) * 100}%`,
                    }}
                    className="bg-rose-500"
                    title={`${metrics.failed.toLocaleString()} server errors (5xx)`}
                  />
                </>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                {
                  label: "Successful (2xx–3xx)",
                  value: metrics.successful,
                  dot: "bg-emerald-500",
                  bg: "bg-emerald-50",
                  text: "text-emerald-800",
                },
                {
                  label: "Client errors (4xx)",
                  value: metrics.clientErrors,
                  dot: "bg-amber-400",
                  bg: "bg-amber-50",
                  text: "text-amber-800",
                },
                {
                  label: "Server errors (5xx)",
                  value: metrics.failed,
                  dot: "bg-rose-500",
                  bg: "bg-rose-50",
                  text: "text-rose-800",
                },
              ].map(({ label, value, dot, bg, text }) => (
                <div key={label} className={`rounded-xl ${bg} p-3 text-center`}>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    <span className={`text-[10px] font-bold ${text}`}>
                      {label}
                    </span>
                  </div>
                  <p className={`mt-1.5 text-2xl font-black ${text}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </article>

          {/* Failed endpoints */}
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <SectionHeader
              title="Endpoints Needing Attention"
              sub="Most frequent server failures (5xx)"
              badge={
                failedEndpoints.length > 0
                  ? `${failedEndpoints.length} flagged`
                  : undefined
              }
              badgeColor="rose"
            />
            {failedEndpoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-50 py-10 text-center text-emerald-700">
                <Icon name="check" className="h-7 w-7 mb-2" />
                <p className="text-[13px] font-bold">
                  All clear — no failed endpoints
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {failedEndpoints.map((ep) => (
                  <div
                    key={ep.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1 py-0.5 text-[9px] font-black ring-1 ${METHOD_STYLES[ep.method] || "bg-slate-100 text-slate-600 ring-slate-200"}`}
                        >
                          {ep.method}
                        </span>
                        <p className="text-[12px] font-semibold text-slate-800 truncate">
                          {ep.path}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Last seen {formatRelativeTime(ep.lastSeen)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-700 ring-1 ring-rose-200">
                        {ep.lastStatus}
                      </span>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">
                        {ep.count}×
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        {/* ─── ALL OPERATIONS LOG TABLE ────────────────────── */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {/* Table header / filters */}
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[15px] font-black text-slate-900">
                  All Operations
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Showing {paginatedLogs.length.toLocaleString()} of{" "}
                  {visibleLogs.length.toLocaleString()} matching records
                </p>
              </div>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Icon name="x" className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1fr_160px_140px_160px]">
              <label className="relative">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search endpoint, event, user, error…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[12px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </label>
              {[
                {
                  value: type,
                  onChange: (e) => setType(e.target.value),
                  placeholder: "All operations",
                  opts: [
                    ["", "All operations"],
                    ["api", "API requests"],
                    ["database", "Database"],
                    ["cloud", "Cloud storage"],
                    ["server", "Server"],
                    ["audit", "Audit system"],
                  ],
                },
                {
                  value: level,
                  onChange: (e) => setLevel(e.target.value),
                  placeholder: "All levels",
                  opts: [
                    ["", "All levels"],
                    ["info", "Information"],
                    ["warn", "Warning"],
                    ["error", "Error"],
                  ],
                },
                {
                  value: status,
                  onChange: (e) => setStatus(e.target.value),
                  placeholder: "All outcomes",
                  opts: [
                    ["", "All outcomes"],
                    ["success", "Success (2xx)"],
                    ["client", "Client errors (4xx)"],
                    ["failed", "Failed (5xx)"],
                  ],
                },
              ].map((sel, i) => (
                <select
                  key={i}
                  value={sel.value}
                  onChange={sel.onChange}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-700 outline-none focus:border-blue-400 focus:bg-white"
                >
                  {sel.opts.map(([val, lbl]) => (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  ))}
                </select>
              ))}
            </div>

            {/* Type legend */}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { type: "api", label: "API", cls: "bg-sky-100 text-sky-700" },
                {
                  type: "database",
                  label: "Database",
                  cls: "bg-violet-100 text-violet-700",
                },
                {
                  type: "cloud",
                  label: "Cloud",
                  cls: "bg-cyan-100 text-cyan-700",
                },
                {
                  type: "server",
                  label: "Server",
                  cls: "bg-orange-100 text-orange-700",
                },
                {
                  type: "change",
                  label: "Change",
                  cls: "bg-fuchsia-100 text-fuchsia-700",
                },
                {
                  type: "audit",
                  label: "Audit",
                  cls: "bg-slate-200 text-slate-600",
                },
              ].map(({ type: t, label, cls }) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(type === t ? "" : t)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-transparent transition-all ${cls} ${type === t ? "ring-current" : "opacity-60 hover:opacity-100"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${TYPE_LEFT_BORDER[t]?.replace("border-l-", "bg-")}`}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-100 bg-slate-50/80">
                <tr>
                  {[
                    "Date & Time",
                    "Operation",
                    "Endpoint / Event",
                    "Status",
                    "Response",
                    "User",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}

                {!loading && visibleLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Icon name="search" className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-[13px] font-bold text-slate-600">
                        No matching records
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Try changing or clearing the active filters.
                      </p>
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedLogs.map((log, i) => (
                    <LogRow
                      key={`${log.createdAt || log.timestamp}-${i}`}
                      log={log}
                    />
                  ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!loading && visibleLogs.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400">
                Showing {paginatedLogs.length.toLocaleString()} of{" "}
                {visibleLogs.length.toLocaleString()} records · Auto-refresh
                every 30 s
              </p>
              {hasMoreLogs && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleLogCount((count) => count + LOGS_PAGE_SIZE)
                  }
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[11px] font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                >
                  Load 20 more
                </button>
              )}
              <div className="flex gap-4 text-[10px] font-bold text-slate-400">
                {[
                  { color: "bg-sky-400", label: "API" },
                  { color: "bg-violet-400", label: "Database" },
                  { color: "bg-orange-400", label: "Server" },
                  { color: "bg-fuchsia-400", label: "Change" },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={`h-2 w-1 rounded-sm ${color}`} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
