import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { assessmentsApi, progressApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

export default function AssessmentPlayer() {
  const { courseId, type } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    assessmentsApi
      .forCourse(courseId)
      .then(async ({ data }) => {
        const matches = data.filter((a) => a.assessmentType === type);
        const chosen = matches.find((a) => a.isPublished) || matches[0];
        if (!chosen) {
          toast.error("This assessment is not available.");
          navigate(`/lms/courses/${courseId}`);
          return;
        }
        const startFn = type === "quiz" ? progressApi.startQuiz : progressApi.startAssignment;
        const { data: started } = await startFn(courseId, chosen._id);
        setAssessment({ ...chosen, ...started });
        setQuestions(started.questions || []);
      })
      .catch(() => toast.error("Failed to load assessment"))
      .finally(() => setLoading(false));
  }, [courseId, type, navigate]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const submitFn = type === "quiz" ? progressApi.submitQuiz : progressApi.submitAssignment;
      const { data } = await submitFn(courseId, assessment._id, answers);
      setResult(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  if (!assessment) return null;

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
          {!result.passed && result.canRetake && <p className="text-xs text-slate-400 mt-2">{result.remainingAttempts} attempt(s) remaining.</p>}
          <button
            onClick={() => navigate(`/lms/courses/${courseId}`)}
            className="mt-5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2"
          >
            Back to course
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{assessment.title}</h1>
        <p className="text-xs text-slate-500 mt-1">
          {assessment.durationMinutes} min · Pass at {assessment.passingPercentage}% · {questions.length} questions
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((question, qIdx) => (
          <div key={qIdx} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">
              {qIdx + 1}. {question.prompt}
            </p>
            <div className="space-y-1.5">
              {(question.options || []).map((option, oIdx) => (
                <label key={oIdx} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name={`q-${qIdx}`}
                    checked={answers[qIdx] === oIdx}
                    onChange={() => setAnswers((a) => ({ ...a, [qIdx]: oIdx }))}
                  />
                  {option.text}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        disabled={submitting || Object.keys(answers).length < questions.length}
        onClick={submit}
        className="w-full text-sm font-semibold rounded-xl py-2.5 bg-amber-600 hover:bg-amber-700 text-white disabled:bg-slate-200 disabled:text-slate-400"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}
