import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icons from "../components/Icons";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-100">
      <header className="flex items-center justify-between px-8 py-6">
        <button
          onClick={() => navigate("/hub")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <Icons.Back /> Hub
        </button>
        <h1 className="text-lg font-bold text-slate-900">Performance Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/mytemplate")}
            className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-full transition"
          >
            My KRAs
          </button>
          <button
            onClick={() => navigate("/PMS-reports")}
            className="text-xs font-semibold text-violet-700 bg-white border border-violet-200 hover:bg-violet-50 px-3 py-1.5 rounded-full transition"
          >
            Reports
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-16 space-y-8">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : (
          <>
            <section className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-white/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Review cycles</h2>
                <div className="flex items-center gap-2">
                  {isPmsHr && (
                    <button
                      onClick={() => navigate("/pms/cycles")}
                      className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-full transition"
                    >
                      Manage cycles
                    </button>
                  )}
                  {isPmsHr && <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">HR</span>}
                </div>
              </div>
              {!cycles.length ? (
                <div className="p-8 text-center text-slate-500">No cycles yet.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cycles.map((c) => (
                    <li key={c._id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-sm text-slate-500">
                          {fmtDate(c.start)} – {fmtDate(c.end)}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs font-semibold">
                        {c.employeeResponse?.enabled && <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">Employee open</span>}
                        {c.managerResponse?.enabled && <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Manager open</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-white/60 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-900">My reviews</h2>
              </div>
              {!submissions.length ? (
                <div className="p-8 text-center text-slate-500">No reviews yet.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {submissions.map((s) => (
                    <li key={s._id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{s.employeeId?.name || "You"}</p>
                        <p className="text-sm text-slate-500">{s.status.replace(/_/g, " ")}</p>
                      </div>
                      {s.finalReport?.overallRating != null && (
                        <span className="text-sm font-semibold text-violet-700">Rating: {s.finalReport.overallRating}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
