import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icons from "../components/Icons";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

const SUBMISSION_STYLES = {
  draft: "bg-slate-100 text-slate-600",
  pending_manager_approval: "bg-amber-50 text-amber-700",
  manager_approved: "bg-blue-50 text-blue-700",
  employee_submitted: "bg-amber-50 text-amber-700",
  final_employee_submitted: "bg-amber-50 text-amber-700",
  manager_reviewed: "bg-blue-50 text-blue-700",
  final_manager_reviewed: "bg-emerald-50 text-emerald-700",
};

const PAGE_SIZE_OPTIONS = [6, 12, 24];

export default function PmsHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewPage, setReviewPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

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

  const totalReviewPages = Math.max(1, Math.ceil(submissions.length / pageSize));
  const pagedSubmissions = submissions.slice((reviewPage - 1) * pageSize, reviewPage * pageSize);

  useEffect(() => setReviewPage(1), [pageSize, submissions.length]);

  const statCards = [
    {
      key: "cycles",
      icon: Icons.Calendar,
      iconCls: "bg-violet-50 text-violet-600",
      value: cycles.length,
      label: "Review Cycles",
      caption: "Active review cycles",
    },
    {
      key: "employees",
      icon: Icons.User,
      iconCls: "bg-blue-50 text-blue-600",
      value: employeeOpenCount,
      label: "Open for Employees",
      caption: "KRAs pending action",
    },
    {
      key: "managers",
      icon: Icons.Team,
      iconCls: "bg-emerald-50 text-emerald-600",
      value: managerOpenCount,
      label: "Open for Managers",
      caption: "Reviews pending",
    },
  ];

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-violet-700 text-white flex items-center justify-center shadow-sm shrink-0">
          <Icons.TrendUp />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Performance Management</h1>
          <p className="text-sm text-slate-500">Cycles, KRAs and reviews at a glance</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-12 text-center text-red-600">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {statCards.map((s) => (
              <div
                key={s.key}
                onClick={isPmsHr ? () => navigate("/pms/cycles") : undefined}
                className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 transition ${
                  isPmsHr ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.iconCls}`}>
                  <s.icon />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{s.value}</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{s.label}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{s.caption}</p>
                </div>
                {isPmsHr && <span className="text-slate-300 shrink-0"><Icons.ChevronRight /></span>}
              </div>
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
                <div className="p-8 text-center text-slate-400 text-sm">No reviews yet.</div>
              ) : (
                <>
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
                              <Icons.File />
                            </span>
                            {s.finalReport?.overallRating != null && (
                              <span className="text-sm font-bold text-violet-700 tabular-nums shrink-0">{s.finalReport.overallRating}/5</span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-800 text-sm mt-2 truncate">{s.employeeId?.name || "You"}</p>
                          <span className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${SUBMISSION_STYLES[s.status] || "bg-slate-100 text-slate-600"}`}>
                            {s.status.replace(/_/g, " ")}
                          </span>
                          {cycle && (
                            <p className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                              <Icons.Calendar />
                              {fmtDate(cycle.start)} – {fmtDate(cycle.end)}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    <span className="text-xs text-slate-500">
                      Showing {(reviewPage - 1) * pageSize + 1} to {Math.min(reviewPage * pageSize, submissions.length)} of {submissions.length} reviews
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                          disabled={reviewPage === 1}
                          className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                        >
                          <Icons.Back />
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
                          <Icons.Arrow />
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
