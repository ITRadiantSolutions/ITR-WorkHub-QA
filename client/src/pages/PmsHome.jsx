import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Calendar,
  User,
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  FileText,
} from "lucide-react";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../PMS/components/PageHeader";
import StatsCard from "../PMS/components/StatsCard";
import EmptyState from "../PMS/components/EmptyState";
import StatusBadge from "../PMS/components/StatusBadge";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

const SUBMISSION_TONE = {
  draft: "neutral",
  pending_manager_approval: "warning",
  manager_approved: "info",
  employee_submitted: "warning",
  final_employee_submitted: "warning",
  manager_reviewed: "info",
  final_manager_reviewed: "success",
};

const PAGE_SIZE_OPTIONS = [6, 12, 24];

const SORT_OPTIONS = [
  { value: "recent", label: "Sort by: Recently Submitted" },
  { value: "oldest", label: "Sort by: Oldest First" },
  { value: "rating_high", label: "Sort by: Rating High to Low" },
  { value: "rating_low", label: "Sort by: Rating Low to High" },
  { value: "name", label: "Sort by: Name A-Z" },
];

export default function PmsHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewPage, setReviewPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [cycleFilter, setCycleFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState("grid");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([API.get("/pms/cycles"), API.get("/pms/submissions")])
      .then(([cyclesRes, submissionsRes]) => {
        if (cancelled) return;
        setCycles(cyclesRes.data || []);
        setSubmissions(submissionsRes.data || []);
      })
      .catch((err) => !cancelled && setError(err.response?.data?.message || "Failed to load PMS data"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const isPmsHr = user?.roles?.pms === "hr";
  const employeeOpenCount = cycles.filter((c) => c.employeeResponse?.enabled).length;
  const managerOpenCount = cycles.filter((c) => c.managerResponse?.enabled).length;

  const cycleForSubmission = (s) => cycles.find((c) => String(c._id) === String(s.cycleId));

  const visibleSubmissions = submissions
    .filter((s) => !cycleFilter || String(s.cycleId) === cycleFilter)
    .slice()
    .sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
        case "rating_high":
          return (b.finalReport?.overallRating ?? -1) - (a.finalReport?.overallRating ?? -1);
        case "rating_low":
          return (a.finalReport?.overallRating ?? Infinity) - (b.finalReport?.overallRating ?? Infinity);
        case "name":
          return (a.employeeId?.name || "").localeCompare(b.employeeId?.name || "");
        case "recent":
        default:
          return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      }
    });

  const totalReviewPages = Math.max(1, Math.ceil(visibleSubmissions.length / pageSize));
  const pagedSubmissions = visibleSubmissions.slice((reviewPage - 1) * pageSize, reviewPage * pageSize);

  useEffect(() => setReviewPage(1), [pageSize, cycleFilter, sortBy, submissions.length]);

  const statCards = [
    {
      key: "cycles",
      icon: Calendar,
      accent: "violet",
      value: cycles.length,
      label: "Review Cycles",
      caption: "Active review cycles",
    },
    {
      key: "employees",
      icon: User,
      accent: "violet",
      value: employeeOpenCount,
      label: "Open for Employees",
      caption: "KRAs pending action",
    },
    {
      key: "managers",
      icon: Users,
      accent: "violet",
      value: managerOpenCount,
      label: "Open for Managers",
      caption: "Reviews pending",
    },
  ];

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
      <PageHeader icon={TrendingUp} title="Performance Management" subtitle="Cycles, KRAs and reviews at a glance" />

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-12 text-center text-red-600">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {statCards.map((s) => (
              <StatsCard
                key={s.key}
                icon={s.icon}
                accent={s.accent}
                value={s.value}
                label={s.label}
                caption={s.caption}
                onClick={isPmsHr ? () => navigate("/pms/cycles") : undefined}
                chevron={isPmsHr}
              />
            ))}
          </div>

          <div>
            {/* My Reviews */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">My Reviews</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Your submitted reviews overview</p>
                </div>
                {submissions.length > 0 && (
                  <button
                    onClick={() => navigate("/pms/reviews")}
                    className="text-xs font-semibold text-violet-700 hover:text-violet-800 shrink-0"
                  >
                    View All →
                  </button>
                )}
              </div>

              {!submissions.length ? (
                <EmptyState icon={FileText} title="No reviews yet." />
              ) : (
                <>
                  <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                    <div className="relative">
                      <select
                        value={cycleFilter}
                        onChange={(e) => setCycleFilter(e.target.value)}
                        className="appearance-none text-xs font-semibold border border-slate-200 rounded-xl pl-3 pr-8 py-2 bg-white text-slate-700 hover:border-slate-300 transition cursor-pointer"
                      >
                        <option value="">All Review Cycles</option>
                        {cycles.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </div>

                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="appearance-none text-xs font-semibold border border-slate-200 rounded-xl pl-3 pr-8 py-2 bg-white text-slate-700 hover:border-slate-300 transition cursor-pointer"
                      >
                        {SORT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <ChevronDown className="w-4 h-4" />
                      </span>
                    </div>

                    <div className="ml-auto flex items-center gap-1 bg-slate-50 rounded-xl p-1">
                      <button
                        onClick={() => setViewMode("grid")}
                        aria-label="Grid view"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                          viewMode === "grid" ? "bg-violet-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        aria-label="List view"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                          viewMode === "list" ? "bg-violet-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {!visibleSubmissions.length ? (
                    <EmptyState icon={FileText} title="No reviews match this filter." />
                  ) : viewMode === "grid" ? (
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pagedSubmissions.map((s) => {
                        const cycle = cycleForSubmission(s);
                        return (
                          <button
                            key={s._id}
                            onClick={() => navigate(`/pms/submissions/${s._id}`)}
                            className="text-left rounded-xl border border-slate-100 p-3.5 hover:border-violet-200 hover:shadow-sm transition"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </span>
                              {s.finalReport?.overallRating != null && (
                                <span className="text-sm font-bold text-violet-700 tabular-nums shrink-0">{s.finalReport.overallRating}/5</span>
                              )}
                            </div>
                            <p className="font-semibold text-slate-800 text-sm mt-2 truncate">{s.employeeId?.name || "You"}</p>
                            <div className="mt-1">
                              <StatusBadge tone={SUBMISSION_TONE[s.status] || "neutral"} label={s.status.replace(/_/g, " ")} />
                            </div>
                            {cycle && (
                              <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                                <Calendar className="w-3.5 h-3.5" />
                                {fmtDate(cycle.start)} – {fmtDate(cycle.end)}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5 flex flex-col gap-2">
                      {pagedSubmissions.map((s) => {
                        const cycle = cycleForSubmission(s);
                        return (
                          <button
                            key={s._id}
                            onClick={() => navigate(`/pms/submissions/${s._id}`)}
                            className="text-left rounded-xl border border-slate-100 p-3 flex items-center gap-3 hover:border-violet-200 hover:shadow-sm transition"
                          >
                            <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-800 text-sm truncate">{s.employeeId?.name || "You"}</p>
                              {cycle && (
                                <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {fmtDate(cycle.start)} – {fmtDate(cycle.end)}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0">
                              <StatusBadge tone={SUBMISSION_TONE[s.status] || "neutral"} label={s.status.replace(/_/g, " ")} />
                            </span>
                            {s.finalReport?.overallRating != null && (
                              <span className="text-sm font-bold text-violet-700 tabular-nums shrink-0 w-12 text-right">{s.finalReport.overallRating}/5</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <span className="text-xs text-slate-500">
                      Showing {visibleSubmissions.length === 0 ? 0 : (reviewPage - 1) * pageSize + 1} to {Math.min(reviewPage * pageSize, visibleSubmissions.length)} of {visibleSubmissions.length} reviews
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                          disabled={reviewPage === 1}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: totalReviewPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            onClick={() => setReviewPage(p)}
                            className={`w-7 h-7 rounded-full text-xs font-bold transition ${
                              p === reviewPage ? "bg-violet-700 text-white" : "text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          onClick={() => setReviewPage((p) => Math.min(totalReviewPages, p + 1))}
                          disabled={reviewPage === totalReviewPages}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <option key={n} value={n}>{n} per page</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
