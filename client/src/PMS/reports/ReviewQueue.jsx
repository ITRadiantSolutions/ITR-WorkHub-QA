import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { API } from "../../services/api";
import Icons from "../../components/Icons";

const NEEDS_REVIEW = ["employee_submitted", "final_employee_submitted"];
const COMPLETED = ["manager_reviewed", "final_manager_reviewed"];
const PAGE_SIZE = 9;

const STATUS_LABELS = {
  employee_submitted: "Submitted",
  final_employee_submitted: "Final submitted",
  manager_reviewed: "Reviewed",
  final_manager_reviewed: "Final reviewed",
};

const STATUS_DOT = {
  employee_submitted: "bg-emerald-500",
  final_employee_submitted: "bg-emerald-500",
  manager_reviewed: "bg-violet-500",
  final_manager_reviewed: "bg-violet-500",
};

const AVATAR_STYLES = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-pink-100 text-pink-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-cyan-100 text-cyan-700",
];

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export default function ReviewQueue() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([API.get("/pms/submissions"), API.get("/pms/cycles")])
      .then(([sRes, cRes]) => {
        if (cancelled) return;
        setSubmissions(sRes.data || []);
        setCycles(cRes.data || []);
      })
      .catch(() => toast.error("Failed to load reviews"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const cycleName = useMemo(() => {
    const map = {};
    cycles.forEach((c) => (map[c._id] = c.name));
    return map;
  }, [cycles]);

  const pendingCount = submissions.filter((s) => NEEDS_REVIEW.includes(s.status)).length;
  const completedCount = submissions.filter((s) => COMPLETED.includes(s.status)).length;
  const statusOptions = tab === "pending" ? NEEDS_REVIEW : COMPLETED;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = submissions.filter((s) => (tab === "pending" ? NEEDS_REVIEW.includes(s.status) : COMPLETED.includes(s.status)));
    if (term) {
      list = list.filter(
        (s) => s.employeeId?.name?.toLowerCase().includes(term) || s.employeeId?.email?.toLowerCase().includes(term)
      );
    }
    if (cycleFilter !== "all") {
      list = list.filter((s) => s.cycleId === cycleFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((s) => s.status === statusFilter);
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return (a.employeeId?.name || "").localeCompare(b.employeeId?.name || "");
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
    return list;
  }, [submissions, tab, search, cycleFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const switchTab = (next) => {
    setTab(next);
    setStatusFilter("all");
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setCycleFilter("all");
    setStatusFilter("all");
    setSortBy("recent");
    setPage(1);
  };

  const filtersActive = search || cycleFilter !== "all" || statusFilter !== "all" || sortBy !== "recent";

  const handleExportAll = () => {
    if (!filtered.length) {
      toast.info("No reviews to export");
      return;
    }
    const header = ["Employee Name", "Employee Email", "Cycle", "KRA Assigned", "Reports To", "Status", "Last Updated"];
    const rows = filtered.map((s) => [
      s.employeeId?.name || "",
      s.employeeId?.email || "",
      cycleName[s.cycleId] || "",
      s.assignmentId ? "Yes" : "No",
      s.managerId?.name || "",
      STATUS_LABELS[s.status] || (s.status || "").replace(/_/g, " "),
      formatDate(s.updatedAt || s.createdAt),
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    sheet["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, tab === "pending" ? "Needs Review" : "Completed");
    XLSX.writeFile(wb, `PMS_Reviews_${tab === "pending" ? "Needs_Review" : "Completed"}.xlsx`);
  };

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-700 text-white flex items-center justify-center shadow-sm shrink-0">
            <Icons.CheckAll />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Reviews</h1>
            <p className="text-sm text-slate-500">Rate and respond to your reports' self-reviews</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icons.Search />
            </span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or email..."
              className="w-64 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <button
            onClick={handleExportAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 text-white text-sm font-semibold shadow-sm hover:opacity-90 transition"
          >
            <Icons.Download />
            Export All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => switchTab("pending")}
          className={`text-left rounded-2xl border p-4 flex items-center gap-3 transition ${
            tab === "pending" ? "bg-amber-50/70 border-amber-100" : "bg-white border-slate-100 hover:shadow-md"
          }`}
        >
          <span className="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Icons.Send />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Needs Review</p>
            <p className="text-2xl font-extrabold text-slate-900 leading-tight">{pendingCount}</p>
            <p className="text-xs text-slate-400">Reports need your review</p>
            <div className="h-1 w-full bg-amber-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: "90%" }} />
            </div>
          </div>
        </button>
        <button
          onClick={() => switchTab("completed")}
          className={`text-left rounded-2xl border p-4 flex items-center gap-3 transition ${
            tab === "completed" ? "bg-emerald-50/70 border-emerald-100" : "bg-white border-slate-100 hover:shadow-md"
          }`}
        >
          <span className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Icons.Eye />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Completed</p>
            <p className="text-2xl font-extrabold text-slate-900 leading-tight">{completedCount}</p>
            <p className="text-xs text-slate-400">Self-reviews completed</p>
            <div className="h-1 w-full bg-emerald-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: "90%" }} />
            </div>
          </div>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 mb-5 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <select
            value={cycleFilter}
            onChange={(e) => {
              setCycleFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-8 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-violet-300 cursor-pointer"
          >
            <option value="all">All Review Cycles</option>
            {cycles.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icons.ChevronDown />
          </span>
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-8 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-violet-300 cursor-pointer"
          >
            <option value="all">All Status</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st]}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icons.ChevronDown />
          </span>
        </div>

        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-8 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-violet-300 cursor-pointer"
          >
            <option value="recent">Sort by: Recently updated</option>
            <option value="name">Sort by: Name A-Z</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icons.ChevronDown />
          </span>
        </div>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-violet-700 hover:bg-violet-50 transition"
          >
            <Icons.Refresh />
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : !filtered.length ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 text-sm">
          {tab === "pending" ? "Nothing needs your review right now." : "No completed reviews yet."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageItems.map((s, i) => (
              <div key={s._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col hover:shadow-md hover:border-violet-200 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${AVATAR_STYLES[i % AVATAR_STYLES.length]}`}>
                      {(s.employeeId?.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 text-sm truncate">{s.employeeId?.name || "Employee"}</p>
                      <p className="text-xs text-slate-400 truncate">{s.employeeId?.email || ""}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                    {cycleName[s.cycleId] || "Cycle"}
                  </span>
                </div>

                <span className="flex items-center gap-1.5 text-xs text-slate-400 mt-3">
                  <Icons.Calendar />
                  {tab === "pending" ? "Submitted" : "Reviewed"} — {formatDate(s.updatedAt || s.createdAt)}
                </span>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">KRA Assigned</p>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.assignmentId ? "bg-emerald-500" : "bg-slate-300"}`} />
                      {s.assignmentId ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Reports To</p>
                    {s.managerId?.name ? (
                      <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md truncate max-w-full">
                        {s.managerId.name}
                      </span>
                    ) : (
                      <p className="text-xs font-semibold text-slate-400 mt-1">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</p>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s.status] || "bg-slate-300"}`} />
                      {STATUS_LABELS[s.status] || s.status}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/pms/submissions/${s._id}`)}
                  className="mt-3 w-full py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition flex items-center justify-center gap-1.5"
                >
                  View Report
                  <Icons.ChevronRight />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} reviews
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                >
                  <Icons.Back />
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold ${
                      n === page ? "bg-gradient-to-r from-violet-700 to-violet-500 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 border border-slate-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50"
                >
                  <Icons.ChevronRight />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
