import { useEffect, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "../components/Icons";

const fmtISODate = (d) => new Date(d).toISOString().slice(0, 10);

const PRESETS = [
  { key: "last_7", label: "Last 7 Days", days: 7 },
  { key: "last_30", label: "Last 30 Days", days: 30 },
  { key: "last_90", label: "Last 90 Days", days: 90 },
];

const PAGE_SIZE = 10;

export default function NsaReport() {
  const [preset, setPreset] = useState("last_30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState({ entries: [], trend: [], totalUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const found = PRESETS.find((p) => p.key === preset);
    if (!found) return;
    const end = new Date();
    const start = new Date(end.getTime() - found.days * 86400000);
    setStartDate(fmtISODate(start));
    setEndDate(fmtISODate(end));
  }, [preset]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setVisibleCount(PAGE_SIZE);
    API.get("/hr/nsa-report", { params: { startDate, endDate } })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load NSA report"))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const exportCsv = async () => {
    try {
      const res = await API.get("/hr/nsa-report/export", { params: { startDate, endDate }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "nsa-report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm shrink-0">
          <Icons.BarChart />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">NSA Report</h1>
          <p className="text-sm text-slate-500">Non-standard-availability activity across your team</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm font-semibold text-slate-500">Total Users: {data.totalUsers}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs" />
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold">
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
              <Icons.Download /> CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <>
            {/* Month-wise user counts */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-700 shrink-0">Month-wise User Count:</p>
              {data.trend.length ? (
                data.trend.map((t, i) => (
                  <span key={t.month} className="text-sm text-slate-600">
                    {t.month}: <span className="font-bold text-teal-700 tabular-nums">{t.count}</span>
                    {i < data.trend.length - 1 && <span className="text-slate-300 ml-2">|</span>}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-400">No NSA activity in this range.</p>
              )}
            </div>

            {/* Data below */}
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-2 py-2 font-bold text-slate-500 text-xs uppercase tracking-wide">Name</th>
                    {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                      <th key={d} className="px-2 py-2 font-bold text-slate-500 text-xs uppercase tracking-wide text-center">{d}</th>
                    ))}
                    <th className="text-left px-2 py-2 font-bold text-slate-500 text-xs uppercase tracking-wide">Week Start</th>
                    <th className="text-left px-2 py-2 font-bold text-slate-500 text-xs uppercase tracking-wide">Week End</th>
                    <th className="text-left px-2 py-2 font-bold text-slate-500 text-xs uppercase tracking-wide">Approver</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.slice(0, visibleCount).map((e, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-2 py-2 text-slate-800 font-medium">{e.userName}</td>
                      {(e.days || Array(5).fill(false)).map((flag, d) => (
                        <td key={d} className="px-2 py-2 text-center">
                          {flag ? (
                            <span className="text-emerald-600 font-bold tabular-nums">{(e.hours?.[d] ?? 0).toFixed(1)}h</span>
                          ) : (
                            <span className="text-slate-300">No</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-slate-500 tabular-nums">{fmtISODate(e.weekStart)}</td>
                      <td className="px-2 py-2 text-slate-500 tabular-nums">{fmtISODate(e.weekEnd)}</td>
                      <td className="px-2 py-2 text-slate-500">{e.approver || "—"}</td>
                    </tr>
                  ))}
                  {!data.entries.length && (
                    <tr>
                      <td colSpan={8} className="px-2 py-6 text-center text-slate-400">No approved NSA entries in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {visibleCount < data.entries.length && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Load More
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
