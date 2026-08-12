import { motion } from "framer-motion";
import {
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Plus,
  Trash2,
  Star,
  Send,
  Save,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";

const fetchProofUrl = async (blobName) => {
  if (!blobName) return null;
  try {
    const res = await API.get("/pms/pips/proof-url", { params: { blob_name: blobName } });
    return res.data?.url || null;
  } catch (err) {
    console.error("Failed to get proof URL", err);
    return null;
  }
};

const proofFileName = (path) => (path ? path.split("/").pop().replace(/^\d+\.\d+_/, "") : null);

const getProofDocuments = (goal) => {
  if (goal?.proofDocuments?.length) return goal.proofDocuments;
  if (goal?.proofDocument) return [goal.proofDocument];
  return [];
};

const emptyKraForm = () => ({ open: false, name: "", type: "functional", weight: "", kpis: [{ title: "", weight: "" }] });

// One card per KRA assignment — "My KRAs" tab talks to KraAssignment +
// Submission (the new system), "PIP" tab talks to the independent Pip model.
// The two are unrelated data-wise but share this card's chrome/toggle.
export default function TemplateCard({ assignment, cycle, loggedInUser, tIndex, onChanged }) {
  const userId = loggedInUser?._id || loggedInUser?.id;
  const [activeView, setActiveView] = useState("kras");

  // ── KRA / self-review state ──────────────────────────────────────────────
  const [submission, setSubmission] = useState(null);
  const [loadingSubmission, setLoadingSubmission] = useState(true);
  const [kraForm, setKraForm] = useState(emptyKraForm());
  const [savingKra, setSavingKra] = useState(false);
  const [savingResponses, setSavingResponses] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadSubmission = () => {
    setLoadingSubmission(true);
    API.post(`/pms/submissions/from-assignment/${assignment._id}`, { managerId: loggedInUser?.managerId || null })
      .then((res) => setSubmission(res.data))
      .catch(() => toast.error("Failed to load your review"))
      .finally(() => setLoadingSubmission(false));
  };

  useEffect(loadSubmission, [assignment._id]);

  const totalWeight = useMemo(() => (assignment.kras || []).reduce((sum, k) => sum + (k.weight || 0), 0), [assignment.kras]);

  const canRespond = Boolean(cycle?.employeeResponse?.enabled) && (cycle?.employeeResponse?.selectedUserIds || []).map(String).includes(String(userId));

  const isSubmitted = ["employee_submitted", "final_employee_submitted", "manager_reviewed", "final_manager_reviewed"].includes(submission?.status);
  const canEditResponses = submission && ["draft", "manager_reviewed"].includes(submission.status);

  const completedKras = (submission?.kraResponses || []).filter((r) => r.response?.trim() && r.rating > 0).length;
  const totalKras = assignment.kras?.length || 0;
  const completionPercentage = totalKras > 0 ? (completedKras / totalKras) * 100 : 0;

  const responseFor = (kraId) => submission?.kraResponses?.find((r) => String(r.kraId) === String(kraId));

  const updateResponse = (kraId, patch) => {
    setSubmission((prev) => ({
      ...prev,
      kraResponses: prev.kraResponses.map((r) => (String(r.kraId) === String(kraId) ? { ...r, ...patch } : r)),
    }));
  };

  const saveResponses = async (silent = false) => {
    if (!submission) return;
    setSavingResponses(true);
    try {
      await API.put(`/pms/submissions/${submission._id}/responses`, {
        kraResponses: submission.kraResponses.map((r) => ({ kraId: r.kraId, response: r.response, rating: r.rating })),
      });
      if (!silent) toast.success("Saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
      throw err;
    } finally {
      setSavingResponses(false);
    }
  };

  const submitSelfReview = async () => {
    if (totalWeight !== 100) return toast.error("KRA weights must total 100% before you can submit");
    const incomplete = (submission?.kraResponses || []).some((r) => !r.response?.trim() || !r.rating);
    if (incomplete) return toast.error("Fill in a response and rating for every KRA first");
    setSubmitting(true);
    try {
      await saveResponses(true);
      await API.post(`/pms/submissions/${submission._id}/employee-submit`);
      toast.success("Self-review submitted");
      loadSubmission();
      onChanged?.();
    } catch {
      // saveResponses/employee-submit already surfaced an error toast
    } finally {
      setSubmitting(false);
    }
  };

  const addKra = async () => {
    if (!kraForm.name.trim()) return toast.error("KRA name is required");
    const kpis = kraForm.kpis.filter((k) => k.title.trim()).map((k) => ({ title: k.title.trim(), weight: Number(k.weight) || 0 }));
    setSavingKra(true);
    try {
      await API.post(`/pms/kra/assignments/${assignment._id}/kras`, {
        name: kraForm.name.trim(),
        type: kraForm.type,
        weight: Number(kraForm.weight) || 0,
        kpis,
      });
      toast.success("KRA added");
      setKraForm(emptyKraForm());
      loadSubmission();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add KRA");
    } finally {
      setSavingKra(false);
    }
  };

  const removeKra = async (kraId) => {
    try {
      await API.delete(`/pms/kra/assignments/${assignment._id}/kras/${kraId}`);
      toast.success("KRA removed");
      loadSubmission();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove KRA");
    }
  };

  // ── PIP state (independent of the above — separate model/endpoints) ─────
  const [pipData, setPipData] = useState(null);
  const [goalUpdates, setGoalUpdates] = useState({});
  const [selectedPipManager, setSelectedPipManager] = useState("");
  const [submittingPip, setSubmittingPip] = useState(false);
  const [assignedManager, setAssignedManager] = useState(null);

  const loadPip = async () => {
    try {
      const res = await API.get(`/pms/pips`, { params: { employeeId: userId } });
      const pips = Array.isArray(res.data) ? res.data : [];
      const active = pips.find((p) => p.status === "active") || pips[0] || null;
      setPipData(active);
    } catch (err) {
      console.error("Failed to load PIP", err);
      setPipData(null);
    }
  };

  useEffect(() => {
    if (userId) loadPip();
  }, [userId]);

  useEffect(() => {
    const loadAssignedManager = async () => {
      try {
        const res = await API.get(`/pms/pips/employee/${userId}/manager`);
        if (res.data?.id) {
          setAssignedManager({ id: res.data.id, name: res.data.name, email: res.data.email });
          setSelectedPipManager(res.data.email);
        }
      } catch {
        // no manager relationship yet — leave assignedManager unset
      }
    };
    if (userId) loadAssignedManager();
  }, [userId]);

  const hasChanges = useMemo(() => {
    return Object.values(goalUpdates).some(
      (e) => (e.progressStatus !== null && e.progressStatus !== undefined) || e.newFiles.length > 0 || e.removedPaths.length > 0,
    );
  }, [goalUpdates]);

  const getGoalEntry = (idx) => goalUpdates[idx] || { progressStatus: null, newFiles: [], removedPaths: [] };
  const patchGoalEntry = (idx, patch) => setGoalUpdates((prev) => ({ ...prev, [idx]: { ...getGoalEntry(idx), ...patch } }));
  const handleProgressChange = (idx, value) => {
    const savedStatus = pipData?.goals?.[idx]?.progressStatus || "not_started";
    patchGoalEntry(idx, { progressStatus: value === savedStatus ? null : value });
  };
  const handleAddFiles = (idx, fileList) => {
    const incoming = Array.from(fileList);
    const existing = getGoalEntry(idx).newFiles;
    const existingNames = new Set(existing.map((f) => f.name));
    patchGoalEntry(idx, { newFiles: [...existing, ...incoming.filter((f) => !existingNames.has(f.name))] });
  };
  const handleRemoveNewFile = (idx, fileName) => {
    const entry = getGoalEntry(idx);
    patchGoalEntry(idx, { newFiles: entry.newFiles.filter((f) => f.name !== fileName) });
  };
  const handleRemoveSavedPath = (idx, path) => {
    const entry = getGoalEntry(idx);
    if (!entry.removedPaths.includes(path)) patchGoalEntry(idx, { removedPaths: [...entry.removedPaths, path] });
  };
  const handleRestoreSavedPath = (idx, path) => {
    const entry = getGoalEntry(idx);
    patchGoalEntry(idx, { removedPaths: entry.removedPaths.filter((p) => p !== path) });
  };
  const getKeptProofs = (idx) => {
    const saved = getProofDocuments(pipData?.goals?.[idx]);
    const removed = getGoalEntry(idx).removedPaths;
    return saved.filter((p) => !removed.includes(p));
  };

  const handlePipSubmit = async () => {
    if (!hasChanges) return;
    setSubmittingPip(true);
    try {
      const formData = new FormData();
      formData.append("managerEmail", selectedPipManager);
      const updatesPayload = Object.keys(goalUpdates)
        .filter((key) => {
          const e = goalUpdates[key];
          return (e.progressStatus !== null && e.progressStatus !== undefined) || e.newFiles.length > 0 || e.removedPaths.length > 0;
        })
        .map((key) => ({ index: key, progressStatus: goalUpdates[key].progressStatus, removeProofPaths: goalUpdates[key].removedPaths || [] }));
      formData.append("goalUpdates", JSON.stringify(updatesPayload));
      Object.keys(goalUpdates).forEach((key) => {
        (goalUpdates[key].newFiles || []).forEach((file, fileIdx) => formData.append(`proof_${key}_${fileIdx}`, file));
      });

      await API.post(`/pms/pips/${pipData._id}/employee-submit`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      await loadPip();
      setGoalUpdates({});
      toast.success("PIP submitted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit PIP update");
    } finally {
      setSubmittingPip(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: (tIndex || 0) * 0.05 }}
      className="rounded-2xl bg-white shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
    >
      <div className="p-6 bg-gradient-to-r from-gray-50 to-white">
        {activeView === "kras" && (
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-800">{cycle?.name || "KRAs"}</h3>
              <div className="flex items-center gap-6 mt-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  <span><span className="font-semibold">{totalKras}</span> KRAs</span>
                </div>
                {canRespond && !isSubmitted && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${completionPercentage}%` }} className="h-full bg-gradient-to-r from-violet-500 to-purple-500" />
                    </div>
                    <span className="text-xs font-semibold text-gray-600">{Math.round(completionPercentage)}% complete</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  Weight
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(totalWeight, 100)}%` }} className={`h-full ${totalWeight === 100 ? "bg-green-500" : "bg-orange-500"}`} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{totalWeight}% used</span>
                </div>
              </div>
            </div>

            {isSubmitted ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-700">Submitted</span>
              </div>
            ) : canRespond ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg shadow-sm">
                <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                <span className="text-sm font-semibold text-violet-700">In Progress</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg shadow-sm">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                <span className="text-sm font-semibold text-orange-700">Not Open Yet</span>
              </div>
            )}
          </div>
        )}

        <div className="pt-6">
          <div className="flex items-center gap-2 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
            <button onClick={() => setActiveView("kras")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === "kras" ? "bg-white shadow text-purple-600" : "text-slate-500"}`}>
              My KRAs
            </button>
            <button onClick={() => setActiveView("pip")} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === "pip" ? "bg-white shadow text-amber-600" : "text-slate-500"}`}>
              PIP
            </button>
          </div>

          {activeView === "kras" ? (
            loadingSubmission ? (
              <div className="p-8 text-center text-slate-400">Loading...</div>
            ) : (
              <div className="space-y-3">
                {(assignment.kras || []).map((kra) => {
                  const response = responseFor(kra._id);
                  return (
                    <div key={kra._id} className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">
                            {kra.name}
                            {kra.isEmployeeAdded && <span className="ml-2 text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full align-middle">Added by you</span>}
                          </p>
                          <p className="text-xs text-slate-400 capitalize">{kra.type} &middot; {kra.weight || 0}% weight</p>
                        </div>
                        {kra.isEmployeeAdded && canEditResponses && (
                          <button onClick={() => removeKra(kra._id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 shrink-0" title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {kra.kpis?.length > 0 && (
                        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-slate-100">
                          {kra.kpis.map((kpi, i) => (
                            <span key={i} className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                              {kpi.title} ({kpi.weight || 0}%)
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="p-4 space-y-2.5">
                        <textarea
                          value={response?.response || ""}
                          onChange={(e) => updateResponse(kra._id, { response: e.target.value })}
                          onBlur={() => canEditResponses && saveResponses(true)}
                          disabled={!canEditResponses}
                          placeholder="Your self-assessment for this KRA..."
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                        />
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              disabled={!canEditResponses}
                              onClick={() => {
                                updateResponse(kra._id, { rating: n });
                                if (canEditResponses) saveResponses(true);
                              }}
                            >
                              <Star className={`w-5 h-5 ${(response?.rating || 0) >= n ? "text-amber-400 fill-amber-400" : "text-slate-300"}`} />
                            </button>
                          ))}
                          {response?.rating && <span className="text-xs text-slate-400 ml-1">{response.rating}/5</span>}
                        </div>
                        {response?.managerResponse && (
                          <div className="rounded-lg bg-violet-50 border border-violet-100 p-3 text-xs text-violet-800">
                            <p className="font-semibold mb-0.5">Manager feedback</p>
                            {response.managerResponse}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {canEditResponses && (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-4">
                    {!kraForm.open ? (
                      <button onClick={() => setKraForm((f) => ({ ...f, open: true }))} className="w-full flex items-center justify-center gap-1.5 text-slate-500 text-sm font-semibold py-1.5 hover:text-violet-600">
                        <Plus className="w-4 h-4" /> Add your own KRA
                      </button>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <select value={kraForm.type} onChange={(e) => setKraForm((f) => ({ ...f, type: e.target.value }))} className="rounded-lg border border-slate-200 text-xs px-2 py-1.5 bg-white">
                            <option value="functional">Functional</option>
                            <option value="organizational">Organizational</option>
                          </select>
                          <input value={kraForm.name} onChange={(e) => setKraForm((f) => ({ ...f, name: e.target.value }))} placeholder="KRA name" className="flex-1 rounded-lg border border-slate-200 text-sm px-2.5 py-1.5" />
                          <input
                            value={kraForm.weight}
                            onChange={(e) => setKraForm((f) => ({ ...f, weight: e.target.value }))}
                            type="number"
                            placeholder="Weight %"
                            className="w-24 rounded-lg border border-slate-200 text-sm px-2.5 py-1.5"
                          />
                        </div>
                        {kraForm.kpis.map((kpi, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              value={kpi.title}
                              onChange={(e) => setKraForm((f) => ({ ...f, kpis: f.kpis.map((k, idx) => (idx === i ? { ...k, title: e.target.value } : k)) }))}
                              placeholder="KPI title"
                              className="flex-1 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5"
                            />
                            <input
                              value={kpi.weight}
                              onChange={(e) => setKraForm((f) => ({ ...f, kpis: f.kpis.map((k, idx) => (idx === i ? { ...k, weight: e.target.value } : k)) }))}
                              type="number"
                              placeholder="Weight %"
                              className="w-20 rounded-lg border border-slate-200 text-xs px-2 py-1.5"
                            />
                          </div>
                        ))}
                        <button onClick={() => setKraForm((f) => ({ ...f, kpis: [...f.kpis, { title: "", weight: "" }] }))} className="text-[11px] font-semibold text-violet-600">
                          + Add KPI row
                        </button>
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={addKra} disabled={savingKra} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-50">
                            {savingKra ? "Saving..." : "Save KRA"}
                          </button>
                          <button onClick={() => setKraForm(emptyKraForm())} className="px-3 py-1.5 rounded-lg text-slate-500 text-xs font-semibold flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canEditResponses && (
                  <div className="flex justify-end items-center gap-3 pt-2">
                    {totalWeight !== 100 && <p className="text-xs text-amber-600 font-medium">Weights must total 100% ({totalWeight}% so far)</p>}
                    <button onClick={() => saveResponses(false)} disabled={savingResponses} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
                      <Save className="w-4 h-4" /> Save draft
                    </button>
                    <button
                      onClick={submitSelfReview}
                      disabled={submitting || totalWeight !== 100}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Self Review"}
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            /* ─────────────────── PIP VIEW ─────────────────── */
            <div className="space-y-5">
              {!pipData ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                  <p className="text-slate-500 font-medium">No PIP assigned</p>
                </div>
              ) : (
                <>
                  {pipData.employeeSubmitted && (
                    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 shadow-sm">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-green-800">PIP Update Submitted</p>
                        <p className="text-xs text-green-600 mt-0.5">
                          Sent to <span className="font-semibold">{pipData.submittedManagerName || "your manager"}</span>
                          {pipData.employeeSubmittedAt ? ` on ${new Date(pipData.employeeSubmittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}. You can resubmit once your manager reviews it.
                        </p>
                      </div>
                      <span className="shrink-0 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200">Awaiting Review</span>
                    </div>
                  )}

                  <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <h2 className="text-lg font-bold text-slate-800">Performance Improvement Plan</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{pipData.status}</span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Outcome: <span className="ml-1 font-medium capitalize">{pipData.outcome || "pending"}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Overview</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Start date", value: pipData.startDate ? new Date(pipData.startDate).toLocaleDateString("en-IN") : "—" },
                        { label: "End date", value: pipData.targetEndDate ? new Date(pipData.targetEndDate).toLocaleDateString("en-IN") : "—" },
                        { label: "Goals", value: pipData.goals?.length || 0 },
                        { label: "Status", value: pipData.status },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs text-slate-400">{label}</p>
                          <p className="text-sm font-semibold text-slate-800 mt-1 capitalize">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {pipData.reason && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Reason</p>
                      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">{pipData.reason}</div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Goals</p>
                    <div className="space-y-3">
                      {(pipData.goals || []).map((goal, idx) => {
                        const isPipLocked = !!pipData.employeeSubmitted;
                        const savedPaths = getProofDocuments(goal);
                        const entry = getGoalEntry(idx);
                        const keptPaths = savedPaths.filter((p) => !entry.removedPaths.includes(p));
                        const savedStatus = goal.progressStatus || "not_started";
                        const currentStatus = entry.progressStatus != null ? entry.progressStatus : savedStatus;
                        const statusColors = {
                          met: "bg-emerald-100 text-emerald-700 border-emerald-200",
                          on_track: "bg-violet-100 text-violet-700 border-violet-200",
                          not_started: "bg-slate-100 text-slate-500 border-slate-200",
                        };
                        const totalAttachments = keptPaths.length + entry.newFiles.length;

                        return (
                          <div key={idx} className={`border rounded-xl overflow-hidden transition-all ${isPipLocked ? "border-slate-100 bg-slate-50/60 opacity-80" : "border-slate-200 bg-white"}`}>
                            <div className="flex items-start justify-between gap-2 p-4 border-b border-slate-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-slate-800 text-sm">{goal.title}</h4>
                                {totalAttachments > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                                    {totalAttachments} {totalAttachments === 1 ? "file" : "files"}
                                  </span>
                                )}
                              </div>
                              <span className={`px-3 py-1 rounded-lg border text-xs font-semibold shrink-0 ${statusColors[currentStatus]}`}>
                                {currentStatus === "not_started" ? "Yet To Start" : currentStatus === "on_track" ? "In Progress" : currentStatus === "met" ? "Completed" : currentStatus}
                              </span>
                            </div>

                            <div className="p-4 space-y-2">
                              {goal.successMeasure && <p className="text-xs text-slate-500">Success measure: {goal.successMeasure}</p>}
                              {goal.checkpointDate && <p className="text-xs text-slate-500">Checkpoint: {new Date(goal.checkpointDate).toLocaleDateString("en-IN")}</p>}

                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Proof Documents</p>

                                {savedPaths.length > 0 && (
                                  <div className="space-y-1.5 mb-2">
                                    {savedPaths.map((path) => {
                                      const isRemoved = entry.removedPaths.includes(path);
                                      return (
                                        <div key={path} className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs">
                                          <span className="flex-1 truncate font-medium text-emerald-700">{proofFileName(path)}</span>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                              type="button"
                                              onClick={async (e) => {
                                                e.preventDefault();
                                                const url = await fetchProofUrl(path);
                                                if (url) window.open(url, "_blank", "noopener,noreferrer");
                                              }}
                                              className="px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition font-semibold"
                                            >
                                              View
                                            </button>
                                            {!isPipLocked &&
                                              (isRemoved ? (
                                                <button type="button" onClick={() => handleRestoreSavedPath(idx, path)} className="shrink-0 px-2 py-1 rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 transition font-semibold">
                                                  Undo
                                                </button>
                                              ) : (
                                                <button type="button" onClick={() => handleRemoveSavedPath(idx, path)} className="px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition font-semibold">
                                                  ✕
                                                </button>
                                              ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {!isPipLocked && entry.newFiles.length > 0 && (
                                  <div className="space-y-1.5 mb-2">
                                    {entry.newFiles.map((file) => (
                                      <div key={file.name} className="flex items-center gap-2 p-2.5 rounded-lg border border-purple-200 bg-purple-50 text-xs">
                                        <span className="flex-1 truncate font-medium text-purple-700">{file.name}</span>
                                        <span className="text-purple-400 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                                        <button type="button" onClick={() => handleRemoveNewFile(idx, file.name)} className="shrink-0 text-red-500 hover:text-red-700 font-bold ml-1">
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {!isPipLocked && (
                                  <label className="flex items-center gap-2 cursor-pointer group mt-1">
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 transition text-xs text-slate-500 group-hover:text-purple-600 w-full">
                                      <span>{keptPaths.length > 0 || entry.newFiles.length > 0 ? "Add more files…" : "Upload proof files…"}</span>
                                      <span className="ml-auto text-slate-400">Multiple allowed</span>
                                    </div>
                                    <input type="file" multiple className="hidden" onChange={(e) => handleAddFiles(idx, e.target.files)} />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!pipData.employeeSubmitted && (
                    <>
                      <div className="bg-slate-50 rounded-xl p-4">
                        <label className="block text-sm font-semibold mb-2">Reporting Manager</label>
                        <div className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-gray-50">{assignedManager?.name || "No Manager Assigned"}</div>
                      </div>
                      <div className="flex justify-end items-center gap-3">
                        {!hasChanges && <p className="text-xs text-slate-400 italic">Make at least one change to enable submission</p>}
                        <button
                          onClick={handlePipSubmit}
                          disabled={submittingPip || !hasChanges}
                          className="px-5 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold text-sm"
                        >
                          {submittingPip ? "Submitting…" : "Submit PIP Update"}
                        </button>
                      </div>
                    </>
                  )}

                  {pipData.reviewNotes && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Review Notes</p>
                      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">{pipData.reviewNotes}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
