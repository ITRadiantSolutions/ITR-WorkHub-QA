import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, FileText, UserX } from "lucide-react";
import { API } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { isPMS_HR } from "../../utils/pmsrolecheck";
import StatusBadge from "../components/StatusBadge";

const STATUS_LABELS = {
  draft: "Draft",
  pending_manager_approval: "Pending manager approval",
  manager_approved: "Manager approved",
  employee_submitted: "Submitted — awaiting review",
  final_employee_submitted: "Final self-review submitted",
  manager_reviewed: "Reviewed — your turn",
  final_manager_reviewed: "Review complete",
};
const STATUS_TONE = {
  draft: "neutral",
  pending_manager_approval: "warning",
  manager_approved: "info",
  employee_submitted: "warning",
  final_employee_submitted: "warning",
  manager_reviewed: "violet",
  final_manager_reviewed: "success",
};

function MyReports({ userId }) {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get(`/pms/reports/employee/${userId}`)
      .then((res) => setSubmissions(res.data || []))
      .catch(() => toast.error("Failed to load your reports"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="p-12 text-center text-slate-500">Loading...</div>;
  if (submissions.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">No reports yet — they'll show up here once a review cycle starts.</div>;
  }

  return (
    <div className="space-y-3">
      {submissions.map((s) => (
        <button
          key={s._id}
          onClick={() => navigate(`/pms/submissions/${s._id}`)}
          className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center justify-between hover:border-violet-200 hover:shadow-md transition"
        >
          <div>
            <p className="font-bold text-slate-900">{s.cycleId?.name || "Review cycle"}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {s.finalReport?.overallRating ? `Overall rating: ${s.finalReport.overallRating}/5` : "Not yet rated"}
            </p>
          </div>
          <StatusBadge tone={STATUS_TONE[s.status] || "neutral"} label={STATUS_LABELS[s.status] || s.status} size="md" />
        </button>
      ))}
    </div>
  );
}

function CycleAnalytics() {
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState("");
  const [rows, setRows] = useState([]);
  const [nonSubmitters, setNonSubmitters] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API.get("/pms/cycles")
      .then((res) => setCycles(res.data || []))
      .catch(() => toast.error("Failed to load cycles"));
  }, []);

  useEffect(() => {
    if (!cycleId) {
      setRows([]);
      setNonSubmitters([]);
      return;
    }
    setLoading(true);
    Promise.all([
      API.get("/pms/reports/cycle", { params: { cycleId } }),
      API.get("/pms/reports/non-submitters", { params: { cycleId } }),
    ])
      .then(([rRes, nsRes]) => {
        setRows(rRes.data || []);
        setNonSubmitters(nsRes.data || []);
      })
      .catch(() => toast.error("Failed to load cycle report"))
      .finally(() => setLoading(false));
  }, [cycleId]);

  const exportXlsx = async () => {
    try {
      const res = await API.get("/pms/reports/cycle/export", { params: { cycleId }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pms-cycle-report.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export report");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={cycleId}
          onChange={(e) => setCycleId(e.target.value)}
          className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white min-w-[240px]"
        >
          <option value="">Select a cycle...</option>
          {cycles.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={exportXlsx}
          disabled={!cycleId || !rows.length}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold shadow-sm disabled:opacity-40"
        >
          <Download className="w-4 h-4" /> Export XLSX
        </button>
      </div>

      {!cycleId ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">Pick a cycle to see its report.</div>
      ) : loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Submitted</th>
                  <th className="text-left px-4 py-3">Overall Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No submissions for this cycle yet.</td></tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.Employee}</td>
                      <td className="px-4 py-3 text-slate-500">{r.Email}</td>
                      <td className="px-4 py-3">{STATUS_LABELS[r.Status] || r.Status}</td>
                      <td className="px-4 py-3 text-slate-500">{r.SubmittedOn || "—"}</td>
                      <td className="px-4 py-3">{r.OverallRating ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserX className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-sm">Non-submitters ({nonSubmitters.length})</h3>
            </div>
            {nonSubmitters.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Everyone in scope has submitted.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {nonSubmitters.map((u) => (
                  <span key={u.id} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">{u.name}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Replaces the old PMSReport.jsx/EmployeeReviewView.jsx/MyReportView.jsx —
// the manager/HR "review a specific person" job now lives on the already-
// migrated ReviewQueue.jsx + SubmissionDetail.jsx (/pms/reviews), so this
// page is just: everyone's own report history, plus HR-only cycle-level
// analytics (export, non-submitters) that don't exist anywhere else yet.
export default function Reports() {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const hr = isPMS_HR(user);
  const [tab, setTab] = useState("mine");

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your performance report history{hr ? ", plus cycle-wide analytics" : ""}.</p>
        </div>
        {hr && (
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            <button onClick={() => setTab("mine")} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${tab === "mine" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              My Reports
            </button>
            <button onClick={() => setTab("analytics")} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${tab === "analytics" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              <FileText className="w-3.5 h-3.5" /> Cycle Analytics
            </button>
          </div>
        )}
      </div>

      {tab === "mine" || !hr ? <MyReports userId={userId} /> : <CycleAnalytics />}
    </main>
  );
}
