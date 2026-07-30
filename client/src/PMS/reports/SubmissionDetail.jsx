import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import PmsSubnav from "../../components/PmsSubnav";
import Icons from "../../components/Icons";

const STATUS_LABELS = {
  draft: "Draft",
  pending_manager_approval: "Pending manager approval",
  manager_approved: "Manager approved",
  employee_submitted: "Submitted — awaiting review",
  final_employee_submitted: "Final self-review submitted",
  manager_reviewed: "Reviewed — your turn",
  final_manager_reviewed: "Review complete",
};

function RatingPicker({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`w-7 h-7 rounded-lg text-xs font-bold border transition ${
            value === n
              ? "bg-violet-600 border-violet-600 text-white"
              : "border-slate-200 text-slate-400 hover:border-slate-300"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalReport, setFinalReport] = useState({ managerOverallResponse: "", overallRating: "", oneOnOneComment: "" });

  const load = () => {
    setLoading(true);
    API.get(`/pms/submissions/${id}`)
      .then((res) => {
        setSubmission(res.data);
        setFinalReport({
          managerOverallResponse: res.data.finalReport?.managerOverallResponse || "",
          overallRating: res.data.finalReport?.overallRating || "",
          oneOnOneComment: res.data.finalReport?.oneOnOneComment || "",
        });
      })
      .catch(() => toast.error("Failed to load submission"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const isEmployee = submission && String(submission.employeeId?._id || submission.employeeId) === String(user?._id || user?.id);
  const isManagerOrHr = submission && (String(submission.managerId) === String(user?._id || user?.id) || user?.roles?.pms === "hr");
  const canEditResponses = isEmployee && ["draft", "manager_reviewed"].includes(submission?.status);

  const updateResponse = (kraId, field, value) => {
    setSubmission((prev) => ({
      ...prev,
      kraResponses: prev.kraResponses.map((r) => (r.kraId === kraId ? { ...r, [field]: value } : r)),
    }));
  };

  const saveResponses = async () => {
    setSaving(true);
    try {
      await API.put(`/pms/submissions/${id}/responses`, { kraResponses: submission.kraResponses });
      toast.success("Saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    setSaving(true);
    try {
      await API.put(`/pms/submissions/${id}/responses`, { kraResponses: submission.kraResponses });
      await API.post(`/pms/submissions/${id}/employee-submit`);
      toast.success("Submitted for review");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  const saveManagerReview = async () => {
    setSaving(true);
    const kraReviews = submission.kraResponses.map((r) => ({
      kraId: r.kraId,
      managerResponse: r.managerResponse,
      managerRating: r.managerRating,
    }));
    try {
      await API.post(`/pms/submissions/${id}/manager-review`, { kraReviews });
      toast.success("Review saved");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  const saveFinalReport = async () => {
    setSaving(true);
    try {
      await API.patch(`/pms/submissions/${id}/final-report`, {
        ...finalReport,
        overallRating: Number(finalReport.overallRating) || null,
        managerSubmitted: true,
      });
      toast.success("Final report saved");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save final report");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-100">
      <PmsSubnav />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
          <Icons.Back /> Back
        </button>

        {loading || !submission ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{submission.employeeId?.name || "Review"}</h2>
                <p className="text-xs text-slate-500">{submission.employeeId?.email}</p>
              </div>
              <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">
                {STATUS_LABELS[submission.status] || submission.status}
              </span>
            </div>

            {(submission.kraResponses || []).map((r) => (
              <div key={r.kraId} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-900">{r.kraName}</h3>
                  <span className="text-xs font-semibold text-slate-400">Weight: {r.weight}%</span>
                </div>

                {r.kpis?.length > 0 && (
                  <ul className="mb-3 space-y-1">
                    {r.kpis.map((k, i) => (
                      <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                        <span className="text-violet-400 mt-0.5">•</span>
                        <span>{k.title}{k.description ? ` — ${k.description}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Your response</label>
                      {isEmployee && <RatingPicker value={r.rating} onChange={(v) => updateResponse(r.kraId, "rating", v)} disabled={!canEditResponses} />}
                    </div>
                    <textarea
                      value={r.response || ""}
                      onChange={(e) => updateResponse(r.kraId, "response", e.target.value)}
                      disabled={!canEditResponses}
                      rows={3}
                      placeholder={canEditResponses ? "Describe your progress against this KRA..." : "No response yet"}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>

                  {(isManagerOrHr || r.managerResponse) && (
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-violet-600 uppercase tracking-wide">Manager response</label>
                        {isManagerOrHr && <RatingPicker value={r.managerRating} onChange={(v) => updateResponse(r.kraId, "managerRating", v)} disabled={!isManagerOrHr} />}
                      </div>
                      <textarea
                        value={r.managerResponse || ""}
                        onChange={(e) => updateResponse(r.kraId, "managerResponse", e.target.value)}
                        disabled={!isManagerOrHr}
                        rows={2}
                        placeholder={isManagerOrHr ? "Add your feedback..." : "No manager feedback yet"}
                        className="w-full rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2 text-sm disabled:text-slate-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isManagerOrHr && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="font-bold text-slate-900 mb-3">Final report</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Overall summary</label>
                    <textarea
                      value={finalReport.managerOverallResponse}
                      onChange={(e) => setFinalReport((p) => ({ ...p, managerOverallResponse: e.target.value }))}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Overall rating</label>
                      <RatingPicker value={Number(finalReport.overallRating) || null} onChange={(v) => setFinalReport((p) => ({ ...p, overallRating: v }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">1:1 notes</label>
                    <textarea
                      value={finalReport.oneOnOneComment}
                      onChange={(e) => setFinalReport((p) => ({ ...p, oneOnOneComment: e.target.value }))}
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <button onClick={saveFinalReport} disabled={saving} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold">
                    Save final report
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pb-8">
              {canEditResponses && (
                <>
                  <button onClick={saveResponses} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold">
                    Save draft
                  </button>
                  <button onClick={submitForReview} disabled={saving} className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow">
                    Submit for review
                  </button>
                </>
              )}
              {isManagerOrHr && ["employee_submitted", "final_employee_submitted"].includes(submission.status) && (
                <button onClick={saveManagerReview} disabled={saving} className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow">
                  Complete review
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
