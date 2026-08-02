import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Star, CheckCircle2, Send, AlertCircle, User, Download, Calendar } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
 import Loader from "../components/Loader";
import getAuthAxios from "../../utils/authAxios";

const EMPTY = "-";

const STATUS_CONFIG = {
  manager_approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  manager_rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  pending_manager_approval: { label: "Pending Approval", className: "bg-yellow-100 text-yellow-700" },
  final_manager_reviewed: { label: "Final Reviewed", className: "bg-violet-100 text-violet-700" },
  final_employee_submitted: { label: "Employee Submitted", className: "bg-purple-100 text-purple-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  default: { label: "In Progress", className: "bg-gray-100 text-gray-600" },
};

function renderStars(value) {
  const rating = Number(value || 0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${rating >= n ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
        />
      ))}
      <span className="text-xs font-semibold text-gray-600 ml-1">{rating || 0}/5</span>
    </div>
  );
}

export default function EmployeeReviewView({
  report,
  user,
  normalizedKras,
  setNormalizedKras,
  feedback,
  setFeedback,
  rating,
  setRating,
  onSubmit,
  onBack,
}) {
  const [actionLoadingByKra, setActionLoadingByKra] = useState({});
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  //console.log(report)
  const status = report?.status || "employee_submitted";
  const canReview = isPMS_Manager(user) || isPMS_HR(user);
  const [oneOnOneChecked, setOneOnOneChecked] = useState(false);
  const [oneOnOneComment, setOneOnOneComment] = useState("");
  const [oneOnOneDate, setOneOnOneDate] = useState("");

  useEffect(() => {
    if (report?.oneOnOneDate || report?.oneOnOneComment) {
      setOneOnOneDate(report.oneOnOneDate || "");
      setOneOnOneComment(report.oneOnOneComment || "");
      setOneOnOneChecked(true); // auto check checkbox
    }
  }, [report]);

  useEffect(() => {
    if (!report?.kras) return;

    // Deduplicate: if two KRAs share the same name, keep the one
    // that has a real response/rating (employee-created beats base).
    const deduped = [];
    const seenNames = new Map();

    report.kras
      .filter((kra) => Number(kra.weight ?? 0) > 0)
      .forEach((kra) => {
        const name = (kra.kraName ?? kra.name ?? "").toLowerCase().trim();
        const hasContent = (kra.response ?? "").trim() || Number(kra.selfRating ?? kra.rating ?? 0) > 0;

        if (!seenNames.has(name)) {
          seenNames.set(name, deduped.length);
          deduped.push(kra);
        } else if (hasContent) {
          // Replace the placeholder entry with the one that has content
          deduped[seenNames.get(name)] = kra;
        }
      });

    setNormalizedKras(
      deduped.map((kra, idx) => ({
        id: kra.id || kra.kraId || idx,
        name: kra.kraName ?? kra.name ?? `KRA ${idx + 1}`,
        weight: Number(kra.weight ?? 0),
        kpis: Array.isArray(kra.kpis)
          ? kra.kpis.map((kpi, i) => ({
            name: kpi.title ?? kpi.name ?? `KPI ${i + 1}`,
            weight: Number(kpi.weight ?? 0),
          }))
          : [],
        response: kra.employeeResponse ?? kra.response ?? EMPTY,
        rating: Number(kra.selfRating ?? kra.rating ?? 0),
        managerResponse: kra.managerResponse ?? "",
        managerRating: Number(kra.managerRating ?? 0),
        status: kra.status ?? "pending",
      }))
    );
  }, [report, setNormalizedKras]);

  if (!report) {
    return <Loader containerClass="flex flex-col items-center justify-center h-[60vh] gap-3" />;
  }

  const formatRatingNumber = (val) => {
    const n = Number(val || 0);
    return n > 0 ? n.toFixed(1) : "—";
  };

  const handleExportSingle = () => {
    if (!normalizedKras?.length) return;

    const meetingDateDisplay = report.oneOnOneDate
      ? new Date(report.oneOnOneDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      : EMPTY;

    /* ================================
       SUMMARY SECTION
    ================================= */
    const summaryRows = [
      ["Employee Name", report.employeeName || EMPTY],
      ["Employee Role", report.employeeRole || EMPTY],
      ["Cycle", report.cycle || report.cycleName || EMPTY],
      ["Self Avg Rating", formatRatingNumber(report.selfAvg)],
      ["Manager Avg Rating", formatRatingNumber(report.managerAvg)],
      ["Final Avg Rating", formatRatingNumber(report.avgRating)],
      ["1:1 Meeting Date", meetingDateDisplay],
      ["1:1 Meeting Summary", report.oneOnOneComment || EMPTY],
      [],
    ];

    /* ================================
       KRA TABLE
    ================================= */
    const kraHeader = [
      "KRA No",
      "KRA Name",
      "Weight (%)",
      "Employee Response",
      "Employee Rating",
      "Manager Response",
      "Manager Rating",
    ];

    const kraRows = normalizedKras.map((k, idx) => [
      idx + 1,
      k.name || `KRA ${idx + 1}`,
      k.weight ?? EMPTY,
      k.response || EMPTY,
      formatRatingNumber(k.rating),
      k.managerResponse || EMPTY,
      formatRatingNumber(k.managerRating),
    ]);

    const rows = [...summaryRows, kraHeader, ...kraRows];
    const kraHeaderRowIndex = summaryRows.length; // 0-based row index where the KRA table header sits

    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);

    sheet["!cols"] = [
      { wch: 8 },
      { wch: 26 },
      { wch: 12 },
      { wch: 48 },
      { wch: 15 },
      { wch: 48 },
      { wch: 15 },
    ];

    /* ================================
       BOLD THE KRA TABLE HEADER
    ================================= */
    kraHeader.forEach((_, colIdx) => {
      const addr = XLSX.utils.encode_cell({ r: kraHeaderRowIndex, c: colIdx });
      if (sheet[addr]) {
        sheet[addr].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E5E7EB" } },
        };
      }
    });

    /* ================================
       WRAP TEXT FOR KRA ROWS SO LONG
       RESPONSES DON'T SPILL/CLIP
    ================================= */
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let R = kraHeaderRowIndex; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!sheet[addr]) continue;
        sheet[addr].s = {
          ...(sheet[addr].s || {}),
          alignment: { wrapText: true, vertical: "top" },
        };
      }
    }

    /* ================================
       ROW HEIGHTS: compact for the summary
       block, auto-sized for KRA rows
    ================================= */
    sheet["!rows"] = rows.map((row, idx) => {
      if (idx < kraHeaderRowIndex) return { hpt: 20 };
      const longest = Math.max(
        ...row.map((cell) => String(cell || "").length)
      );
      return { hpt: Math.min(200, Math.max(20, Math.ceil(longest / 50) * 15)) };
    });

    XLSX.utils.book_append_sheet(wb, sheet, "Performance Review");

    XLSX.writeFile(
      wb,
      `PMS_Review_${report.employeeName || "Employee"}.xlsx`
    );
  };
  const handleSaveDraft = async () => {
    try {
      const api = await getAuthAxios();

      await api.post("/reports/save-draft-review", {
        templateId: report.templateId,
        employeeId: report.employeeId,
        kras: normalizedKras.map((k) => ({
          kraId: k.id,
          managerResponse: k.managerResponse,
          managerRating: k.managerRating,
        })),
        oneOnOneDate,
        oneOnOneComment,
      });

      toast.success("Draft saved successfully");
    } catch (err) {
      toast.error("Failed to save draft");
    }
  };
  const isFinalSubmitted = [
    "final_manager_reviewed",
    "manager_submitted",
    "manager_approved",
    "approved",
  ].includes(report?.status);

  // Separately: has employee actually submitted (even if backend says "draft")?
  const isEmployeeActuallySubmitted =
    isFinalSubmitted ||
    report?.status === "final_employee_submitted" ||
    report?.status === "employee_submitted" ||
    // Fallback: if any KRA has response content, treat as submitted
    (report?.kras || []).some(
      (k) => (k.response ?? "").trim() || Number(k.selfRating ?? k.rating ?? 0) > 0
    );

  const completedManagerInputs = useMemo(
    () =>
      normalizedKras.filter(
        (kra) => kra.response?.trim() && kra.managerResponse?.trim() && Number(kra.managerRating) > 0
      ).length,
    [normalizedKras]
  );

  const canSubmitFinalReview =
    !isFinalSubmitted &&
    canReview &&
    normalizedKras.length > 0 &&
    completedManagerInputs === normalizedKras.length &&
    oneOnOneChecked &&
    oneOnOneDate &&
    oneOnOneComment.trim();

  const submitBlockReason =
    !normalizedKras.length
      ? "No KRA entries available."
      : completedManagerInputs !== normalizedKras.length
        ? "Please add manager comment and rating for all KRAs."
        : !oneOnOneChecked
          ? "Please confirm 1:1 meeting."
          : !oneOnOneDate
            ? "Please select meeting date."
            : !oneOnOneComment.trim()
              ? "Please add 1:1 meeting comment."
              : "";

  const handleManagerAction = async (kra, idx, action) => {
    const managerId = user?._id || user?.id || user?.userId;
    if (!report?.templateId || !managerId) {
      toast.warning("Template or manager information is missing.");
      return;
    }

    setActionLoadingByKra((prev) => ({ ...prev, [kra.id]: true }));
    try {
      const api = await getAuthAxios();
      const resp = await api.post("/reports/manager-action", {
        templateId: report.templateId,
        employeeId: report.employeeId,
        managerId,
        kraId: kra.id,
        action,
      });

      const newStatus = resp?.data?.status || "pending_manager_approval";
      setNormalizedKras((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, status: newStatus } : item))
      );

      toast.success(`KRA marked as ${action}.`);
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || err?.message || "Unable to update KRA status."
      );
    } finally {
      setActionLoadingByKra((prev) => ({ ...prev, [kra.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        >

          {/* TOP ROW */}
          <div className="flex items-center justify-between">

            {/* LEFT */}
            <div className="flex items-start gap-4">

              <motion.button
                onClick={onBack}
                className="mt-1 p-2.5 bg-slate-100 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-700"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>

              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  Performance Review
                </h1>

                <div className="flex items-center gap-2 text-slate-600 mt-2">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{report.employeeName}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-sm">
                    {report.employeeRole ?? user.role}
                  </span>
                </div>
              </div>

            </div>

            {/* RIGHT */}
            <motion.button
              onClick={handleExportSingle}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl shadow hover:bg-slate-800 text-sm font-semibold"
            >
              <Download className="w-4 h-4" />
              Export
            </motion.button>

          </div>

          {/* STATUS */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {report.status === "manager_submitted" &&
              report.approvedByManagerName && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-700">
                    Approved by {report.approvedByManagerName}
                  </span>
                </div>
              )}

            <div className="px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs text-violet-700">
              Completed Reviews: {completedManagerInputs}/{normalizedKras.length || 0}
            </div>
          </div>

        </motion.div>


        {/* SUMMARY CARDS */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid md:grid-cols-4 gap-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-violet-500" />
            <div>
              <p className="text-xs text-slate-500">Cycle</p>
              <p className="font-semibold text-slate-800">
                {report.cycle || report.cycleName || "—"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-xs text-slate-500">Your Rating</p>
              <p className="font-semibold text-purple-600">
                {report.selfAvg ? Number(report.selfAvg).toFixed(1) : 0}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-xs text-slate-500">Manager Rating</p>
              <p className="font-semibold text-purple-600">
                {report.managerAvg ? Number(report.managerAvg).toFixed(1) : 0}
              </p>
            </div>
          </div>

          <div className="bg-green-50 rounded-xl border border-green-200 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-green-700">Final Avg</p>
              <p className="font-semibold text-green-700">
                {report.avgRating ? Number(report.avgRating).toFixed(1) : 0}
              </p>
            </div>
          </div>
        </motion.div>


        {/* PERFORMANCE BREAKDOWN */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            Performance Breakdown
          </h2>

          {normalizedKras.map((kra, idx) => {

            const isEmployeeSubmitted =
              // Top-level report status takes priority
              report?.status === "final_employee_submitted" ||
              report?.status === "employee_submitted" ||
              report?.status === "final_manager_reviewed" ||
              report?.status === "manager_submitted" ||
              // Fall back to per-KRA status only if the KRA actually has content
              isEmployeeActuallySubmitted ||
              (kra.response && kra.response !== EMPTY) ||
              Number(kra.rating) > 0;

            const canShowApprovalActions =
              !isEmployeeSubmitted && kra.status === "pending_manager_approval";

            const isActionLoading = Boolean(actionLoadingByKra[kra.id]);

            return (
              <motion.div
                key={kra._id || kra.id || idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6"
              >

                {/* KRA HEADER */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-800">
                    {idx + 1}. {kra.name}
                  </h3>

                  <div className="flex items-center gap-3 text-sm mt-1">
                    <span className="text-slate-600">
                      Weightage: <b>{kra.weight}%</b>
                    </span>

                    <span className="bg-purple-100 text-purple-600 text-xs px-2 py-1 rounded-full font-semibold">
                      KRA
                    </span>
                  </div>
                </div>


                {/* KPI LIST */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-purple-600 mb-3 uppercase">
                    Key Performance Indicators
                  </p>

                  <div className="space-y-2">
                    {kra.kpis.map((kpi, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white border border-slate-200 px-4 py-2 rounded-lg"
                      >
                        <span className="text-sm text-slate-700">
                          {kpi.name}
                        </span>

                        <span className="text-xs bg-sky-100 text-sky-600 px-2 py-1 rounded-full font-semibold">
                          {kpi.weight}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>


                {/* APPROVE / REJECT / MODIFY */}
                {canShowApprovalActions && (
                  <div className="flex gap-3 justify-end mb-4">
                    {["approve", "reject", "modify"].map((action) => (
                      <motion.button
                        key={action}
                        onClick={() => handleManagerAction(kra, idx, action)}
                        disabled={isActionLoading}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold
                        ${action === "approve"
                            ? "bg-green-600 text-white"
                            : action === "reject"
                              ? "bg-red-600 text-white"
                              : "bg-amber-500 text-white"
                          }`}
                      >
                        {isActionLoading
                          ? "Updating..."
                          : action === "approve"
                            ? "Approve"
                            : action === "reject"
                              ? "Reject"
                              : "Modify"}
                      </motion.button>
                    ))}
                  </div>
                )}


                {/* RESPONSES */}
                <div className="grid md:grid-cols-2 gap-4">

                  {/* EMPLOYEE */}
                  {isEmployeeSubmitted && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-violet-700 mb-2">
                        Your Response
                      </p>

                      <p className="text-sm text-slate-800 mb-3 whitespace-pre-line">
                        {kra.response || EMPTY}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        Rating: {renderStars(kra.rating)}
                      </div>
                    </div>
                  )}

                  {/* MANAGER */}
                  {isEmployeeSubmitted && (
                    isFinalSubmitted ? (

                      /* READ ONLY UI (like screenshot 2) */
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-700 mb-2">
                          Manager Feedback
                        </p>

                        <p className="text-sm text-slate-800 mb-3 whitespace-pre-line">
                          {kra.managerResponse || EMPTY}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          Rating: {renderStars(kra.managerRating)}
                        </div>
                      </div>

                    ) : (

                      /* EDITABLE UI */
                      <div className="grid md:grid-cols-[1fr_auto] gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Manager Comment
                          </label>

                          <textarea
                            value={kra.managerResponse || ""}
                            onChange={(e) =>
                              setNormalizedKras((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, managerResponse: e.target.value }
                                    : item
                                )
                              )
                            }
                            rows={3}
                            className="w-full rounded-lg border border-slate-300 p-3 text-sm resize-none"
                          />
                        </div>

                        <div className="flex flex-col items-center">
                          <p className="text-sm font-semibold text-slate-700 mb-3">
                            Manager Rating
                          </p>

                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((n) => {
                              const active = Number(kra.managerRating || 0) >= n;

                              return (
                                <motion.button
                                  key={n}
                                  onClick={() =>
                                    setNormalizedKras((prev) =>
                                      prev.map((item, i) =>
                                        i === idx
                                          ? { ...item, managerRating: n }
                                          : item
                                      )
                                    )
                                  }
                                >
                                  <Star
                                    className={`w-6 h-6 ${active
                                      ? "text-yellow-400 fill-yellow-400"
                                      : "text-slate-300"
                                      }`}
                                  />
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                    )
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>


        {/* SUBMIT FINAL REVIEW */}
        {canReview && !isFinalSubmitted && normalizedKras.length > 0 && (
          <div className="">
            <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl p-5 space-y-4">

              {/* HEADER */}
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                <p className="text-sm font-semibold text-slate-800">
                  Final Review Checklist
                </p>
              </div>

              {/* MAIN ROW */}
              <div className="grid md:grid-cols-[300px_1fr] gap-4 items-start">

                {/* LEFT → CHECKBOX */}
                <label className="flex items-center gap-3 cursor-pointer bg-slate-50 hover:bg-slate-100 transition p-4 rounded-xl border border-slate-200 h-full">
                  <input
                    type="checkbox"
                    checked={oneOnOneChecked}
                    onChange={(e) => setOneOnOneChecked(e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />

                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-slate-700">
                      1:1 Meeting Completed
                    </span>
                  </div>

                  {oneOnOneChecked && (
                    <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
                  )}
                </label>

                {/* RIGHT → COMMENT BOX */}
                <div className="space-y-3">

                  {/* 📅 DATE PICKER */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <p className="text-xs text-slate-500">Meeting Date</p>
                    </div>

                    <input
                      type="date"
                      value={oneOnOneDate}
                      onChange={(e) => setOneOnOneDate(e.target.value)}
                      disabled={!oneOnOneChecked}
                      max={new Date().toISOString().split("T")[0]}
                      className={`w-full rounded-xl border px-3 py-2 text-sm
    ${oneOnOneChecked
                          ? "border-slate-300 focus:ring-2 focus:ring-purple-500"
                          : "border-slate-200 bg-slate-100 cursor-not-allowed"
                        }`}
                    />
                  </div>

                  {/* 📝 COMMENT */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-slate-400" />
                      <p className="text-xs text-slate-500">Meeting Notes</p>
                    </div>

                    <textarea
                      value={oneOnOneComment}
                      onChange={(e) => setOneOnOneComment(e.target.value)}
                      rows={3}
                      disabled={!oneOnOneChecked}
                      placeholder="Summarize discussion, feedback, action items..."
                      className={`w-full rounded-xl border p-3 text-sm resize-none
        ${oneOnOneChecked
                          ? "border-slate-300 focus:ring-2 focus:ring-purple-500"
                          : "border-slate-200 bg-slate-100 cursor-not-allowed"
                        }`}
                    />
                  </div>

                </div>

              </div>

              {/* SUBMIT BUTTON */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">

                {/* LEFT TEXT */}
                {!canSubmitFinalReview && (
                  <p className="text-xs text-red-500">
                    {submitBlockReason}
                  </p>
                )}

                {/* RIGHT BUTTONS */}
                <div className="flex gap-3">

                  {/* ✅ SAVE BUTTON */}
                  <motion.button
                    onClick={handleSaveDraft}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: 1.02 }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300"
                  >
                    Save
                  </motion.button>

                  {/* EXISTING SUBMIT BUTTON */}
                  <motion.button
                    onClick={async () => {
                      if (!canSubmitFinalReview) {
                        toast.warning(submitBlockReason || "Please complete all fields.");
                        return;
                      }

                      try {
                        setIsSubmittingFinal(true);
                        await onSubmit({
                          oneOnOneDate,
                          oneOnOneComment,
                        });
                      } finally {
                        setIsSubmittingFinal(false);
                      }
                    }}
                    disabled={!canSubmitFinalReview || isSubmittingFinal}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: canSubmitFinalReview ? 1.02 : 1 }}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
        ${canSubmitFinalReview && !isSubmittingFinal
                        ? "bg-gradient-to-r from-purple-600 to-violet-600 text-white"
                        : "bg-slate-200 text-slate-500 cursor-not-allowed"
                      }`}
                  >
                    {isSubmittingFinal ? "Submitting..." : "Submit Final Review"}
                  </motion.button>

                </div>
              </div>

            </div>
          </div>
        )}
        {isFinalSubmitted && report?.oneOnOneDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-purple-50 border border-purple-200 rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-semibold text-purple-700">
                1:1 Meeting Details
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Meeting Date</p>
                <p className="text-sm text-slate-800">
                  {new Date(report.oneOnOneDate).toLocaleDateString()}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Meeting Notes</p>
                <p className="text-sm text-slate-800 whitespace-pre-line">
                  {report.oneOnOneComment || "-"}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* HR SUMMARY */}
        {isPMS_HR(user) && status === "manager_submitted" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-slate-800">
                Manager Final Summary
              </h3>
            </div>

            <div className="grid md:grid-cols-[1fr_auto] gap-6">
              <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
                <p className="text-sm whitespace-pre-line">
                  {report.overallResponse || EMPTY}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center min-w-[140px] border-l border-slate-200 pl-6">
                <p className="text-xs text-slate-500 uppercase mb-3">
                  Overall Rating
                </p>

                {renderStars(report.overallRating || 0)}
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}