import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { skillTestsApi } from "../lmsApi.js";
import SkillTestReviewList from "../SkillTestReviewList.jsx";
import Icons from "../../components/Icons.jsx";

export default function SkillTestReview() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    skillTestsApi
      .review(testId)
      .then((res) => setData(res.data))
      .catch((error) => {
        toast.error(error.response?.data?.message || "No completed attempt to review");
        navigate("/lms/skill-tests");
      })
      .finally(() => setLoading(false));
  }, [testId, navigate]);

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  if (!data) return null;

  return (
    <div className="p-6 sm:p-8 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/lms/skill-tests")} className="text-slate-400 hover:text-slate-600">
          <Icons.Back />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{data.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Attempt #{data.attemptNo} · {data.score}% ({data.correct}/{data.total} correct)
            {data.grade ? ` · ${data.grade}` : ""}
          </p>
        </div>
      </div>

      {data.sectionBreakdown?.length > 0 && (
        <p className="text-xs text-slate-400">{data.sectionBreakdown.map((s) => `${s.name} ${s.correct}/${s.total}`).join(" · ")}</p>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
        <SkillTestReviewList review={data.review} />
      </div>
    </div>
  );
}
