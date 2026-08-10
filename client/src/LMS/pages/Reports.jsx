import { useEffect, useState } from "react";
import { toast } from "sonner";
import { reportsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = () =>
    reportsApi
      .all()
      .then((res) => setReports(res.data))
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await reportsApi.regenerate();
      toast.success("Reports regenerated");
      load();
    } catch {
      toast.error("Failed to regenerate reports");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Learning Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Per-employee course completion snapshot.</p>
        </div>
        <button
          disabled={regenerating}
          onClick={regenerate}
          className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3.5 py-2 disabled:bg-slate-200"
        >
          <Icons.Refresh /> {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-50">
        {reports.map((report) => (
          <div key={report.employeeId}>
            <button
              onClick={() => setExpanded((e) => (e === report.employeeId ? null : report.employeeId))}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-xs font-bold text-slate-800">{report.employee.name}</p>
                <p className="text-[10px] text-slate-400">{report.employee.email}</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span>{report.summary.enrolledCourses || 0} enrolled</span>
                <span>{report.summary.completedCourses || 0} completed</span>
                <span className="font-bold text-amber-600">{report.summary.averageProgress || 0}% avg</span>
                <Icons.ChevronDown />
              </div>
            </button>
            {expanded === report.employeeId && (
              <div className="px-4 pb-3 space-y-1.5">
                {report.courses.map((course) => (
                  <div key={course.courseId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="text-[11px] font-semibold text-slate-700">{course.title}</span>
                    <span className="text-[11px] text-slate-500 capitalize">
                      {course.status} · {course.percent}%
                    </span>
                  </div>
                ))}
                {report.courses.length === 0 && <p className="text-[11px] text-slate-400">No courses assigned yet.</p>}
              </div>
            )}
          </div>
        ))}
        {reports.length === 0 && <p className="text-xs text-slate-400 p-4">No reports yet — click Regenerate.</p>}
      </div>
    </div>
  );
}
