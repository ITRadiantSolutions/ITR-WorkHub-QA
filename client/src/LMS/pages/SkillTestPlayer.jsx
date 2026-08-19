import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { skillTestsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

export default function SkillTestPlayer() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const startAttempt = () => {
    setLoading(true);
    setResult(null);
    setAnswers({});
    skillTestsApi
      .start(testId)
      .then(({ data }) => setAttempt(data))
      .catch((error) => {
        toast.error(error.response?.data?.message || "Failed to start test");
        navigate("/lms/skill-tests");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    startAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data } = await skillTestsApi.submit(testId, answers);
      setResult(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  if (result) {
    return (
      <div className="p-6 sm:p-8 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-8 text-center">
          <span className={`inline-flex mx-auto mb-3 ${result.passed ? "text-emerald-500" : "text-amber-500"}`}>
            {result.passed ? <Icons.CheckCircle /> : <Icons.Alert />}
          </span>
          <h2 className="text-lg font-bold text-slate-900">{result.passed ? "You passed!" : "Not quite there"}</h2>
          <p className="text-sm text-slate-500 mt-1">
            Score: {result.score}% ({result.correct}/{result.total} correct)
          </p>
          {result.badgeAwarded && <p className="text-xs font-semibold text-amber-600 mt-2">🏅 Badge earned: {result.badge?.name}</p>}
          {result.skillAwarded && <p className="text-xs font-semibold text-amber-600 mt-1">✨ Skill verified: {result.skill?.name}</p>}

          {!result.passed && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-500">{result.message}</p>
              {result.reviewCoursesUrl && (
                <button
                  onClick={() => navigate(result.reviewCoursesUrl)}
                  className="text-xs font-semibold text-amber-600 hover:underline"
                >
                  Review your assigned courses
                </button>
              )}
              {result.canRetake ? (
                <p className="text-xs text-slate-400">{result.remainingAttempts} attempt(s) remaining.</p>
              ) : (
                <p className="text-xs text-slate-400">No attempts remaining.</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mt-5">
            {!result.passed && result.canRetake && (
              <button onClick={startAttempt} className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2">
                Retry
              </button>
            )}
            <button onClick={() => navigate("/lms/skill-tests")} className="text-xs font-semibold text-slate-500 rounded-lg px-4 py-2 border border-slate-200">
              Back to Tests
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!attempt) return null;

  const answeredCount = attempt.questions.filter((q) => {
    const value = answers[String(q._id)];
    return value !== undefined && value !== "";
  }).length;

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{attempt.title}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {attempt.durationMinutes} min · Attempt #{attempt.attemptNo} · {attempt.questions.length} questions
        </p>
      </div>

      <div className="space-y-4">
        {attempt.questions.map((question, qIdx) => {
          const key = String(question._id);
          return (
            <div key={key} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">
                {qIdx + 1}. {question.prompt}
              </p>
              {question.type === "mcq" ? (
                <div className="space-y-1.5">
                  {(question.options || []).map((option, oIdx) => (
                    <label key={oIdx} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="radio" name={`q-${key}`} checked={answers[key] === oIdx} onChange={() => setAnswers((a) => ({ ...a, [key]: oIdx }))} />
                      {option.text}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  value={answers[key] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                  placeholder="Your answer"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2"
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        disabled={submitting || answeredCount < attempt.questions.length}
        onClick={submit}
        className="w-full text-sm font-semibold rounded-xl py-2.5 bg-amber-600 hover:bg-amber-700 text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}
