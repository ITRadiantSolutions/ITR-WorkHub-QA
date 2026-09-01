import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { skillTestsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

const STATUS_STYLE = {
  passed: "text-emerald-700 bg-emerald-50 border-emerald-200",
  failed: "text-red-600 bg-red-50 border-red-200",
  in_progress: "text-sky-600 bg-sky-50 border-sky-200",
  not_started: "text-slate-500 bg-slate-50 border-slate-200",
};
const STATUS_LABEL = { passed: "Passed", failed: "Failed", in_progress: "In progress", not_started: "Not started" };
const FILTERS = [
  ["all", "All"],
  ["not_started", "Not started"],
  ["in_progress", "In progress"],
  ["passed", "Passed"],
  ["failed", "Failed"],
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function SkillTestResults() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    skillTestsApi
      .results(testId)
      .then((res) => setData(res.data))
      .catch((error) => {
        toast.error(error.response?.data?.message || "Failed to load results");
        navigate("/lms/manage-skill-tests");
      })
      .finally(() => setLoading(false));
  }, [testId, navigate]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (needle && !`${r.name} ${r.email} ${r.department}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, filter, q]);

  const exportCsv = () => {
    const head = ["Name", "Email", "Department", "Designation", "Status", "Attempts", "Best %", "Last %", "Grade", "Sections", "Last attempt"];
    const lines = data.rows.map((r) =>
      [
        r.name,
        r.email,
        r.department,
        r.designation,
        STATUS_LABEL[r.status],
        `${r.attempts}/${data.test.maxAttempts}`,
        r.bestScore ?? "",
        r.lastScore ?? "",
        r.grade,
        r.sectionBreakdown.map((s) => `${s.name} ${s.correct}/${s.total}`).join(" | "),
        r.lastAttemptAt ? new Date(r.lastAttemptAt).toISOString().slice(0, 10) : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.test.title.replace(/[^\w-]+/g, "_")}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  if (!data) return null;

  const s = data.summary;

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/lms/manage-skill-tests")} className="text-slate-400 hover:text-slate-600">
          <Icons.Back />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">{data.test.title} — Results</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.test.groups.length ? `Groups: ${data.test.groups.join(", ")}` : "No groups assigned"} · pass {data.test.passingPercentage}%
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!data.rows.length}
          className="flex items-center gap-1.5 text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg px-3 py-2 disabled:opacity-50"
        >
          <Icons.Download /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat label="Eligible" value={s.eligible} />
        <Stat label="Attempted" value={`${s.attempted}/${s.eligible}`} />
        <Stat label="Not started" value={s.notStarted} tone={s.notStarted ? "amber" : "slate"} />
        <Stat label="Passed" value={s.passed} tone="emerald" />
        <Stat label="Failed" value={s.failed} tone={s.failed ? "red" : "slate"} />
        <Stat label="Avg best %" value={s.avgScore ?? "—"} />
      </div>

      {Object.keys(s.gradeDistribution).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(s.gradeDistribution).map(([g, n]) => (
            <span key={g} className="text-[11px] font-semibold rounded-full bg-slate-900 text-white px-2.5 py-1">
              {g}: {n}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-[11px] font-semibold rounded-full px-3 py-1 border ${
              filter === key ? "bg-amber-600 border-amber-600 text-white" : "bg-white border-slate-200 text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / email / dept"
          className="ml-auto text-xs rounded-lg border border-slate-200 px-3 py-1.5 w-56"
        />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="px-4 py-2.5 font-semibold">Employee</th>
              <th className="px-3 py-2.5 font-semibold">Department</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Attempts</th>
              <th className="px-3 py-2.5 font-semibold">Best %</th>
              <th className="px-3 py-2.5 font-semibold">Grade</th>
              <th className="px-3 py-2.5 font-semibold">Sections</th>
              <th className="px-3 py-2.5 font-semibold">Last attempt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-slate-800">{r.name}</div>
                  <div className="text-[11px] text-slate-400">{r.email}</div>
                </td>
                <td className="px-3 py-2.5 text-slate-500">{r.department || "—"}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  {r.attempts}/{data.test.maxAttempts}
                </td>
                <td className="px-3 py-2.5 font-semibold text-slate-700">{r.bestScore != null ? `${r.bestScore}%` : "—"}</td>
                <td className="px-3 py-2.5 text-slate-600">{r.grade || "—"}</td>
                <td className="px-3 py-2.5 text-slate-500">
                  {r.sectionBreakdown.length ? r.sectionBreakdown.map((x) => `${x.name} ${x.correct}/${x.total}`).join(" · ") : "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-500">{fmtDate(r.lastAttemptAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No employees match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TONE = {
  slate: "text-slate-900",
  emerald: "text-emerald-600",
  red: "text-red-600",
  amber: "text-amber-600",
};

function Stat({ label, value, tone = "slate" }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p>
      <p className={`text-lg font-bold ${TONE[tone]}`}>{value}</p>
    </div>
  );
}
