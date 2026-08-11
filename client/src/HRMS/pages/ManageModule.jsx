import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isHRMS_HR } from "../../utils/hrmsrolecheck";
import { employeesApi } from "../hrmsApi";
import { MANAGE_MODULES, MANAGER_ROLE_CEILING } from "../moduleAccessConfig";

export default function ManageModule() {
  const { moduleKey } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isHr = isHRMS_HR(user);

  const module = MANAGE_MODULES.find((m) => m.key === moduleKey);
  const roleOptions = isHr ? module?.roles : MANAGER_ROLE_CEILING[moduleKey] || [];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const request = isHr ? employeesApi.list() : employeesApi.myReports();
    request
      .then((res) => setUsers(isHr ? res.data || [] : res.data?.data || []))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, [isHr]);

  useEffect(() => {
    load();
  }, [load]);

  if (!module) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-sm text-slate-500">Unknown module.</p>
      </main>
    );
  }

  const changeRole = async (targetUser, role) => {
    setSavingId(targetUser._id);
    try {
      await employeesApi.setRole(targetUser._id, role, module.key);
      toast.success(`${module.label} role updated`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update role");
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (targetUser) => {
    const currentlyArchived = Boolean(targetUser.archived?.[module.key]);
    setSavingId(targetUser._id);
    try {
      await employeesApi.setArchived(targetUser._id, !currentlyArchived, module.key);
      toast.success(currentlyArchived ? "Access restored" : "Access removed");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update access");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = users.filter(
    (u) => !search.trim() || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const Icon = module.icon;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <button onClick={() => navigate("/hrms/manage")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-[18px] h-[18px]" /> Back to Manage
      </button>

      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{module.label}</h1>
          <p className="text-sm text-slate-500">
            {isHr ? "Manage every employee's access to this module." : "Manage access for your direct reports."}
          </p>
        </div>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              {module.hasArchive && <th className="text-left px-4 py-3">Access</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={module.hasArchive ? 4 : 3} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={module.hasArchive ? 4 : 3} className="px-4 py-8 text-center text-slate-400 italic">
                  {isHr ? "No employees found." : "You have no direct reports."}
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const currentRole = u.roles?.[module.key] || module.defaultRole;
                const archived = Boolean(u.archived?.[module.key]);
                // The select must always include the user's current role even
                // if it's above what this actor is allowed to newly assign —
                // otherwise choosing it would silently downgrade them.
                const options = roleOptions.includes(currentRole) ? roleOptions : [currentRole, ...roleOptions];
                return (
                  <tr key={u._id}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={currentRole}
                        disabled={savingId === u._id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs capitalize disabled:opacity-50"
                      >
                        {options.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    {module.hasArchive && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={savingId === u._id}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold disabled:opacity-50 ${archived ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          {archived ? "Removed" : "Active"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
