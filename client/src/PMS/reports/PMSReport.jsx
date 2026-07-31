import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
 import getAuthAxios from "../../utils/authAxios";
import Loader from "../components/Loader";
import HeaderSwitch from "./HeaderSwitch";
import EmployeeReviewView from "./EmployeeReviewView";
import MyReportView from "./MyReportView";
import { Users, FileText, Calendar, ArrowRight } from "lucide-react";
// import * as XLSX from "xlsx";
import * as XLSX from "xlsx";


import { Download } from "lucide-react";
import { isPMS_Employee, isPMS_HR, isPMS_Manager } from "../../utils/pmsrolecheck";


export default function PMSReport() {
  const navigate = useNavigate();
  const { employeeId } = useParams();

  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState("employees");
  const [searchTerm, setSearchTerm] = useState("");

  const [employees, setEmployees] = useState([]);
  const [report, setReport] = useState(null);
  const [myReport, setMyReport] = useState(null);

  const [loading, setLoading] = useState(true);
  const [reportTab, setReportTab] = useState("submitted");

  const [managerFeedback, setManagerFeedback] = useState("");
  const [managerRating, setManagerRating] = useState(0);
  const [normalizedKras, setNormalizedKras] = useState([]);
  const [nonSubmitters, setNonSubmitters] = useState([]);

  // LOAD USER
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const getUserId = (user) => user?._id || user?.id || user?.userId;

  const getReportStatus = (emp) => {
    if (!emp) return "pending";

    if (emp.status === "final_manager_reviewed" || emp.managerSubmitted) {
      return "completed";
    }

    if (emp.submittedAt) {
      return "manager_pending";
    }

    return "pending";
  };

  useEffect(() => {
    if (!user) return;
    if (employeeId) return;
    if (isPMS_Employee(user)) setViewMode("my");
    else setViewMode("employees");
  }, [user, employeeId]);

  // LOAD EMPLOYEE REPORT (MANAGER/HR VIEW)
  useEffect(() => {
    if (!user || !(isPMS_Employee(user) || isPMS_Manager(user) || isPMS_HR(user))) return;
    if (!employeeId) return; // only fetch a single report when route param exists

    const loadReport = async () => {
      try {
        setLoading(true);
        const api = await getAuthAxios();

        let res;
        if (isPMS_Manager(user)) {
          const managerId = getUserId(user);
          res = await api.get(
            `/reports/manager/${managerId}/employee/${employeeId}`
          );
        } else if (isPMS_HR(user)) {
          res = await api.get(`/reports/hr/${employeeId}`);
        } else {
          return;
        }

        setReport({
          ...res.data,
          templateId: res.data.templateId, // 🔥 FORCE it onto report
        });

      } catch (err) {
        console.error("Failed to load report", err);
        setReport(null);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [user, employeeId]);

  // LOAD EMPLOYEE LIST (MANAGER/HR)
  useEffect(() => {
    if (!user) return;
    if (!(isPMS_Manager(user) || isPMS_HR(user)) || employeeId) return;

    const loadEmployees = async () => {
      try {
        setLoading(true);
        const api = await getAuthAxios();

        let res;

        if (isPMS_Manager(user)) {
          const managerId = getUserId(user);
          res = await api.get(`/reports/manager/${managerId}/employees`);

          setEmployees(
            (res.data || []).map((r) => ({
              id: r.employeeId,
              name: r.employeeName,
              email: r.employeeEmail,
              submittedAt: r.submittedAt,
              reviewedAt: r.reviewedAt,
              role: r.employeeRole,
              status: r.status,
              managerResponse: r.managerResponse || null
            }))
          );
        } else if (isPMS_HR(user)) {
          res = await api.get(`/reports/employees`);

          setEmployees(
            (res.data || []).map((r) => ({
              id: r.employeeId,
              name: r.employeeName,
              email: r.employeeEmail || "",
              status: r.status ?? "unknown",
              overallRating: r.overallRating ?? null,
              submittedAt: r.submittedAt,
              reviewedAt: r.reviewedAt,
              role: r.employeeRole,
              managerResponse: r.managerResponse || null
            }))
          );
        }
        try {
          const managerId = isPMS_Manager(user) ? getUserId(user) : null;
          const nsUrl = managerId
            ? `/reports/non-submitters?manager_id=${managerId}`
            : `/reports/non-submitters`;
          const nsRes = await api.get(nsUrl);
          setNonSubmitters(nsRes.data || []);
        } catch {
          setNonSubmitters([]);
        }
      } catch (err) {
        console.error("Failed to load employees", err);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, [user, employeeId]);

  const formatDateTime = (date) =>
    date
      ? new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      : "—";

  useEffect(() => {
    if (!user) return;

    const loadMyReport = async () => {
      try {
        setLoading(true);
        const api = await getAuthAxios();
        const res = await api.get(`/reports/employee/${getUserId(user)}`);
        const reportData = res.data;

        let reportVisibility = "none";
        let reportVisibleTo = [];
        let cycleName = reportData.cycle || null; // keep existing value as fallback

        try {
          const cyclesRes = await api.get(`/cycles/`);
          const allCycles = cyclesRes.data || [];
          const myId = getUserId(user);

          const visibleCycle = allCycles.find((c) => {
            if (c.reportVisibility === "all") return true;
            if (
              c.reportVisibility === "selected" &&
              Array.isArray(c.reportVisibleTo) &&
              c.reportVisibleTo.includes(myId)
            ) {
              return true;
            }
            return false;
          });

          if (visibleCycle) {
            reportVisibility = visibleCycle.reportVisibility;
            reportVisibleTo = visibleCycle.reportVisibleTo || [];
            cycleName = visibleCycle.name || cycleName; // ✅ just grab the name for display
          }
        } catch (err) {
          console.error("Failed to load cycles for visibility check:", err);
          reportVisibility = "none";
        }

        setMyReport({
          ...reportData,
          reportVisibility,
          reportVisibleTo,
          cycle: cycleName, // ✅ overwrite cycle with the resolved name
        });

      } catch (err) {
        console.error(err);
        setMyReport(null);
      } finally {
        setLoading(false);
      }
    };

    loadMyReport();
  }, [user]);
  const getEmployeeReviewStatus = (emp) => {
    if (
      emp.status === "final_manager_reviewed" ||
      emp.status === "manager_submitted"    // ✅ ADD THIS
    ) {
      return "reviewed";
    }

    // ✅ Only show in "submitted" tab if employee has actually submitted
    if (
      emp.status === "final_employee_submitted" ||
      emp.status === "employee_submitted" ||
      emp.submittedAt
    ) {
      return "submitted";
    }

    return "pending"; // not shown in either tab
  };

  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      !searchTerm.trim() ||
      emp.name?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term);

    const status = getEmployeeReviewStatus(emp);

    // ✅ Don't show "pending" in either tab
    if (status === "pending") return false;

    const matchesTab =
      reportTab === "submitted"
        ? status === "submitted"
        : status === "reviewed";

    return matchesSearch && matchesTab;
  });

  // ✅ Update counts too
  const submittedCount = employees.filter(
    (e) => getEmployeeReviewStatus(e) === "submitted"
  ).length;

  const reviewedCount = employees.filter(
    (e) => getEmployeeReviewStatus(e) === "reviewed"
  ).length;

  // MANAGER SUBMIT
  const submitManagerReview = async (data) => {
    // Only review after employee has submitted the self review
    const employeeKras = normalizedKras.filter(
      (k) => k.response && k.response.trim().length > 0
    );

    // Allow manager/HR to review a single KRA or many:
    // consider only KRAs where manager has actually given rating & comment.
    const reviewedKras = employeeKras.filter(
      (k) => k.managerRating > 0 && k.managerResponse?.trim()
    );

    if (!reviewedKras.length) {
      Swal.fire(
        "No Review Entered",
        "Please provide Manager Comment and Manager Rating for at least one KRA before submitting.",
        "warning"
      );
      return;
    }

    // Derive overall rating & comment automatically from the reviewed KRAs only
    const ratedKras = reviewedKras;
    const overallRatingCalc =
      ratedKras.length > 0
        ? ratedKras.reduce((sum, k) => sum + k.managerRating, 0) /
        ratedKras.length
        : 0;

    const overallResponseCalc =
      reviewedKras
        .map(
          (k, idx) =>
            `${idx + 1}. ${k.name || k.kraName || "KRA"}: ${(
              k.managerResponse || ""
            ).trim()}`
        )
        .join("\n\n")
        .trim() || "Manager review submitted";

    if (!employeeKras.length) {
      Swal.fire(
        "Awaiting Self Review",
        "Employee has not submitted the self review yet. Please wait for employee submission before giving manager feedback & rating.",
        "info"
      );
      return;
    }

    try {
      const api = await getAuthAxios();
      await api.post("/reports/manager-review", {
        employeeId,
        templateId: report.templateId || temp.id,
        managerId: getUserId(user),
        // only persist KRAs the manager actually reviewed in this submit
        kras: reviewedKras,
        overallResponse: overallResponseCalc,
        overallRating: overallRatingCalc,
        status: "manager_submitted",
        oneOnOneDate: data.oneOnOneDate,
        oneOnOneComment: data.oneOnOneComment,
      });

      Swal.fire("Submitted", "success");
      navigate(-1);
    } catch {
      Swal.fire("Error", "Submission failed", "error");
    }
  };
  /* ================================
     HELPERS
  ================================ */
  const safe = (val, fallback = "—") =>
    val === undefined || val === null || val === "" ? fallback : val;

  const ratingToStars = (rating) => {
    if (!rating || rating <= 0) return "—";
    return "★".repeat(Math.min(5, Math.round(rating)));
  };

  // Numeric rating, one decimal place (used in the Excel export instead of stars)
  const formatRatingNumber = (rating) => {
    if (rating === undefined || rating === null || rating <= 0) return "—";
    return Number(rating).toFixed(1);
  };

  const formatMonthYear = (dateValue) => {
    if (!dateValue) return "—";

    const date = new Date(dateValue);
    if (isNaN(date)) return "—";

    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",   // "long" if you want full month name
      year: "numeric",
    });
  };
  /* ================================
     EXPORT ALL EMPLOYEE REPORTS
  ================================ */
  const handleExportAll = async () => {
    if (!filteredEmployees?.length) {
      Swal.fire("No data", "No employees to export", "info");
      return;
    }

    try {
      Swal.fire({
        title: "Exporting reports…",
        text: "Please wait",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const api = await getAuthAxios();

      /* ================================
         SHEET HEADER (main summary — no more KRA Details column)
      ================================= */
      const header = [
        "Employee Name",
        "Employee Email",
        "Employee Role",
        "Reporting Manager",
        "Status",
        "Cycle",
        "Submitted At",
        "Self Avg Rating",
        "Manager Avg Rating",
        "Final Avg Rating",
        "1:1 Meeting Date",
        "1:1 Meeting Summary",
      ];

      const rows = [header];

      /* ================================
         KRA DETAILS SHEET (one row per KRA, not one blob per employee)
      ================================= */
      const kraHeader = [
        "Employee Name",
        "Employee Email",
        "KRA No",
        "KRA Name",
        "Weight (%)",
        "Employee Response",
        "Employee Rating",
        "Manager Response",
        "Manager Rating",
      ];
      const kraRows = [kraHeader];

      /* ================================
         FETCH + BUILD ROWS
      ================================= */
      const exportEmployees = employees.filter((emp) => {
        const status = getEmployeeReviewStatus(emp);
        return reportTab === "submitted"
          ? status === "submitted"
          : status === "reviewed";
      });

      for (const emp of exportEmployees) {
        try {
          const { data: r } = await api.get(`/reports/employee/${emp.id}`);

          rows.push([
            safe(r.employeeName),
            safe(r.employeeEmail),
            safe(r.employeeRole),
            safe(r.reportingManagerName),
            r.status === "final_manager_reviewed" ? "Reviewed" : "Submitted",
            Array.isArray(r.cycle) ? r.cycle.join(", ") : safe(r.cycle),
            formatMonthYear(r.submittedAt || r.updatedAt || r.managerActionAt),
            formatRatingNumber(r.selfAvg),
            formatRatingNumber(r.managerAvg),
            formatRatingNumber(r.avgRating),
            formatMonthYear(r.oneOnOneDate),
            safe(r.oneOnOneComment),
          ]);

          if (Array.isArray(r.kras) && r.kras.length) {
            r.kras.forEach((k, index) => {
              kraRows.push([
                safe(r.employeeName),
                safe(r.employeeEmail),
                index + 1,
                safe(k.kraName || k.name),
                safe(k.weight),
                safe(k.response),
                formatRatingNumber(k.selfRating || k.rating),
                safe(k.managerResponse, "Not Provided"),
                formatRatingNumber(k.managerRating),
              ]);
            });
          }
        } catch (empError) {
          console.error("Employee export failed:", emp.id, empError);
        }
      }

      /* ================================
         CREATE WORKBOOK — TWO SHEETS
      ================================= */
      const wb = XLSX.utils.book_new();

      // --- Sheet 1: Summary ---
      const summarySheet = XLSX.utils.aoa_to_sheet(rows);
      summarySheet["!cols"] = [
        { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 14 },
        { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
        { wch: 16 }, { wch: 40 },
      ];

      // --- Sheet 2: KRA Details ---
      const kraSheet = XLSX.utils.aoa_to_sheet(kraRows);
      kraSheet["!cols"] = [
        { wch: 22 }, { wch: 28 }, { wch: 8 }, { wch: 26 }, { wch: 12 },
        { wch: 50 }, { wch: 15 }, { wch: 50 }, { wch: 15 },
      ];

      // bold headers on both sheets
      [[summarySheet, header], [kraSheet, kraHeader]].forEach(([sheet, hdr]) => {
        hdr.forEach((_, colIdx) => {
          const addr = XLSX.utils.encode_cell({ r: 0, c: colIdx });
          if (sheet[addr]) {
            sheet[addr].s = {
              font: { bold: true },
              fill: { fgColor: { rgb: "E5E7EB" } },
            };
          }
        });
      });

      // wrap text + top-align on both sheets
      [summarySheet, kraSheet].forEach((sheet) => {
        const range = XLSX.utils.decode_range(sheet["!ref"]);
        for (let R = range.s.r; R <= range.e.r; R++) {
          for (let C = range.s.c; C <= range.e.c; C++) {
            const addr = XLSX.utils.encode_cell({ r: R, c: C });
            if (!sheet[addr]) continue;
            sheet[addr].s = {
              ...(sheet[addr].s || {}),
              alignment: { wrapText: true, vertical: "top" },
            };
          }
        }
      });

      // row heights
      summarySheet["!rows"] = rows.map(() => ({ hpt: 22 }));
      kraSheet["!rows"] = kraRows.map((row) => {
        const longest = Math.max(...row.map((c) => String(c || "").length));
        return { hpt: Math.min(120, Math.max(22, Math.ceil(longest / 60) * 15)) };
      });

      // freeze header row on both sheets
      summarySheet["!freeze"] = { xSplit: 0, ySplit: 1 };
      kraSheet["!freeze"] = { xSplit: 0, ySplit: 1 };

      XLSX.utils.book_append_sheet(wb, summarySheet, "All Employee Reports");
      XLSX.utils.book_append_sheet(wb, kraSheet, "KRA Details");

      XLSX.writeFile(wb, "PMS_All_Employee_Reports.xlsx");

      Swal.close();

    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to export reports", "error");
    }
  };

  // LOADING
  if (loading) {
    return (
      <Loader containerClass="flex flex-col items-center justify-center h-[60vh] gap-3" />
    );
  }

  // EMPLOYEE LIST VIEW
  if (
    viewMode === "employees" &&
    !employeeId &&
    user &&
    (isPMS_Manager(user) || isPMS_HR(user))
  ) {
    const StatusBadge = ({ status }) => {
      if (status === "completed") {
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
            Final Rating Completed
          </span>
        );
      }

      if (status === "manager_pending") {
        return (
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
            Manager Review Pending
          </span>
        );
      }

      return (
        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
          Self Review Pending
        </span>
      );
    };
    const notSubmittedCount = nonSubmitters.length;
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Performance Reports
              </h1>
              <p className="text-gray-600">
                Review and manage employee performance reports
              </p>
            </div>
          </motion.div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Left: Header Switch */}
            <HeaderSwitch
              viewMode={viewMode}
              setViewMode={setViewMode}
              user={user}
            />

            {/* Right: Search + Export */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Search */}
              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name / email"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 pl-9 text-sm shadow-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                />
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                  />
                </svg>
              </div>

              {/* Export All */}
              <motion.button
                onClick={handleExportAll}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-purple-700"
              >
                <Download size={16} />
                Export All
              </motion.button>
            </div>
          </div>

          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden w-fit">

            <button
              onClick={() => setReportTab("submitted")}
              className={`px-5 py-2 text-sm font-semibold flex items-center gap-2
      ${reportTab === "submitted"
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"}
    `}
            >
              Submitted
              <span className={`text-xs px-2 py-0.5 rounded-full 
      ${reportTab === "submitted"
                  ? "bg-white text-violet-600"
                  : "bg-gray-200"}
    `}>
                {submittedCount}
              </span>
            </button>

            <button
              onClick={() => setReportTab("reviewed")}
              className={`px-5 py-2 text-sm font-semibold flex items-center gap-2
      ${reportTab === "reviewed"
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"}
    `}
            >
              Reviewed
              <span className={`text-xs px-2 py-0.5 rounded-full 
      ${reportTab === "reviewed"
                  ? "bg-white text-violet-600"
                  : "bg-gray-200"}
    `}>
                {reviewedCount}
              </span>
            </button>
            <button
              onClick={() => setReportTab("not-submitted")}
              className={`px-5 py-2 text-sm font-semibold flex items-center gap-2
    ${reportTab === "not-submitted"
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"}
  `}
            >
              Self Review Pending
              <span className={`text-xs px-2 py-0.5 rounded-full 
    ${reportTab === "not-submitted"
                  ? "bg-white text-violet-600"
                  : "bg-gray-200"}
  `}>
                {notSubmittedCount}
              </span>
            </button>

          </div>

          {/* Employee List */}
          <div className="space-y-3">
            {reportTab === "not-submitted" ? (
              nonSubmitters.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-lg"
                >
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600">All employees have submitted</p>
                </motion.div>
              ) : (
                nonSubmitters
                  .filter(u =>
                    !searchTerm.trim() ||
                    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((u, index) => (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 rounded-xl bg-white px-6 py-4 shadow-md border border-gray-200"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-orange-200 text-base font-bold text-red-700">
                        {u.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                        {u.email && <p className="text-xs text-gray-500">{u.email}</p>}
                      </div>
                      <span className="ml-auto text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 font-medium">
                        Self Review Pending
                      </span>
                    </motion.div>
                  ))
              )
            ) : (
              filteredEmployees.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-lg"
                >
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-600">
                    No employees found
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Employee reports will appear here once submitted
                  </p>
                </motion.div>
              ) : (
                filteredEmployees.map((emp, index) => (

                  <motion.div
                    key={emp.id || `emp-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => emp.id && navigate(`/reports/${emp.id}`)}
                    className="group relative flex items-center justify-between rounded-xl bg-white px-6 py-4 cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200"
                    whileHover={{ y: -2, scale: 1.01 }}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <motion.div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-purple-200 text-lg font-bold text-violet-700 shadow-lg"
                        transition={{ duration: 0.5 }}
                      >
                        {emp.name?.charAt(0)?.toUpperCase() || "?"}
                      </motion.div>

                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-gray-800 truncate">
                          {emp.name}
                        </p>
                        {emp.email && (
                          <p className="text-sm text-gray-500 truncate">
                            {emp.email}
                          </p>
                        )}
                      </div>

                      <div className="hidden md:flex flex-col items-end gap-1 pl-4 border-l border-gray-200">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span className="uppercase tracking-wide">
                            {emp.status === "final_manager_reviewed" ? "Reviewed" : "Submitted"}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {formatDateTime(
                            emp.status === "final_manager_reviewed" ? emp.reviewedAt : emp.submittedAt
                          )}
                        </span>
                      </div>
                    </div>

                    <motion.div
                      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg ml-4"
                      whileHover={{ gap: 8 }}
                    >
                      <span>View Report</span>
                      <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  </motion.div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // MY REPORT VIEW
  if (viewMode === "my") {
    if (!myReport) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-600">Report not available yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Your performance report will appear here once submitted
            </p>
          </motion.div>
        </div>
      );
    }

    return (
      <MyReportView
        report={myReport}
        onBack={() => setViewMode("employees")}
        user={user}
      />
    );
  }

  // EMPLOYEE REVIEW VIEW
  if (employeeId && (isPMS_Manager(user) || isPMS_HR(user))) {
    return (
      <EmployeeReviewView
        key={employeeId}
        report={report}
        user={user}
        normalizedKras={normalizedKras}
        setNormalizedKras={setNormalizedKras}
        feedback={managerFeedback}
        setFeedback={setManagerFeedback}
        rating={managerRating}
        setRating={setManagerRating}
        onSubmit={submitManagerReview}
        onBack={() => navigate(-1)}
      />

    );
  }

  return null;
}