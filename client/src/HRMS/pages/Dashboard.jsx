import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Send, Clock, Users, UserCheck, Building2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { dashboardApi } from "../hrmsApi";

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        {Icon && <Icon className="w-5 h-5" />}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900">{value ?? "—"}</p>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .stats()
      .then((res) => !cancelled && setStats(res.data))
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Welcome, {user?.name || "there"}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.roles?.hrms === "hr"
            ? "Here's what's happening across the organization."
            : "Here's your HRMS overview."}
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : stats?.role === "hr" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={Users} label="Total Employees" value={stats.totalEmployees} accent="bg-cyan-50 text-cyan-700" />
          <StatCard icon={UserCheck} label="Active Employees" value={stats.activeEmployees} accent="bg-emerald-50 text-emerald-700" />
          <StatCard icon={Briefcase} label="Open Positions" value={stats.openJobPosts} accent="bg-violet-50 text-violet-700" />
          <StatCard icon={Clock} label="Pending Job Requests" value={stats.pendingJobRequests} accent="bg-amber-50 text-amber-700" />
          <StatCard icon={Send} label="Total Referrals" value={stats.totalReferrals} accent="bg-blue-50 text-blue-700" />
          <StatCard icon={Building2} label="Referrals In Pipeline" value={stats.pendingReferrals} accent="bg-pink-50 text-pink-700" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Briefcase} label="Open Jobs" value={stats?.openJobs} accent="bg-violet-50 text-violet-700" />
          <StatCard icon={Send} label="My Referrals" value={stats?.myReferrals} accent="bg-blue-50 text-blue-700" />
          <StatCard icon={Clock} label="Pending Actions" value={stats?.pendingActions} accent="bg-amber-50 text-amber-700" />
          {stats?.role === "manager" && (
            <StatCard icon={Users} label="Team Size" value={stats?.teamSize} accent="bg-cyan-50 text-cyan-700" />
          )}
        </div>
      )}
    </main>
  );
}
