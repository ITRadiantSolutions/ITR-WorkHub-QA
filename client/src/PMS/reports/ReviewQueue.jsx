import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../../services/api";
import PmsSubnav from "../../components/PmsSubnav";
import Icons from "../../components/Icons";

const NEEDS_REVIEW = ["employee_submitted", "final_employee_submitted"];
const COMPLETED = ["manager_reviewed", "final_manager_reviewed"];

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600",
  pending_manager_approval: "bg-amber-100 text-amber-700",
  manager_approved: "bg-blue-100 text-blue-700",
  employee_submitted: "bg-amber-100 text-amber-700",
  final_employee_submitted: "bg-amber-100 text-amber-700",
  manager_reviewed: "bg-emerald-100 text-emerald-700",
  final_manager_reviewed: "bg-emerald-100 text-emerald-700",
};

export default function ReviewQueue() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

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

  const filtered = submissions.filter((s) => (tab === "pending" ? NEEDS_REVIEW.includes(s.status) : COMPLETED.includes(s.status)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-100">
      <PmsSubnav />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Reviews</h2>
          <p className="text-sm text-slate-500">Rate and respond to your reports' self-reviews.</p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("pending")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold ${tab === "pending" ? "bg-violet-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
          >
            Needs review
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold ${tab === "completed" ? "bg-violet-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
          >
            Completed
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : !filtered.length ? (
          <div className="bg-white/90 rounded-2xl border border-white/60 shadow-lg p-12 text-center text-slate-500">
            {tab === "pending" ? "Nothing needs your review right now." : "No completed reviews yet."}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {filtered.map((s) => (
              <button
                key={s._id}
                onClick={() => navigate(`/pms/submissions/${s._id}`)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 text-left"
              >
                <div>
                  <p className="font-semibold text-slate-900">{s.employeeId?.name || "Employee"}</p>
                  <p className="text-xs text-slate-500">{cycleName[s.cycleId] || "Cycle"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[s.status] || "bg-slate-100 text-slate-600"}`}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                  <Icons.ChevronRight />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
