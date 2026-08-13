import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Save, Send, CheckCircle2, Lock, ClipboardList } from "lucide-react";
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

const initials = (name) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

function StarPicker({ value, onChange, disabled, tone = "amber" }) {
  const active = tone === "violet" ? "text-violet-500 fill-violet-500" : "text-amber-400 fill-amber-400";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
        >
          <Star className={`w-[18px] h-[18px] transition-colors ${(value || 0) >= n ? active : "text-slate-200"}`} />
        </button>
      ))}
      {value > 0 && <span className="text-xs font-semibold text-slate-400 ml-1">{value}/5</span>}
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
  // The employee has to submit their self-rating before the manager's side
  // opens up — "draft" is the only status that means they haven't yet.
  const canManagerRespond = isManagerOrHr && submission?.status !== "draft";

  const totalKras = submission?.kraResponses?.length || 0;
  const completedKras = useMemo(
    () => (submission?.kraResponses || []).filter((r) => r.response?.trim() && r.rating > 0).length,
    [submission],
  );
  const completionPct = totalKras > 0 ? Math.round((completedKras / totalKras) * 100) : 0;

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
    <div className="min-h-screen bg-[#F5F7FB]">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={() => navigate("/pms/reviews")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-[18px] h-[18px]" /> Back to Reviews
        </button>

        {loading || !submission ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-white shadow-sm overflow-hidden"
            >
              <div className="p-5 bg-gradient-to-r from-violet-50/70 to-white flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center shrink-0">
                    {initials(submission.employeeId?.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{submission.employeeId?.name || "Review"}</h2>
                    <p className="text-xs text-slate-500 truncate">{submission.employeeId?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {totalKras > 0 && (
                    <div className="hidden sm:flex items-center gap-2 text-sm">
                      <div className="w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500" style={{ width: `${completionPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{completedKras}/{totalKras} KRAs</span>
                    </div>
                  )}
                  <StatusBadge tone={STATUS_TONE[submission.status] || "neutral"} label={STATUS_LABELS[submission.status] || submission.status} size="md" />
                </div>
              </div>
            </motion.div>

            {isManagerOrHr && !canManagerRespond && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
                <Lock className="w-4 h-4 shrink-0" />
                Waiting for {submission.employeeId?.name || "the employee"} to submit their self-review before you can rate or respond.
              </div>
            )}

            {(submission.kraResponses || []).map((r, index) => {
              const kpis = (r.kpis || []).filter((k) => k.title?.trim() || k.description?.trim());
              const showManagerCol = isManagerOrHr || r.managerResponse;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" />
                      <h3 className="font-semibold text-slate-800 text-sm truncate">{r.kraName}</h3>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 rounded-full px-2.5 py-0.5 shrink-0">
                      {r.weight}% weight
                    </span>
                  </div>

                  {kpis.length > 0 && (
                    <div className="px-4 py-2.5 flex flex-wrap gap-1.5 border-b border-slate-100">
                      {kpis.map((k, i) => (
                        <span key={i} className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                          {k.title}
                          {k.description ? ` — ${k.description}` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={`grid grid-cols-1 gap-4 p-4 ${showManagerCol ? "md:grid-cols-2" : ""}`}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Your response</label>
                        {isEmployee && <StarPicker value={r.rating} onChange={(v) => updateResponse(index, "rating", v)} disabled={!canEditResponses} />}
                      </div>
                      <textarea
                        value={r.response || ""}
                        onChange={(e) => updateResponse(index, "response", e.target.value)}
                        disabled={!canEditResponses}
                        rows={3}
                        placeholder={canEditResponses ? "Describe your progress against this KRA..." : "No response yet"}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>

                    {showManagerCol && (
                      <div className="space-y-2 md:border-l md:border-slate-100 md:pl-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-violet-600 uppercase tracking-wide">Manager response</label>
                          {isManagerOrHr && <StarPicker value={r.managerRating} onChange={(v) => updateResponse(index, "managerRating", v)} disabled={!canManagerRespond} tone="violet" />}
                        </div>
                        <textarea
                          value={r.managerResponse || ""}
                          onChange={(e) => updateResponse(index, "managerResponse", e.target.value)}
                          disabled={!canManagerRespond}
                          rows={3}
                          placeholder={canManagerRespond ? "Add your feedback..." : isManagerOrHr ? "Waiting for the employee's self-review..." : "No manager feedback yet"}
                          className="w-full rounded-xl border border-violet-100 bg-violet-50/30 px-3.5 py-2.5 text-sm disabled:text-slate-400"
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {isManagerOrHr && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800 text-sm">Final report</h3>
                </div>
                <div className="p-4">
                  {!canManagerRespond ? (
                    <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3 text-xs font-semibold text-amber-700">
                      <Lock className="w-4 h-4 shrink-0" />
                      Waiting for the employee to submit their self-review before you can add a final report.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Overall summary</label>
                        <textarea
                          value={finalReport.managerOverallResponse}
                          onChange={(e) => setFinalReport((p) => ({ ...p, managerOverallResponse: e.target.value }))}
                          rows={3}
                          placeholder="Summarize overall performance for this cycle..."
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Overall rating</label>
                          <StarPicker value={Number(finalReport.overallRating) || null} onChange={(v) => setFinalReport((p) => ({ ...p, overallRating: v }))} tone="violet" />
                          {submission.finalReport?.employeeAvg != null && submission.finalReport?.managerAvg != null && (
                            <p className="text-[11px] text-slate-400 mt-1">
                              Suggested from self ({submission.finalReport.employeeAvg.toFixed(1)}) + manager ({submission.finalReport.managerAvg.toFixed(1)}) averages — adjust if needed.
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">1:1 notes</label>
                          <textarea
                            value={finalReport.oneOnOneComment}
                            onChange={(e) => setFinalReport((p) => ({ ...p, oneOnOneComment: e.target.value }))}
                            rows={2}
                            placeholder="Notes from your 1:1 discussion..."
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={saveFinalReport}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold shadow disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Save final report
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {(canEditResponses || (isManagerOrHr && ["employee_submitted", "final_employee_submitted"].includes(submission.status))) && (
              <div className="sticky bottom-4 z-10 flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-lg px-4 py-3">
                {canEditResponses && (
                  <>
                    <button
                      onClick={saveResponses}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" /> Save draft
                    </button>
                    <button
                      onClick={submitForReview}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" /> Submit for review
                    </button>
                  </>
                )}
                {isManagerOrHr && ["employee_submitted", "final_employee_submitted"].includes(submission.status) && (
                  <button
                    onClick={saveManagerReview}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow disabled:opacity-50 ml-auto"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Complete review
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
