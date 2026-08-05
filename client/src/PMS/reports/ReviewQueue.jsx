import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { ListChecks, Send, Eye, ChevronDown, Calendar, ChevronRight, ChevronLeft, Inbox } from "lucide-react";
import { API } from "../../services/api";
import PageHeader from "../components/PageHeader";
import StatsCard from "../components/StatsCard";
import FilterToolbar from "../components/FilterToolbar";
import DataCard from "../components/DataCard";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";

const NEEDS_REVIEW = ["employee_submitted", "final_employee_submitted"];
const COMPLETED = ["manager_reviewed", "final_manager_reviewed"];
const PAGE_SIZE = 9;

const STATUS_LABELS = {
  employee_submitted: "Submitted",
  final_employee_submitted: "Final submitted",
  manager_reviewed: "Reviewed",
  final_manager_reviewed: "Final reviewed",
};

const STATUS_TONE = {
  employee_submitted: "success",
  final_employee_submitted: "success",
  manager_reviewed: "violet",
  final_manager_reviewed: "violet",
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
      <PageHeader icon={ListChecks} title="Reviews" subtitle="Rate and respond to your reports' self-reviews" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <StatsCard
          icon={Send}
          label="Needs Review"
          value={pendingCount}
          caption="Reports need your review"
          accent="amber"
          progress={90}
          active={tab === "pending"}
          onClick={() => switchTab("pending")}
        />
        <StatsCard
          icon={Eye}
          label="Completed"
          value={completedCount}
          caption="Self-reviews completed"
          accent="emerald"
          progress={90}
          active={tab === "completed"}
          onClick={() => switchTab("completed")}
        />
      </div>

      <FilterToolbar
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); }, placeholder: "Search name or email..." }}
        onExport={handleExportAll}
        exportLabel="Export All"
        onClearFilters={clearFilters}
        showClear={filtersActive}
      >
        <div className="relative">
          <select
            value={cycleFilter}
            onChange={(e) => {
              setCycleFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-full border border-gray-200 bg-white pl-4 pr-8 py-2 text-xs font-semibold text-gray-600 outline-none focus:border-violet-300 cursor-pointer"
          >
            <option value="all">All Review Cycles</option>
            {cycles.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-full border border-gray-200 bg-white pl-4 pr-8 py-2 text-xs font-semibold text-gray-600 outline-none focus:border-violet-300 cursor-pointer"
          >
            <option value="all">All Status</option>
            {statusOptions.map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        </div>

        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-full border border-gray-200 bg-white pl-4 pr-8 py-2 text-xs font-semibold text-gray-600 outline-none focus:border-violet-300 cursor-pointer"
          >
            <option value="recent">Sort by: Recently updated</option>
            <option value="name">Sort by: Name A-Z</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        </div>
      </FilterToolbar>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : !filtered.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState
            icon={Inbox}
            title={tab === "pending" ? "Nothing needs your review right now." : "No completed reviews yet."}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageItems.map((s, i) => (
              <DataCard
                key={s._id}
                avatarLabel={(s.employeeId?.name || "?").charAt(0).toUpperCase()}
                avatarClass={AVATAR_STYLES[i % AVATAR_STYLES.length]}
                title={s.employeeId?.name || "Employee"}
                subtitle={s.employeeId?.email || ""}
                topRight={<StatusBadge tone="violet" label={cycleName[s.cycleId] || "Cycle"} />}
                dateLine={
                  <>
                    <Calendar className="w-3.5 h-3.5" />
                    {tab === "pending" ? "Submitted" : "Reviewed"} — {formatDate(s.updatedAt || s.createdAt)}
                  </>
                }
                meta={[
                  {
                    label: "KRA Assigned",
                    value: (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.assignmentId ? "bg-emerald-500" : "bg-gray-300"}`} />
                        {s.assignmentId ? "Yes" : "No"}
                      </p>
                    ),
                  },
                  {
                    label: "Reports To",
                    value: s.managerId?.name ? (
                      <span className="inline-block text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md truncate max-w-full">
                        {s.managerId.name}
                      </span>
                    ) : (
                      <p className="text-xs font-semibold text-gray-400">—</p>
                    ),
                  },
                  {
                    label: "Status",
                    value: <StatusBadge tone={STATUS_TONE[s.status] || "neutral"} label={STATUS_LABELS[s.status] || s.status} dot />,
                  },
                ]}
                actionLabel="View Report"
                actionIcon={ChevronRight}
                onAction={() => navigate(`/pms/submissions/${s._id}`)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
            <p className="text-xs text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} reviews
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
                      n === page ? "bg-gradient-to-r from-violet-800 to-violet-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50 border border-gray-200"
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
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
