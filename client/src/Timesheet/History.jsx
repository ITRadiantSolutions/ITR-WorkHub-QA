import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "../components/Icons";

const TABS = [
  { key: "submitted", label: "Pending", icon: "Clock" },
  { key: "approved", label: "Approved", icon: "CheckCircle" },
  { key: "rejected", label: "Rejected", icon: "X" },
  { key: "needs_edit", label: "Modifications", icon: "Edit" },
];

const STATUS_STYLES = {
  submitted: { badge: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
  approved: { badge: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-400" },
  rejected: { badge: "bg-red-100 text-red-800", bar: "bg-red-400" },
  needs_edit: { badge: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
  draft: { badge: "bg-slate-100 text-slate-700", bar: "bg-slate-300" },
};

const fmtShort = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const fmtDateTime = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "-");

export default function History() {
  const navigate = useNavigate();
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("submitted");

  useEffect(() => {
    API.get("/timesheets")
      .then((res) => setTimesheets(res.data || []))
      .catch(() => toast.error("Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  const counts = TABS.reduce((acc, t) => {
    acc[t.key] = timesheets.filter((ts) => ts.status === t.key).length;
    return acc;
  }, {});

  const filtered = timesheets
    .filter((ts) => ts.status === tab)
    .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
          <Icons.Clock />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">My Submitted Timesheets</h2>
          <p className="text-sm text-slate-500">Track approvals and revisit past weeks</p>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 w-fit flex-wrap">
        {TABS.map((t) => {
          const Icon = Icons[t.icon];
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-100" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {Icon ? <Icon /> : null}
              {t.label}
              <span className={`text-xs rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center font-bold ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                {counts[t.key] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : !filtered.length ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-3">
            <Icons.Empty />
          </div>
          <p className="text-slate-500 font-medium">No timesheets in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ts) => {
            const style = STATUS_STYLES[ts.status] || STATUS_STYLES.draft;
            return (
              <div key={ts._id} className="relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar}`} />
                <div className="px-5 py-4 pl-6 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-bold text-slate-800">
                      Week: {fmtShort(ts.weekStart)} → {fmtShort(ts.weekEnd)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Submitted: {fmtDateTime(ts.submittedAt)} &nbsp;·&nbsp; Action by: {ts.managerActionBy?.name || "-"}
                    </p>
                    <button
                      onClick={() => navigate(`/timesheet/new/${ts._id}`)}
                      className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition"
                    >
                      View <Icons.ChevronRight />
                    </button>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${style.badge}`}>
                    {ts.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
