import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
 import getAuthAxios from "../../utils/authAxios";
import Loader from "../components/Loader";
import StatsCard from "../components/StatsCard";
import FilterToolbar from "../components/FilterToolbar";
import HeaderSwitch from "./HeaderSwitch";
import EmployeeReviewView from "./EmployeeReviewView";
import MyReportView from "./MyReportView";
import { Users, FileText, Calendar, ArrowRight, Send, Eye, UserX, ChevronDown, ChevronLeft, Building2, User as UserIcon, Filter } from "lucide-react";
// import * as XLSX from "xlsx";
import * as XLSX from "xlsx";


import { Download } from "lucide-react";
import { isPMS_Employee, isPMS_HR, isPMS_Manager } from "../../utils/pmsrolecheck";

const PAGE_SIZE = 9;
const AVATAR_STYLES = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-pink-100 text-pink-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-cyan-100 text-cyan-700",
];

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
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("all");
  const [kraMap, setKraMap] = useState({});

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
        const managerId = isPMS_Manager(user) ? getUserId(user) : null;

        if (isPMS_Manager(user)) {
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
              managerResponse: r.managerResponse || null,
              cycleId: r.cycleId || null,
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
              managerResponse: r.managerResponse || null,
              cycleId: r.cycleId || null,
            }))
          );
        }

        try {
          const nsUrl = managerId ? `/reports/non-submitters?manager_id=${managerId}` : `/reports/non-submitters`;
          const nsRes = await api.get(nsUrl);
          setNonSubmitters(nsRes.data || []);
        } catch {
          setNonSubmitters([]);
        }

        try {
          const kraRes = await api.get(`/kpi-template/search-user`);
          const map = {};
          (kraRes.data || []).forEach((u) => {
            map[u.id] = { hasKRA: !!u.hasKRA, managerName: u.manager_name || null };
          });
          setKraMap(map);
        } catch (err) {
          console.error("Failed to load KRA assignment data", err);
          setKraMap({});
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

  const availableRoles = [...new Set(employees.map((e) => e.role).filter(Boolean))];

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

    const matchesRole = roleFilter === "all" || emp.role === roleFilter;

    return matchesSearch && matchesTab && matchesRole;
  });

  // ✅ Update counts too
  const submittedCount = employees.filter(
    (e) => getEmployeeReviewStatus(e) === "submitted"
  ).length;

  const reviewedCount = employees.filter(
    (e) => getEmployeeReviewStatus(e) === "reviewed"
  ).length;

  const notSubmittedList = nonSubmitters.filter(
    (u) =>
      !searchTerm.trim() ||
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayList =
    reportTab === "not-submitted"
      ? [...notSubmittedList].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      : [...filteredEmployees].sort((a, b) => {
          if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
          const aDate = reportTab === "reviewed" ? a.reviewedAt : a.submittedAt;
          const bDate = reportTab === "reviewed" ? b.reviewedAt : b.submittedAt;
          return new Date(bDate || 0) - new Date(aDate || 0);
        });

  const totalPages = Math.max(1, Math.ceil(displayList.length / PAGE_SIZE));
  const pageItems = displayList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      toast.warning("Please provide Manager Comment and Manager Rating for at least one KRA before submitting.");
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
      toast.info("Employee has not submitted the self review yet. Please wait for employee submission before giving manager feedback & rating.");
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

      toast.success("Submitted");
      navigate(-1);
    } catch {
      toast.error("Submission failed");
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
      toast.info("No employees to export");
      return;
    }

    let exportToastId;
    try {
      exportToastId = toast.loading("Exporting reports…", { description: "Please wait" });

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
            formatDateTime(r.submittedAt || r.updatedAt || r.managerActionAt),
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

      toast.dismiss(exportToastId);

    } catch (err) {
      console.error(err);
      toast.dismiss(exportToastId);
      toast.error("Failed to export reports");
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
    const notSubmittedCount = nonSubmitters.length;
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-8">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 mb-1">
                Performance Reports
              </h1>
              <p className="text-sm text-slate-500">
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

            {/* Right: Export */}
            <motion.button
              onClick={handleExportAll}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-purple-700 shrink-0"
            >
              <Download size={16} />
              Export All
            </motion.button>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              icon={Send}
              label="Submitted"
              value={submittedCount}
              accent="violet"
              active={reportTab === "submitted"}
              onClick={() => {
                setReportTab("submitted");
                setPage(1);
              }}
            />
            <StatsCard
              icon={Eye}
              label="Reviewed"
              value={reviewedCount}
              accent="emerald"
              active={reportTab === "reviewed"}
              onClick={() => {
                setReportTab("reviewed");
                setPage(1);
              }}
            />
            <StatsCard
              icon={UserX}
              label="Self Review Pending"
              value={notSubmittedCount}
              accent="amber"
              active={reportTab === "not-submitted"}
              onClick={() => {
                setReportTab("not-submitted");
                setPage(1);
              }}
            />
          </div>

          {/* Filters */}
          <FilterToolbar
            search={{
              value: searchTerm,
              onChange: (v) => {
                setSearchTerm(v);
                setPage(1);
              },
              placeholder: "Search name / email",
            }}
          >
            <button type="button" disabled title="Department grouping isn't available yet"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed shrink-0">
              <Building2 className="w-3.5 h-3.5" />
              All Departments
            </button>

            {reportTab !== "not-submitted" && (
              <div className="relative shrink-0">
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="appearance-none flex items-center gap-1.5 pl-8 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 outline-none focus:border-violet-300 cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
                <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            )}

            <div className="relative shrink-0">
              <select
                value={reportTab}
                onChange={(e) => {
                  setReportTab(e.target.value);
                  setPage(1);
                }}
                className="appearance-none flex items-center gap-1.5 pl-8 pr-8 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 outline-none focus:border-violet-300 cursor-pointer"
              >
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="not-submitted">Self Review Pending</option>
              </select>
              <Filter className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>

            {reportTab !== "not-submitted" && (
              <div className="relative shrink-0 ml-auto">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="appearance-none rounded-xl border border-gray-200 bg-white pl-3 pr-8 py-2 text-xs font-semibold text-gray-600 outline-none focus:border-violet-300 cursor-pointer"
                >
                  <option value="recent">Sort by: Recently {reportTab === "reviewed" ? "reviewed" : "submitted"}</option>
                  <option value="name">Sort by: Name A-Z</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            )}
          </FilterToolbar>

          {/* Employee List */}
          {pageItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm"
            >
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600">
                {reportTab === "not-submitted" ? "All employees have submitted" : "No employees found"}
              </p>
              {reportTab !== "not-submitted" && (
                <p className="text-sm text-gray-500 mt-2">Employee reports will appear here once submitted</p>
              )}
            </motion.div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pageItems.map((item, index) =>
                  reportTab === "not-submitted" ? (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 bg-red-100 text-red-700">
                          {item.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                          <p className="text-xs text-gray-400 truncate">{item.email || ""}</p>
                        </div>
                      </div>
                      <span className="mt-3 inline-block w-fit text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
                        Self Review Pending
                      </span>
                    </div>
                  ) : (
                    <div
                      key={item.id || `emp-${index}`}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col hover:shadow-md hover:border-violet-200 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${AVATAR_STYLES[index % AVATAR_STYLES.length]}`}>
                            {item.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{item.name}</p>
                            <p className="text-xs text-gray-400 truncate">{item.email || ""}</p>
                          </div>
                        </div>
                        <span className="flex flex-col items-end gap-0.5 text-xs text-gray-400 shrink-0 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {reportTab === "reviewed" ? "Reviewed" : "Submitted"}
                          </span>
                          <span>{formatDateTime(reportTab === "reviewed" ? item.reviewedAt : item.submittedAt)}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">KRA Assigned</p>
                          <p className={`text-xs font-semibold mt-0.5 ${kraMap[item.id]?.hasKRA ? "text-emerald-600" : "text-gray-400"}`}>
                            {kraMap[item.id]?.hasKRA ? "Yes" : "No"}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Reports To</p>
                          <p className="text-xs font-semibold text-gray-700 mt-0.5 truncate">{kraMap[item.id]?.managerName || "—"}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</p>
                          <p className="text-xs font-semibold text-violet-600 mt-0.5">
                            {reportTab === "reviewed" ? "Reviewed" : "Submitted"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => item.id && navigate(`/reports/${item.id}`)}
                        className="mt-3 w-full py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition flex items-center justify-center gap-1.5"
                      >
                        View Report
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-gray-400">
                  Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, displayList.length)} of {displayList.length} reports
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-40 hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold ${
                          n === page
                            ? "bg-gradient-to-r from-violet-700 to-violet-500 text-white shadow-sm"
                            : "text-gray-500 hover:bg-gray-50 border border-gray-200"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-40 hover:bg-gray-50"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
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