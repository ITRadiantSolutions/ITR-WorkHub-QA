import { motion } from "framer-motion";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export default function TemplateSubmit({
  totalKraWeight,
  temp,
  submittedTemplates,
  setSubmittedTemplates,
  employeeId,
  selectedManager,
  setSelectedManager,
  managerList,
  getTemplateValidationErrors,
  submitAll,
  submitSelfReview,
  kraResponses,
  kraRatings,
  actuals,          // ← NEW PROP: pass submittedTemplates?.[temp.id]?.actuals || {}
  assignedManager,
  hasAssignedManager,
  savedKraKeys,
}) {
  if (!temp) return null;

  const submission = submittedTemplates?.[temp.id] || {};
  const rawStatus = submission?.status || null;

  // ✅ Check if HR already fully assigned
  const hrWeight = (temp.kras || []).reduce(
    (sum, k) => sum + Number(k.weight || 0),
    0
  );
  const isFullyAssignedByHR = hrWeight === 100;

  const normalizeStatus = (s) => {
    if (!s) return null;

    if (
      s === "employee_submitted" ||
      s === "final_employee_submitted"
    ) return "final_employee_submitted";

    if (
      s === "manager_approved" ||
      s === "managerApproved"
    ) return "manager_approved";

    if (s === "pending_manager_approval") return s;

    if (s === "final_manager_reviewed") return s;

    return null;
  };

  const status = isFullyAssignedByHR
    ? "manager_approved"
    : normalizeStatus(rawStatus);

  const hasSubmittedSelfOrBeyond =
    rawStatus === "employee_submitted" ||
    rawStatus === "final_employee_submitted" ||
    rawStatus === "manager_submitted" ||
    rawStatus === "final_manager_reviewed" ||
    submission === true;

  const isPendingApproval = status === "pending_manager_approval";
  const isManagerApproved = status === "manager_approved";
  const isSelfSubmitted =
    status === "final_employee_submitted" || hasSubmittedSelfOrBeyond;
  const isFinalReviewed =
    status === "final_manager_reviewed" ||
    rawStatus === "manager_submitted" ||
    rawStatus === "final_manager_reviewed";

  const isLocked =
    isPendingApproval || isManagerApproved || isSelfSubmitted || isFinalReviewed;

  const isKraComplete = Number(totalKraWeight) > 0;

  const errors =
    typeof getTemplateValidationErrors === "function"
      ? getTemplateValidationErrors(temp)
      : [];

  /* =========================================
     SELF REVIEW VALIDATION
  ========================================= */

  const hasIncompleteSelfReview = (temp?.kras || []).some((kra, index) => {
    const kraId = kra.kraId || kra._id || kra.id || `${temp.id}-base-${index}`;
    const key = `${temp.id}::${employeeId}::${kraId}`;

    const response = kraResponses?.[key];
    const rating = kraRatings?.[key];

    //console.log("Check KRA", kraId, "→ response:", response, "rating:", rating);

    return !response?.trim() || !rating;
  });

  // ── NEW: only require actual if that KPI has a non-empty target ──────────
  const hasIncompleteActuals = (temp?.kras || []).some((kra, index) => {
    const kraId = kra.kraId || kra._id || kra.id || `${temp.id}-base-${index}`;

    // actuals keyed by kraId (as returned by /kra/by-template)
    const kraActuals = actuals?.[kraId] || [];

    return kraActuals.some((kpi) => {
      const hasTarget = kpi.target?.toString().trim();
      if (!hasTarget) return false; // no target → actual not required
      return !kpi.actual?.toString().trim(); // target present but actual empty → incomplete
    });
  });

  /* =========================================
     BUTTON PERMISSIONS
  ========================================= */
  const canSendForApproval =
    !isLocked &&
    errors.length === 0 &&
    Boolean(selectedManager) &&
    hasAssignedManager &&
    Number(totalKraWeight) === 100;

  // ← NEW: every HR KRA must have been explicitly saved
  const hasUnsavedKras = (temp?.kras || []).some((kra, index) => {
    const kraId = kra.kraId || kra._id || kra.id || `${temp.id}-base-${index}`;
    const key = `${temp.id}::${employeeId}::${kraId}`;
    return !savedKraKeys?.has(key);
  });

  const canSubmitSelfReview =
    status === "manager_approved" &&
    !isSelfSubmitted &&
    !isFinalReviewed &&
    errors.length === 0 &&
    Boolean(selectedManager) &&
    !hasIncompleteSelfReview &&
    !hasIncompleteActuals &&
    !hasUnsavedKras;   // ← ADD       // actuals must be filled where target exists

  /* =========================================
     STATUS BADGE
  ========================================= */

  const StatusBadge = ({ text, color }) => {
    const colors = {
      yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
      blue: "bg-violet-50 border-violet-200 text-violet-700",
      green: "bg-green-50 border-green-200 text-green-700",
      purple: "bg-purple-50 border-purple-200 text-purple-700",
    };

    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`inline-flex items-center gap-2 px-6 py-3 border rounded-lg font-semibold ${colors[color]}`}
      >
        <CheckCircle2 className="w-5 h-5" />
        {text}
      </motion.div>
    );
  };

  useEffect(() => {
    if (!temp?.id || !employeeId) return;

    // do not override final local state
    if (submittedTemplates?.[temp.id]?.status === "final_employee_submitted") {
      return;
    }

    const loadSubmissionStatus = async () => {
      try {
        const API = import.meta.env.VITE_API_URL;

        const res = await fetch(
          `${API}/api/kra/by-template/${temp.id}/${employeeId}`,
          { headers: authHeaders() }
        );

        if (!res.ok) return;

        const data = await res.json();
        const backendStatus = data?.status || null;
        if (!backendStatus) return;

        setSubmittedTemplates(prev => ({
          ...prev,
          [temp.id]: {
            ...(prev[temp.id] || {}),
            status: backendStatus,
          }
        }));

      } catch (err) {
        console.error("Failed to load submission status", err);
      }
    };

    loadSubmissionStatus();
  }, [temp?.id, employeeId]);

  return (
    <motion.div className="flex flex-col gap-4 mt-6 pt-6 border-t border-gray-200">

      {/* MANAGER SELECT */}
      {!hasSubmittedSelfOrBeyond && assignedManager && (
        <div className="flex gap-4">
          <label className="text-sm font-semibold min-w-[160px]">
            Reporting Manager
          </label>

          <div className="px-4 py-2 border rounded-lg bg-gray-50">
            {assignedManager.name}
          </div>
        </div>
      )}

      {/* ERRORS */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border rounded-lg">
          {errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex justify-end">

        {/* FINAL REVIEW DONE */}
        {isFinalReviewed && (
          <StatusBadge text="Final Review Completed" color="purple" />
        )}

        {/* EMPLOYEE SELF SUBMITTED */}
        {!isFinalReviewed && isSelfSubmitted && (
          <StatusBadge text="Self Review Submitted" color="green" />
        )}

        {/* MANAGER APPROVED → CAN SUBMIT SELF REVIEW */}
        {!isFinalReviewed && !isSelfSubmitted && isManagerApproved && (
          <div className="flex gap-3">
            <button
              disabled={!canSubmitSelfReview}
              onClick={async () => {
                if (hasUnsavedKras) {     // ← ADD (check first)
                  toast.warning("Please click Save on each KRA before submitting your self review.");
                  return;
                }

                if (hasIncompleteSelfReview) {
                  toast.warning("Please fill response and rating for all KRAs before submitting.");
                  return;
                }

                if (hasIncompleteActuals) {
                  toast.warning("Please fill the actual value for all KPIs that have a target set.");
                  return;
                }

                await submitSelfReview(temp);

                setSubmittedTemplates(prev => ({
                  ...prev,
                  [temp.id]: {
                    ...(prev[temp.id] || {}),
                    status: "final_employee_submitted",
                  }
                }));
              }}
              className="px-6 py-3 bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Self Review
            </button>
          </div>
        )}

        {/* PENDING MANAGER APPROVAL */}
        {!isFinalReviewed && !isSelfSubmitted && !isManagerApproved && isPendingApproval && (
          <StatusBadge text="Pending Manager Approval" color="yellow" />
        )}

        {/* INITIAL STATE */}
        {!isFinalReviewed && !isSelfSubmitted && !isManagerApproved && !isPendingApproval && (
          <div className="flex flex-col items-end gap-2">

            {!hasAssignedManager && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                No manager assigned. Contact HR before submitting.
              </p>
            )}

            <button
              disabled={!canSendForApproval}
              onClick={async () => {
                if (isLocked) {
                  toast.warning("Submission is locked");
                  return;
                }

                if (!hasAssignedManager) {
                  toast.warning("You don't have a manager assigned. Please contact HR to assign a manager before submitting.");
                  return;
                }

                if (!selectedManager) {
                  toast.warning("Please select reporting manager");
                  return;
                }

                if (errors.length > 0) {
                  toast.warning("Please fix validation errors");
                  return;
                }

                await submitAll(temp);
              }}
              className={`px-6 py-3 rounded-lg text-white font-semibold transition
        ${canSendForApproval
                  ? "bg-violet-600 hover:bg-violet-700"
                  : "bg-gray-300 cursor-not-allowed opacity-60"
                }`}
            >
              Send KRAs for Approval
            </button>
          </div>
        )}

      </div>
    </motion.div>
  );
}