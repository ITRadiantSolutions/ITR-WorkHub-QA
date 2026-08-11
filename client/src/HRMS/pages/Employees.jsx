import { useEffect, useState, useCallback } from "react";
// import { useNavigate } from "react-router-dom"; // only used by the disabled Actions/View button below
import { toast } from "sonner";
import { UserPlus, Search, RefreshCw } from "lucide-react"; // Eye icon only used by the disabled Actions/View button below
import { employeesApi } from "../hrmsApi";

// const ROLE_OPTIONS = ["employee", "manager", "hr"]; // only used by the disabled Role select below

export default function Employees() {
  // This page is view-only now — role and status changes happen exclusively
  // on HRMS Manage (/hrms/manage), the single centralized place for module access.
  // const navigate = useNavigate(); // only used by the disabled Actions/View button below
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    employeesApi
      .list(search.trim() ? { search: search.trim() } : {})
      .then((res) => setEmployees(res.data || []))
      .catch(() => toast.error("Failed to load employees"))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await employeesApi.sync();
      toast.success(res.data?.message || "Sync complete");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Role/status editing moved to HRMS Manage (/hrms/manage) — kept here, commented, in case it's reinstated.
  // const setRole = async (emp, role) => {
  //   try {
  //     await employeesApi.setRole(emp._id, role);
  //     toast.success("Role updated");
  //     load();
  //   } catch (err) {
  //     toast.error(err.response?.data?.message || "Failed to update role");
  //   }
  // };
  //
  // const toggleActive = async (emp) => {
  //   try {
  //     await employeesApi.setArchived(emp._id, !emp.archived?.hrms);
  //     toast.success(emp.archived?.hrms ? "Activated" : "Deactivated");
  //     load();
  //   } catch (err) {
  //     toast.error(err.response?.data?.message || "Failed to update status");
  //   }
  // };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-cyan-700" /> Employees
          </h1>
          <p className="text-sm text-slate-500 mt-1">View the full employee roster. Role and status changes happen on the Manage page.</p>
        </div>
        <button onClick={sync} disabled={syncing} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sync from Azure AD
        </button>
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
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Designation</th>
              <th className="text-left px-4 py-3">Manager</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Status</th>
              {/* <th className="text-left px-4 py-3">Actions</th> */}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No employees found.</td></tr>
            ) : (
              employees.map((e) => (
                <tr key={e._id}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{e.name}</td>
                  <td className="px-4 py-3 text-slate-500">{e.email}</td>
                  <td className="px-4 py-3">{e.department || "—"}</td>
                  <td className="px-4 py-3">{e.designation || "—"}</td>
                  <td className="px-4 py-3">{e.managerId?.name || e.managerName}</td>
                  <td className="px-4 py-3 capitalize">
                    {e.roles?.hrms || "employee"}
                    {/* <select value={e.roles?.hrms || "employee"} onChange={(ev) => setRole(e, ev.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs capitalize">
                      {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select> */}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${e.archived?.hrms ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                      {e.archived?.hrms ? "Inactive" : "Active"}
                    </span>
                    {/* <button
                      onClick={() => toggleActive(e)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${e.archived?.hrms ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}
                    >
                      {e.archived?.hrms ? "Inactive" : "Active"}
                    </button> */}
                  </td>
                  {/* <td className="px-4 py-3">
                    <button onClick={() => navigate(`/hrms/employees/${e._id}`)} className="text-cyan-700 font-semibold flex items-center gap-1 hover:underline">
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  </td> */}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
