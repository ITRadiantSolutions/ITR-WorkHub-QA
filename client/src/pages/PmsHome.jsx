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

export default function PmsHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-violet-700 text-white flex items-center justify-center shadow-sm shrink-0">
          <Icons.Target />
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
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <Icons.Calendar />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{cycles.length}</p>
                <p className="text-xs font-semibold text-slate-500">Review cycles</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Icons.User />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{employeeOpenCount}</p>
                <p className="text-xs font-semibold text-slate-500">Open for employees</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Icons.Team />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{managerOpenCount}</p>
                <p className="text-xs font-semibold text-slate-500">Open for managers</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900 text-sm">Review cycles</h2>
                {isPmsHr && (
                  <button
                    onClick={() => navigate("/pms/cycles")}
                    className="text-xs font-semibold text-violet-700 hover:text-violet-800"
                  >
                    Manage cycles →
                  </button>
                )}
              </div>
              {!cycles.length ? (
                <div className="p-8 text-center text-slate-400 text-sm">No cycles yet.</div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {cycles.map((c) => (
                    <li key={c._id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                        <p className="text-xs text-slate-400">
                          {fmtDate(c.start)} – {fmtDate(c.end)}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {c.employeeResponse?.enabled && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Employee</span>}
                        {c.managerResponse?.enabled && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Manager</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <h2 className="font-bold text-slate-900 text-sm">My reviews</h2>
              </div>
              {!submissions.length ? (
                <div className="p-8 text-center text-slate-400 text-sm">No reviews yet.</div>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {submissions.map((s) => (
                    <li key={s._id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{s.employeeId?.name || "You"}</p>
                        <span className={`inline-block mt-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${SUBMISSION_STYLES[s.status] || "bg-slate-100 text-slate-600"}`}>
                          {s.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      {s.finalReport?.overallRating != null && (
                        <span className="text-sm font-bold text-violet-700 tabular-nums shrink-0">{s.finalReport.overallRating}/5</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
