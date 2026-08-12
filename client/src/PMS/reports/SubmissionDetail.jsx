import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { API } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../components/StatusBadge";

const STATUS_LABELS = {
  draft: "Draft",
  pending_manager_approval: "Pending manager approval",
  manager_approved: "Manager approved",
  employee_submitted: "Submitted — awaiting review",
  final_employee_submitted: "Final self-review submitted",
  manager_reviewed: "Reviewed — your turn",
  final_manager_reviewed: "Review complete",
};

const STATUS_TONE = {
  draft: "neutral",
  pending_manager_approval: "warning",
  manager_approved: "info",
  employee_submitted: "warning",
  final_employee_submitted: "warning",
  manager_reviewed: "violet",
  final_manager_reviewed: "success",
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

  const updateResponse = (index, field, value) => {
    setSubmission((prev) => ({
      ...prev,
      kraResponses: prev.kraResponses.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
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
    <main className="max-w-4xl mx-auto px-6 py-8">
      <button onClick={() => navigate("/pms/reviews")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-[18px] h-[18px]" /> Back to Reviews
      </button>

        {loading || !submission ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{submission.employeeId?.name || "Review"}</h2>
                <p className="text-xs text-slate-500">{submission.employeeId?.email}</p>
              </div>
              <StatusBadge
                tone={STATUS_TONE[submission.status] || "neutral"}
                label={STATUS_LABELS[submission.status] || submission.status}
                size="md"
              />
            </div>

            {(submission.kraResponses || []).map((r, index) => {
              const kpis = (r.kpis || []).filter((k) => k.title?.trim() || k.description?.trim());
              const showManagerCol = isManagerOrHr || r.managerResponse;
              return (
                <div key={index} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900 text-sm">{r.kraName}</h3>
                    <span className="text-xs font-semibold text-slate-400 shrink-0">Weight: {r.weight}%</span>
                  </div>

                  {kpis.length > 0 && (
                    <ul className="mb-3 space-y-0.5">
                      {kpis.map((k, i) => (
                        <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                          <span className="text-violet-400 mt-0.5">•</span>
                          <span>{k.title}{k.description ? ` — ${k.description}` : ""}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className={`grid grid-cols-1 gap-3 ${showManagerCol ? "md:grid-cols-2" : ""}`}>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Your response</label>
                        {isEmployee && <RatingPicker value={r.rating} onChange={(v) => updateResponse(index, "rating", v)} disabled={!canEditResponses} />}
                      </div>
                      <textarea
                        value={r.response || ""}
                        onChange={(e) => updateResponse(index, "response", e.target.value)}
                        disabled={!canEditResponses}
                        rows={2}
                        placeholder={canEditResponses ? "Describe your progress against this KRA..." : "No response yet"}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </div>

                    {showManagerCol && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-violet-600 uppercase tracking-wide">Manager response</label>
                          {isManagerOrHr && <RatingPicker value={r.managerRating} onChange={(v) => updateResponse(index, "managerRating", v)} disabled={!isManagerOrHr} />}
                        </div>
                        <textarea
                          value={r.managerResponse || ""}
                          onChange={(e) => updateResponse(index, "managerResponse", e.target.value)}
                          disabled={!isManagerOrHr}
                          rows={2}
                          placeholder={isManagerOrHr ? "Add your feedback..." : "No manager feedback yet"}
                          className="w-full rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2 text-sm disabled:text-slate-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isManagerOrHr && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <h3 className="font-bold text-slate-900 text-sm mb-3">Final report</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Overall summary</label>
                    <textarea
                      value={finalReport.managerOverallResponse}
                      onChange={(e) => setFinalReport((p) => ({ ...p, managerOverallResponse: e.target.value }))}
                      rows={2}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Overall rating</label>
                      <RatingPicker value={Number(finalReport.overallRating) || null} onChange={(v) => setFinalReport((p) => ({ ...p, overallRating: v }))} />
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
  );
}
