import { motion, AnimatePresence } from "framer-motion";
import {
  Edit,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import TemplateBody from "./templates/TemplateBody";
import TemplateSubmit from "./templates/TemplateSubmit";
import getAuthAxios from "../utils/authAxios";
import { useEffect, useState, useCallback, useMemo } from "react";
import Swal from "sweetalert2";
import { isPMS_HR } from "../utils/pmsrolecheck";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const fetchProofUrl = async (path) => {
  if (!path) return null;
  try {
    const api = await getAuthAxios();
    const res = await api.get("/pips/proof-url", { params: { blob_name: path } });
    return res.data?.url || null;
  } catch (err) {
    console.error("Failed to get proof URL", err);
    return null;
  }
};

const proofFileName = (path) =>
  path ? path.split("/").pop().replace(/^\d+\.\d+_/, "") : null;

/** Normalise goal's proof field → always an array of paths */
const getProofDocuments = (goal) => {
  if (goal?.proofDocuments?.length) return goal.proofDocuments;
  if (goal?.proofDocument) return [goal.proofDocument];
  return [];
};

export default function TemplateCard({
  remainingWeight,
  temp,
  tIndex,
  loggedInUser,
  templateView,
  selectedTemplates,
  setSelectedTemplates,
  getCycleById,
  submittedTemplates,
  canViewTemplate,
  canRespondEffective,
  openKRA,
  setOpenKRA,
  openSavedKra,
  setOpenSavedKra,
  kraResponses,
  setKraResponses,
  kraRatings,
  setKraRatings,
  setSubmittedTemplates,
  extraKras,
  setExtraKras,
  draftKras,
  setDraftKras,
  kraWeightDrafts,
  setKraWeightDrafts,
  kraErrors,
  setKraErrors,
  kpiErrors,
  setKpiErrors,
  kraResponseFiles,
  setKraResponseFiles,
  validateKra,
  selectedManager,
  setSelectedManager,
  managerList,
  getTemplateValidationErrors,
  submitAll,
  submitSelfReview,
  savedKraKeys,        // ← ADD
  setSavedKraKeys,
  handleDeleteTemplate,
  navigate,
  loadTemplates,
  cycles,
}) {
  const cycle = getCycleById(temp.cycleId);
  const isSelected = selectedTemplates.includes(temp.id);

  const [templateWeights, setTemplateWeights] = useState({});
  const [activeView, setActiveView] = useState("kras");
  const [pipData, setPipData] = useState(null);

  /**
   * goalUpdates[idx] = {
   *   progressStatus: string | null,  ← null means "unchanged"
   *   newFiles: File[],               ← new files queued for upload
   *   removedPaths: string[],         ← existing proof paths marked for removal
   * }
   */
  const [goalUpdates, setGoalUpdates] = useState({});
  const [selectedPipManager, setSelectedPipManager] = useState("");
  const [submittingPip, setSubmittingPip] = useState(false);
  const [assignedManager, setAssignedManager] = useState(null);

  // ── loadPip ────────────────────────────────────────────────────────────────
  const loadPip = async () => {
    try {
      const api = await getAuthAxios();
      const res = await api.get(`/pips/employee/${loggedInUser._id || loggedInUser.id}`);
      const pips = Array.isArray(res.data) ? res.data : [];
      const active = pips.find((p) => p.status === "active") || pips[0] || null;
      setPipData(active);
    } catch (err) {
      console.error("Failed to load PIP", err);
      setPipData(null);
    }
  };

  useEffect(() => {
    if (loggedInUser?._id || loggedInUser?.id) loadPip();
  }, [loggedInUser]);

  const handleWeightChange = useCallback((templateId, weight) => {
    setTemplateWeights((prev) => {
      if (prev[templateId] === weight) return prev;
      return { ...prev, [templateId]: weight };
    });
  }, []);

  const activeCycle = cycles?.[0] || {};
  const submission = submittedTemplates[temp.id];
  const submissionStatus = submission?.status || null;
  const isSubmitted =
    submissionStatus === "employee_submitted" ||
    submissionStatus === "final_employee_submitted" ||
    submissionStatus === "final_manager_reviewed";

  const isSelectedOrApplied = Boolean(isSelected || temp.selected);
  const usedWeight = 100 - (remainingWeight ?? 0);

  const totalKras = (temp.kras || []).length;
  const completedKras = (temp.kras || []).filter((kra, idx) => {
    const kraId = kra._id || `${temp.id}-base-${idx}`;
    return kraResponses[kraId]?.trim() && kraRatings[kraId] && kraRatings[kraId] > 0;
  }).length;
  const completionPercentage = totalKras > 0 ? (completedKras / totalKras) * 100 : 0;

  // ── Detect whether anything in the PIP form has actually changed ──────────
  const hasChanges = useMemo(() => {
    const entries = Object.values(goalUpdates);

    return entries.some(
      (e) =>
        (e.progressStatus !== null && e.progressStatus !== undefined) ||
        e.newFiles.length > 0 ||
        e.removedPaths.length > 0
    );
  }, [goalUpdates]);

  // ── Goal update helpers ────────────────────────────────────────────────────
  const getGoalEntry = (idx) =>
    goalUpdates[idx] || { progressStatus: null, newFiles: [], removedPaths: [] };

  const patchGoalEntry = (idx, patch) =>
    setGoalUpdates((prev) => ({
      ...prev,
      [idx]: { ...getGoalEntry(idx), ...patch },
    }));

  /** Only mark as changed if different from the saved value */
  const handleProgressChange = (idx, value) => {
    const savedStatus = pipData?.goals?.[idx]?.progressStatus || "not_started";
    patchGoalEntry(idx, {
      progressStatus: value === savedStatus ? null : value,
    });
  };

  /** Add new files (append, no duplicates by name) */
  const handleAddFiles = (idx, fileList) => {
    const incoming = Array.from(fileList);
    const existing = getGoalEntry(idx).newFiles;
    const existingNames = new Set(existing.map((f) => f.name));
    const merged = [...existing, ...incoming.filter((f) => !existingNames.has(f.name))];
    patchGoalEntry(idx, { newFiles: merged });
  };

  /** Remove a newly-queued file (not yet uploaded) */
  const handleRemoveNewFile = (idx, fileName) => {
    const entry = getGoalEntry(idx);
    patchGoalEntry(idx, { newFiles: entry.newFiles.filter((f) => f.name !== fileName) });
  };

  /** Remove an already-saved proof path */
  const handleRemoveSavedPath = (idx, path) => {
    const entry = getGoalEntry(idx);
    if (!entry.removedPaths.includes(path)) {
      patchGoalEntry(idx, { removedPaths: [...entry.removedPaths, path] });
    }
  };

  /** Undo removal of a saved path */
  const handleRestoreSavedPath = (idx, path) => {
    const entry = getGoalEntry(idx);
    patchGoalEntry(idx, { removedPaths: entry.removedPaths.filter((p) => p !== path) });
  };

  /** Returns existing proof paths still kept by the employee */
  const getKeptProofs = (idx) => {
    const saved = getProofDocuments(pipData?.goals?.[idx]);
    const removed = getGoalEntry(idx).removedPaths;
    return saved.filter((p) => !removed.includes(p));
  };

  // ── Submit PIP ─────────────────────────────────────────────────────────────
  const handlePipSubmit = async () => {
    if (!hasChanges) return; // guard: nothing changed
    try {
      setSubmittingPip(true);
      const api = await getAuthAxios();
      const formData = new FormData();

      formData.append("managerEmail", selectedPipManager);

      // Build goalUpdates payload — only send goals that actually changed
      const updatesPayload = Object.keys(goalUpdates)
        .filter((key) => {
          const e = goalUpdates[key];
          return (
            (e.progressStatus !== null && e.progressStatus !== undefined) ||
            e.newFiles.length > 0 ||
            e.removedPaths.length > 0
          );
        })
        .map((key) => {
          const entry = goalUpdates[key];
          return {
            index: key,
            progressStatus: entry.progressStatus,
            removeProofPaths: entry.removedPaths || [],
          };
        });

      formData.append("goalUpdates", JSON.stringify(updatesPayload));

      // Append all new files per goal — field name: proof_{goalIndex}_{fileIndex}
      Object.keys(goalUpdates).forEach((key) => {
        const entry = goalUpdates[key];
        (entry.newFiles || []).forEach((file, fileIdx) => {
          formData.append(`proof_${key}_${fileIdx}`, file);
        });
      });

      await api.patch(`/pips/${pipData.id}/employee-update`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await loadPip();
      setGoalUpdates({});
      setSelectedPipManager("");
      Swal.fire("Success", "PIP submitted successfully", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to submit PIP update", "error");
    } finally {
      setSubmittingPip(false);
    }
  };
  useEffect(() => {
    const loadAssignedManager = async () => {
      try {
        const api = await getAuthAxios();
        const employeeId = loggedInUser._id || loggedInUser.id;
        const res = await api.get(`/kpi-template/my-manager/${employeeId}`);

        if (res.data?.managerId) {
          setAssignedManager({
            id: res.data.managerId,
            name: res.data.managerName,
            email: res.data.managerEmail,
          });
          setSelectedManager(res.data.managerId);
          setSelectedPipManager(res.data.managerEmail);
        }
      } catch (err) {
        console.error("Failed to load manager", err);
      }
    };

    if (loggedInUser?._id || loggedInUser?.id) loadAssignedManager();
  }, [loggedInUser]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: tIndex * 0.1 }}
      className={`
        rounded-2xl transition-all duration-300 overflow-hidden
        ${isPMS_HR(loggedInUser) && templateView === "employees" && temp.selected
          ? "bg-gradient-to-br from-green-50 to-emerald-50 shadow-[0_10px_25px_rgba(34,197,94,0.25)]"
          : isSelected
            ? "bg-gradient-to-br from-violet-50 via-purple-50 to-purple-50 shadow-[0_12px_28px_rgba(59,130,246,0.28)] scale-[1.01]"
            : "bg-white shadow-lg hover:shadow-xl"
        }
      `}
      whileHover={{ y: -4 }}
    >
      {/* ── Header ── */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-white">
        {activeView === "kras" && (
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-gray-800">{temp.name}</h3>
              </div>

              <div className="flex items-center gap-6 mt-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TrendingUp className="w-4 h-4" />
                  <span>
                    <span className="font-semibold">{totalKras}</span> KRAs
                  </span>
                </div>

                {canRespondEffective && !isSubmitted && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${completionPercentage}%` }}
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-600">
                      {Math.round(completionPercentage)}% progress
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  KRA weight
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${usedWeight}%` }}
                      className={`h-full ${usedWeight === 100 ? "bg-green-500" : "bg-orange-500"}`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    {usedWeight}% used
                    <span className="text-gray-500 ml-1">({remainingWeight}% left)</span>
                  </span>
                </div>
              </div>
            </div>

            {(() => {
              const now = new Date();

              const cs =
                activeCycle?.startDate || activeCycle?.start
                  ? new Date(activeCycle.startDate || activeCycle.start)
                  : null;

              const ce =
                activeCycle?.endDate || activeCycle?.end
                  ? new Date(activeCycle.endDate || activeCycle.end)
                  : null;

              const userId = loggedInUser?._id || loggedInUser?.id;
              const role = (loggedInUser?.roles?.pms || "").toLowerCase();

              const isEmployeeSelected =
                activeCycle?.selectedEmployees?.includes(userId);

              const isManagerSelected =
                activeCycle?.selectedManagers?.includes(userId);

              const isCycleDateActive =
                cs &&
                ce &&
                now >= cs &&
                now <= ce;

              let cycleActive = false;

              if (isCycleDateActive) {
                if (role === "manager" || role === "hr") {
                  cycleActive =
                    activeCycle?.managerResponseEnabled === true &&
                    isManagerSelected;
                } else {
                  cycleActive =
                    activeCycle?.employeeResponseEnabled === true &&
                    isEmployeeSelected;
                }
              }

              if (isSubmitted) {
                return (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm"
                  >
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">Submitted</span>
                  </motion.div>
                );
              }

              if (!canRespondEffective) return null;

              if (cycleActive) {
                return (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                    <span className="text-sm font-semibold text-violet-700">In Progress</span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                  <span className="text-sm font-semibold text-orange-700">Not Started</span>
                </motion.div>
              );
            })()}
          </div>
        )}

        {/* ── Template Content ── */}
        {canViewTemplate && (
          <div className="p-6">
            {/* Toggle */}
            <div className="flex items-center gap-2 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveView("kras")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === "kras" ? "bg-white shadow text-purple-600" : "text-slate-500"
                  }`}
              >
                My KRAs
              </button>
              <button
                onClick={() => setActiveView("pip")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeView === "pip" ? "bg-white shadow text-amber-600" : "text-slate-500"
                  }`}
              >
                PIP
              </button>
            </div>

            {activeView === "kras" ? (
              <TemplateBody
                key={temp.id}
                onWeightChange={handleWeightChange}
                temp={temp}
                tIndex={tIndex}
                employeeId={loggedInUser._id || loggedInUser.id}
                employeeResponseEnabled={activeCycle.employeeResponseEnabled ?? false}
                managerResponseEnabled={activeCycle.managerResponseEnabled ?? false}
                userRole={loggedInUser?.roles?.pms}
                canRespondEffective={canRespondEffective}
                openKRA={openKRA}
                setOpenKRA={setOpenKRA}
                openSavedKra={openSavedKra}
                setOpenSavedKra={setOpenSavedKra}
                kraResponses={kraResponses}
                setKraResponses={setKraResponses}
                kraRatings={kraRatings}
                setKraRatings={setKraRatings}
                submittedTemplates={submittedTemplates}
                extraKras={extraKras}
                setExtraKras={setExtraKras}
                draftKras={draftKras}
                setDraftKras={setDraftKras}
                kraWeightDrafts={kraWeightDrafts}
                setKraWeightDrafts={setKraWeightDrafts}
                kraErrors={kraErrors}
                setKraErrors={setKraErrors}
                kpiErrors={kpiErrors}
                setKpiErrors={setKpiErrors}
                kraResponseFiles={kraResponseFiles}
                setKraResponseFiles={setKraResponseFiles}
                validateKra={validateKra}
                selectedEmployeesForCycle={activeCycle?.selectedEmployees || []}
                selectedManagersForCycle={activeCycle?.selectedManagers || []}
                savedKraKeys={savedKraKeys}        // ← ADD
                setSavedKraKeys={setSavedKraKeys}  // ← ADD
              />
            ) : (
              /* ─────────────────── PIP VIEW ─────────────────── */
              <div className="space-y-5">
                {!pipData ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                    <p className="text-slate-500 font-medium">No PIP assigned</p>
                  </div>
                ) : (
                  <>
                    {/* ── Submitted lock banner ── */}
                    {pipData.employeeSubmitted && (
                      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 shadow-sm">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-green-800">
                            PIP Update Submitted
                          </p>
                          <p className="text-xs text-green-600 mt-0.5">
                            Sent to{" "}
                            <span className="font-semibold">{pipData.submittedManagerName || "your manager"}</span>
                            {pipData.employeeSubmittedAt
                              ? ` on ${new Date(pipData.employeeSubmittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                              : ""}
                            . You can resubmit once your manager reviews it.
                          </p>
                        </div>
                        <span className="shrink-0 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200">
                          Awaiting Review
                        </span>
                      </div>
                    )}

                    {/* Header */}
                    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <h2 className="text-lg font-bold text-slate-800">
                              Performance Improvement Plan
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              {pipData.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            Outcome:{" "}
                            <span className="ml-1 font-medium capitalize">
                              {pipData.outcome || "pending"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Overview */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Overview
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          {
                            label: "Start date",
                            value: pipData.startDate
                              ? new Date(pipData.startDate).toLocaleDateString("en-IN")
                              : "—",
                          },
                          {
                            label: "End date",
                            value: pipData.targetEndDate
                              ? new Date(pipData.targetEndDate).toLocaleDateString("en-IN")
                              : "—",
                          },
                          { label: "Goals", value: pipData.goals?.length || 0 },
                          { label: "Status", value: pipData.status },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs text-slate-400">{label}</p>
                            <p className="text-sm font-semibold text-slate-800 mt-1 capitalize">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reason */}
                    {pipData.reason && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Reason
                        </p>
                        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
                          {pipData.reason}
                        </div>
                      </div>
                    )}

                    {/* ── Goals ── */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Goals
                      </p>

                      <div className="space-y-3">
                        {(pipData.goals || []).map((goal, idx) => {
                          const isPipLocked = !!pipData.employeeSubmitted;
                          const savedPaths = getProofDocuments(goal);
                          const entry = getGoalEntry(idx);
                          const keptPaths = savedPaths.filter(
                            (p) => !entry.removedPaths.includes(p)
                          );
                          const savedStatus = goal.progressStatus || "not_started";
                          const currentStatus =
                            entry.progressStatus != null
                              ? entry.progressStatus
                              : savedStatus;

                          const statusColors = {
                            met: "bg-emerald-100 text-emerald-700 border-emerald-200",
                            on_track: "bg-violet-100 text-violet-700 border-violet-200",
                            not_started: "bg-slate-100 text-slate-500 border-slate-200",
                          };

                          /** Total attachments visible (kept saved + new queued) */
                          const totalAttachments = keptPaths.length + entry.newFiles.length;

                          return (
                            <div
                              key={idx}
                              className={`border rounded-xl overflow-hidden transition-all ${isPipLocked
                                ? "border-slate-100 bg-slate-50/60 opacity-80"
                                : "border-slate-200 bg-white"
                                }`}
                            >
                              {/* Goal header */}
                              <div className="flex items-start justify-between gap-2 p-4 border-b border-slate-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold text-slate-800 text-sm">
                                    {goal.title}
                                  </h4>
                                  {/* Attachment count badge */}
                                  {totalAttachments > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                                      <svg
                                        className="w-3 h-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                        />
                                      </svg>
                                      {totalAttachments}{" "}
                                      {totalAttachments === 1 ? "file" : "files"}
                                    </span>
                                  )}
                                </div>
                                {/* Status — read-only badge when locked, dropdown when editable */}
                                {/* Status — always read-only badge, employee cannot change */}
                                <span className={`px-3 py-1 rounded-lg border text-xs font-semibold shrink-0 ${statusColors[currentStatus]}`}>
                                  {currentStatus === "not_started" ? "Yet To Start"
                                    : currentStatus === "on_track" ? "In Progress"
                                      : currentStatus === "met" ? "Completed"
                                        : currentStatus}
                                </span>
                              </div>

                              <div className="p-4 space-y-2">
                                {goal.successMeasure && (
                                  <p className="text-xs text-slate-500">
                                    Success measure: {goal.successMeasure}
                                  </p>
                                )}
                                {goal.checkpointDate && (
                                  <p className="text-xs text-slate-500">
                                    Checkpoint:{" "}
                                    {new Date(goal.checkpointDate).toLocaleDateString("en-IN")}
                                  </p>
                                )}

                                {/* ── Proof / Attachments section ── */}
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                      Proof Documents
                                    </p>
                                    {totalAttachments > 0 && (
                                      <span className="text-xs text-slate-400">
                                        {totalAttachments}{" "}
                                        {totalAttachments === 1 ? "attachment" : "attachments"}
                                      </span>
                                    )}
                                  </div>

                                  {/* ── Existing saved proofs ── */}
                                  {savedPaths.length > 0 && (
                                    <div className="space-y-1.5 mb-2">
                                      {savedPaths.map((path) => {
                                        const isRemoved = entry.removedPaths.includes(path);
                                        const name = proofFileName(path);
                                        return (
                                          <div
                                            key={path}
                                            className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs"
                                          >
                                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                              <svg
                                                className="w-3.5 h-3.5 text-emerald-600"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                              </svg>
                                            </div>
                                            <span className="flex-1 truncate font-medium text-emerald-700">
                                              {name}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              <button
                                                type="button"
                                                onClick={async (e) => {
                                                  e.preventDefault();
                                                  const url = await fetchProofUrl(path);
                                                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                                                }}
                                                className="px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition font-semibold">
                                                View
                                              </button>
                                              {/* Remove button — hidden when locked */}
                                              {!isPipLocked && (
                                                isRemoved ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleRestoreSavedPath(idx, path)}
                                                    className="shrink-0 px-2 py-1 rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 transition font-semibold"
                                                  >
                                                    Undo
                                                  </button>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleRemoveSavedPath(idx, path)}
                                                    className="px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition font-semibold"
                                                  >
                                                    ✕
                                                  </button>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* ── Newly queued files — hidden when locked ── */}
                                  {!isPipLocked && entry.newFiles.length > 0 && (
                                    <div className="space-y-1.5 mb-2">
                                      {entry.newFiles.map((file) => (
                                        <div
                                          key={file.name}
                                          className="flex items-center gap-2 p-2.5 rounded-lg border border-purple-200 bg-purple-50 text-xs"
                                        >
                                          <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                            <svg
                                              className="w-3.5 h-3.5 text-purple-600"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                              />
                                            </svg>
                                          </div>
                                          <span className="flex-1 truncate font-medium text-purple-700">
                                            {file.name}
                                          </span>
                                          <span className="text-purple-400 shrink-0">
                                            {(file.size / 1024).toFixed(0)} KB
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveNewFile(idx, file.name)}
                                            className="shrink-0 text-red-500 hover:text-red-700 font-bold ml-1"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* ── Upload zone — hidden when locked ── */}
                                  {!isPipLocked && (
                                    <label className="flex items-center gap-2 cursor-pointer group mt-1">
                                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 transition text-xs text-slate-500 group-hover:text-purple-600 w-full">
                                        <svg
                                          className="w-4 h-4 shrink-0"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                          />
                                        </svg>
                                        <span>
                                          {keptPaths.length > 0 || entry.newFiles.length > 0
                                            ? "Add more files…"
                                            : "Upload proof files…"}
                                        </span>
                                        <span className="ml-auto text-slate-400">
                                          Multiple allowed
                                        </span>
                                      </div>
                                      <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => handleAddFiles(idx, e.target.files)}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Manager select + Submit — hidden once submitted */}
                    {!pipData.employeeSubmitted && (
                      <>
                        <div className="bg-slate-50 rounded-xl p-4">
                          <label className="block text-sm font-semibold mb-2">
                            Reporting Manager
                          </label>

                          <div className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-gray-50">
                            {assignedManager?.name || "No Manager Assigned"}
                          </div>
                        </div>

                        <div className="flex justify-end items-center gap-3">
                          {!hasChanges && (
                            <p className="text-xs text-slate-400 italic">
                              "Make at least one change to enable submission"
                            </p>
                          )}
                          <button
                            onClick={handlePipSubmit}
                            disabled={submittingPip || !hasChanges}
                            title={
                              !hasChanges
                                ? "No changes to submit"
                                : undefined
                            }
                            className="px-5 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold text-sm"
                          >
                            {submittingPip ? "Submitting…" : "Submit PIP Update"}
                          </button>
                        </div>
                      </>
                    )}

                    {/* Review notes */}
                    {pipData.reviewNotes && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Review Notes
                        </p>
                        <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
                          {pipData.reviewNotes}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Section */}
      {activeView === "kras" && canRespondEffective && (
        <div className="px-6 pb-6">
          <TemplateSubmit
            temp={temp}
            totalKraWeight={usedWeight}
            canRespondEffective={canRespondEffective}
            employeeId={loggedInUser._id || loggedInUser.id}
            selectedManager={selectedManager}
            setSelectedManager={setSelectedManager}
            setSubmittedTemplates={setSubmittedTemplates}
            managerList={managerList}
            submittedTemplates={submittedTemplates}
            getTemplateValidationErrors={getTemplateValidationErrors}
            submitAll={submitAll}
            submitSelfReview={submitSelfReview}
            savedKraKeys={savedKraKeys}
            kraResponses={kraResponses}
            kraRatings={kraRatings}
            assignedManager={assignedManager}
            hasAssignedManager={!!assignedManager?.id}
          />
        </div>
      )}
    </motion.div>
  );
}