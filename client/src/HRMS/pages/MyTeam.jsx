import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { employeesApi } from "../hrmsApi";
import ProjectRoleAssignmentPanel from "../components/ProjectRoleAssignmentPanel";

export default function MyTeam() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    employeesApi
      .myReports()
      .then((res) => setReports(res.data?.data || []))
      .catch(() => toast.error("Failed to load your team"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-cyan-700" /> My Team
        </h1>
        <p className="text-sm text-slate-500 mt-1">Assign project roles for your direct reports.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-slate-400 italic">You have no direct reports.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const isOpen = expanded === r._id;
            return (
              <div key={r._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : r._id)}
                  className="w-full flex items-center justify-between px-5 py-4"
                >
                  <div className="text-left">
                    <p className="font-semibold text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.email}</p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                    <ProjectRoleAssignmentPanel userId={r._id} canEdit />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
