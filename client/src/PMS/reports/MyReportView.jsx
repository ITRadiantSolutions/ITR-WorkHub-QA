import { motion } from "framer-motion";
import { ArrowLeft, Star, CheckCircle2, Clock, TrendingUp, Download } from "lucide-react";
 import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
export default function MyReportView({ report, onBack, user }) {
  const navigate = useNavigate();
  //console.log("Before", report)

  const deduped = [];
  const seenNames = new Map();

  (report?.kras || [])
    .filter((kra) => Number(kra.weight ?? 0) > 0)
    .forEach((kra) => {
      const name = (kra.kraName ?? kra.name ?? "").toLowerCase().trim();
      const hasContent =
        (kra.response ?? "").trim() ||
        Number(kra.selfRating ?? kra.rating ?? 0) > 0;

      if (!seenNames.has(name)) {
        seenNames.set(name, deduped.length);
        deduped.push(kra);
      } else if (hasContent) {
        deduped[seenNames.get(name)] = kra; // replace ghost with real
      }
    });

  const normalizedKras = deduped.map((kra, idx) => ({
    name: kra.kraName || kra.name || `KRA ${idx + 1}`,
    weight: kra.weight ?? 0,
    kpis: Array.isArray(kra.kpis)
      ? kra.kpis.map((kpi, i) => ({
        name:
          typeof kpi === "string"
            ? kpi
            : kpi.name ?? kpi.title ?? kpi.kpiName ?? `KPI ${i + 1}`,
        weight: typeof kpi === "object" ? Number(kpi.weight ?? 0) : 0,
      }))
      : [],
    response: kra.employeeResponse ?? kra.response ?? kra.selfResponse ?? kra.comment ?? "—",
    rating: kra.selfRating ?? kra.rating ?? 0,
    managerResponse: kra.managerResponse,
    managerRating: kra.managerRating ?? 0,
  }));

  // Check if this user is allowed to see the report
  const visibilitySetting = report.reportVisibility || "none";
  //console.log("reportVisibility:", report.reportVisibility);
  const isAllowed =
    isPMS_HR(user) ||                                          // HR always sees
    visibilitySetting === "all" ||                         // everyone allowed
    (visibilitySetting === "selected" &&
      (report.reportVisibleTo || []).includes(user?.id || user?._id));

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white p-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-700">Report Not Available Yet</h2>
          <p className="text-gray-500 text-sm">
            Your HR team hasn't released your report yet. Please check back later.
          </p>
          <button
            onClick={() => navigate("/mytemplate")}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
          >
            <ArrowLeft size={16} />
            Go to My KRA
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <p className="text-lg text-gray-600">Report not available</p>
        </motion.div>
      </div>
    );
  }

  const getRatingColor = (rating) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };
  // const ratingToStars = (rating) => {
  //   if (rating === null || rating === undefined || rating <= 0) return "—";

  //   const value = Number(rating);

  //   const fullStars = Math.floor(value);
  //   const halfStar = value % 1 >= 0.5 ? "½" : "";

  //   return "★".repeat(fullStars) + halfStar;
  // };
  const ratingToNumber = (rating) => {
    if (rating === null || rating === undefined || rating === 0) return "—";
    return Number(rating).toFixed(1);
  };

  const handleExport = () => {
    /* ============================
       REPORT SUMMARY
    ============================ */

    const summaryData = [
      ["SECTION", "FIELD", "VALUE"],

      ["Employee", "Employee Name", report.employeeName || "—"],
      ["Employee", "Employee Email", report.employeeEmail || "—"],
      ["Employee", "Employee Role", report.employeeRole || "—"],

      [
        "Cycle",
        "Review Cycle",
        Array.isArray(report.cycle)
          ? report.cycle.join(", ")
          : report.cycle || "—",
      ],

      [
        "Cycle",
        "Submission Date",
        report.submittedAt ||
          report.employeeSubmittedAt ||
          report.managerSubmittedAt ||
          report.updatedAt
          ? new Date(
            report.submittedAt ||
            report.employeeSubmittedAt ||
            report.managerSubmittedAt ||
            report.updatedAt
          ).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
          : "—",
      ],

      ["Ratings", "Self Average Rating", ratingToNumber(report.selfAvg)],
      ["Ratings", "Manager Average Rating", ratingToNumber(report.managerAvg)],
      ["Ratings", "Final Average Rating", ratingToNumber(report.avgRating)],

      ["Status", "Employee Submitted", report.submitted ? "Yes" : "No"],
      ["Status", "Manager Reviewed", report.managerSubmitted ? "Yes" : "No"],

    ];

    /* ============================
       KRA DETAILS
    ============================ */

    const kraData = [
      [
        "KRA No",
        "KRA Name",
        "Weight (%)",
        "KPI Name",
        "KPI Weight (%)",
        "Employee Response",
        "Employee Rating",
        "Manager Response",
        "Manager Rating",
      ],
    ];

    normalizedKras.forEach((kra, index) => {
      if (kra.kpis && kra.kpis.length > 0) {
        kra.kpis.forEach((kpi, kpiIndex) => {
          kraData.push([
            index + 1,
            kpiIndex === 0 ? kra.name : "",
            kpiIndex === 0 ? kra.weight : "",
            kpi.name || "—",
            kpi.weight ?? "—",
            kpiIndex === 0 ? kra.response || "—" : "",         // ✅ KEEP FORMAT
            kpiIndex === 0 ? ratingToNumber(kra.rating) : "",
            kpiIndex === 0 ? kra.managerResponse || "—" : "", // ✅ KEEP FORMAT
            kpiIndex === 0 ? ratingToNumber(kra.managerRating) : "",
          ]);
        });
      } else {
        kraData.push([
          index + 1,
          kra.name,
          kra.weight,
          "—",
          "—",
          kra.response || "—",
          ratingToNumber(kra.rating),
          kra.managerResponse || "—",
          ratingToNumber(kra.managerRating),
        ]);
      }
    });

    /* ============================
       CREATE WORKBOOK
    ============================ */

    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    const kraSheet = XLSX.utils.aoa_to_sheet(kraData);

    /* ============================
       COLUMN WIDTH IMPROVEMENT
    ============================ */

    summarySheet["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 70 }, // Wider for long feedback
    ];

    kraSheet["!cols"] = [
      { wch: 8 },
      { wch: 25 },
      { wch: 14 },
      { wch: 25 },
      { wch: 14 },
      { wch: 60 }, // Employee response
      { wch: 18 },
      { wch: 60 }, // Manager response
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(wb, kraSheet, "KRA Details");

    XLSX.writeFile(
      wb,
      `PMS_Report_${report.employeeName || "Employee"}.xlsx`
    );
  };



  //console.log("----", report)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >

          {/* LEFT SIDE */}
          <div className="flex items-center gap-3">

            {(isPMS_Manager(user) || isPMS_HR(user)) && (
              <motion.button
                onClick={onBack}
                className="p-2 bg-white rounded-lg shadow-md border hover:bg-gray-100 text-gray-700"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft size={18} />
              </motion.button>
            )}

            <div>
              <h1 className="text-xl font-extrabold text-slate-900 mb-1">
                My Performance Review
              </h1>
              <p className="text-sm text-slate-500">
                {report.employeeName ||
                  report.username ||
                  report.mail ||
                  "Employee"}
              </p>
            </div>

          </div>

          {/* RIGHT SIDE */}
          <motion.button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Download size={18} />
            <span>Export</span>
          </motion.button>

        </motion.div>

        {/* Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-4 bg-violet-50 rounded-xl">
              <div className="p-2 bg-violet-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Cycle</p>
                <p className="text-sm font-bold text-gray-800">
                  {Array.isArray(report.cycle)
                    ? report.cycle.join(", ")
                    : report.cycle || "—"}

                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star className="w-5 h-5 text-purple-600 fill-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Your Rating</p>
                <p className="text-lg font-bold text-purple-600">
                  {report.selfAvg ? Number(report.selfAvg).toFixed(1) : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star className="w-5 h-5 text-purple-600 fill-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">
                  Manager Rating
                </p>
                <p className="text-lg font-bold text-purple-600">
                  {report.managerSubmitted
                    ? report.managerAvg ? Number(report.managerAvg).toFixed(1) : "—"
                    : "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Final Avg</p>
                <p className={`text-lg font-bold ${report.managerSubmitted ? getRatingColor(report.avgRating) : "text-gray-400"}`}>
                  {report.managerSubmitted
                    ? report.avgRating ? Number(report.avgRating).toFixed(1) : "—"
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Manager Overall Feedback */}
        {/* {report.managerSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-200 shadow-lg"
          >
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-violet-600" />
              Manager Overall Feedback
            </h3>
            <p className="text-gray-800 leading-relaxed whitespace-pre-line">
              {report.managerOverallResponse || "—"}
            </p>
          </motion.div>
        )} */}

        {report.managerSubmitted && report.oneOnOneDate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-purple-50 border border-purple-200 rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-bold text-purple-700">
                1:1 Meeting Details
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Meeting Date</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(report.oneOnOneDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Meeting Notes</p>
                <p className="text-sm text-gray-800 whitespace-pre-line">
                  {report.oneOnOneComment || "—"}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {!report.managerSubmitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 flex items-center gap-3"
          >
            <Clock className="w-5 h-5 text-yellow-600" />
            <p className="text-gray-700">
              Your manager has not submitted the review yet.
            </p>
          </motion.div>
        )}

        {/* Performance Breakdown */}
        {normalizedKras.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-bold text-slate-900">
              Performance Breakdown
            </h2>

            <div className="space-y-4">
              {normalizedKras.map((kra, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-all duration-300"
                >
                  {/* KRA Header */}
                  <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {idx + 1}. {kra.name}
                      </h3>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                          Weightage: <span className="font-semibold">{kra.weight}%</span>
                        </span>
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                          KRA
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KPIs */}
                  {Array.isArray(kra.kpis) && kra.kpis.length > 0 && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-semibold text-purple-700 mb-3 uppercase tracking-wide">
                        Key Performance Indicators
                      </p>
                      <div className="space-y-2">
                        {kra.kpis.map((kpi, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-4 py-2 bg-white rounded-lg border border-gray-200"
                          >
                            <span className="text-sm font-medium text-gray-800">
                              {kpi.name || "KPI"}
                            </span>
                            <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-semibold">
                              {kpi.weight ?? 0}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Responses */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Employee Response */}
                    <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                      <p className="text-sm font-semibold text-violet-700 mb-2">
                        Your Response
                      </p>
                      <p className="text-sm text-gray-800 mb-4">
                        {kra.response || "—"}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">
                          Rating:
                        </span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${star <= kra.rating
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-300"
                                }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-gray-600">
                          {kra.rating || 0}/5
                        </span>
                      </div>
                    </div>

                    {/* Manager Response */}
                    {report.managerSubmitted && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm font-semibold text-green-700 mb-2">
                          Manager Feedback
                        </p>
                        <p className="text-sm text-gray-800 mb-4">
                          {kra.managerResponse || "—"}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">
                            Rating:
                          </span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${star <= kra.managerRating
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-gray-300"
                                  }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-gray-600">
                            {kra.managerRating || 0}/5
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
