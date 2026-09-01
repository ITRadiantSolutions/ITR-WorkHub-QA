import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { skillTestsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

const STATUS_STYLE = {
  passed: "text-emerald-600 bg-emerald-50 border-emerald-200",
  failed: "text-amber-600 bg-amber-50 border-amber-200",
  in_progress: "text-sky-600 bg-sky-50 border-sky-200",
  not_started: "text-slate-500 bg-slate-50 border-slate-200",
};
const STATUS_LABEL = { passed: "Passed", failed: "Failed", in_progress: "In progress", not_started: "Not started" };

export default function MySkillTests() {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    skillTestsApi
      .available()
      .then((res) => setTests(res.data))
      .catch(() => toast.error("Failed to load tests"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tests</h1>
        <p className="text-xs text-slate-500 mt-0.5">Skill tests assigned to groups you belong to. Pass to earn a badge or verified skill.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tests.map((test) => (
          <div key={test._id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Icons.Target />
              </div>
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${STATUS_STYLE[test.status]}`}>{STATUS_LABEL[test.status]}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">{test.title}</h3>
            {test.description && <p className="text-[11px] text-slate-400">{test.description}</p>}
            <p className="text-[11px] text-slate-400">
              {test.durationMinutes} min ·{" "}
              {test.sections?.length ? test.sections.map((s) => `${s.count} ${s.name}`).join(" + ") : `${test.attemptSize} questions`} · pass {test.passingPercentage}%
            </p>
            <p className="text-[11px] text-slate-400">
              Attempts used: {test.attemptCount}/{test.maxAttempts}
              {test.badge ? ` · badge: ${test.badge.name}` : ""}
              {test.skill ? ` · skill: ${test.skill.name}` : ""}
            </p>
            {test.lastGrade && (
              <p className="text-[11px] font-semibold text-slate-500">
                Last: {test.lastScore}% · {test.lastGrade}
              </p>
            )}
            <button
              disabled={!test.canAttempt}
              onClick={() => navigate(`/lms/skill-tests/${test._id}/take`)}
              className="w-full text-xs font-semibold rounded-lg py-1.5 bg-amber-600 hover:bg-amber-700 text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              {test.status === "passed" ? "Passed" : test.status === "in_progress" ? "Resume" : test.canAttempt ? "Start" : "No attempts left"}
            </button>
            {(test.status === "passed" || test.status === "failed") && (
              <button
                onClick={() => navigate(`/lms/skill-tests/${test._id}/review`)}
                className="w-full text-xs font-semibold rounded-lg py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Review answers
              </button>
            )}
          </div>
        ))}
        {tests.length === 0 && <p className="text-xs text-slate-400">No tests assigned to you yet.</p>}
      </div>
    </div>
  );
}
