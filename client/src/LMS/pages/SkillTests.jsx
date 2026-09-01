import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { skillTestsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

export default function SkillTests() {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    skillTestsApi
      .allAdmin()
      .then((res) => setTests(res.data))
      .catch(() => toast.error("Failed to load tests"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const removeTest = async (testId) => {
    if (!window.confirm("Delete this test?")) return;
    try {
      await skillTestsApi.remove(testId);
      toast.success("Test deleted");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete test");
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Manage Tests</h1>
          <p className="text-xs text-slate-500 mt-0.5">Standalone skill tests — MCQ and fill-in-the-blank, sampled per attempt so retries differ.</p>
        </div>
        <button
          onClick={() => navigate("/lms/manage-skill-tests/new")}
          className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3.5 py-2"
        >
          <Icons.Plus /> New Test
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tests.map((test) => (
          <div key={test._id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              {test.isPublished ? (
                <span className="text-[10px] font-bold text-emerald-600">Published</span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400">Draft</span>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900">{test.title}</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {test.questionPool.length} questions in pool ·{" "}
              {test.sections?.length ? test.sections.map((s) => `${s.count} ${s.name}`).join(" + ") : `${test.attemptSize}`} per attempt · pass {test.passingPercentage}%
            </p>
            <p className="text-[11px] text-slate-400">
              {test.skillGroups.length} group{test.skillGroups.length === 1 ? "" : "s"} assigned
              {test.badge ? ` · badge: ${test.badge.name}` : ""}
              {test.skill ? ` · skill: ${test.skill.name}` : ""}
            </p>
            {test.availableAt && new Date(test.availableAt) > new Date() && (
              <p className="text-[11px] font-semibold text-amber-600">🔒 Opens {new Date(test.availableAt).toLocaleString()}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => navigate(`/lms/manage-skill-tests/${test._id}`)}
                className="flex-1 text-xs font-semibold rounded-lg py-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                Edit
              </button>
              <button
                onClick={() => navigate(`/lms/manage-skill-tests/${test._id}/results`)}
                className="flex-1 text-xs font-semibold rounded-lg py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Results
              </button>
              <button onClick={() => removeTest(test._id)} className="text-xs font-semibold rounded-lg py-1.5 px-3 border border-red-200 text-red-600 hover:bg-red-50">
                <Icons.Trash />
              </button>
            </div>
          </div>
        ))}
        {tests.length === 0 && <p className="text-xs text-slate-400">No tests yet — create one above.</p>}
      </div>
    </div>
  );
}
