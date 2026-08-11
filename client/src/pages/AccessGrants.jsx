import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Search, Pencil, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isSuperAdmin } from "../utils/hrmsrolecheck";
import { employeesApi } from "../HRMS/hrmsApi";
import { MANAGE_MODULES } from "../HRMS/moduleAccessConfig";

// Opens per employee — lets the super admin pick exactly which modules to
// grant, with a "Select all" shortcut, and commits everything in one save
// instead of firing a request per click.
function GrantModal({ employee, onClose, onSaved }) {
  const [selected, setSelected] = useState(new Set(employee.manageAccessModules || []));
  const [saving, setSaving] = useState(false);
  const allSelected = selected.size === MANAGE_MODULES.length;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(MANAGE_MODULES.map((m) => m.key)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await employeesApi.setManageAccessGrant(employee._id, [...selected]);
      toast.success(`Access updated for ${employee.name}`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update grant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-br from-cyan-700 to-cyan-600 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-100">Manage access</p>
          <h2 className="text-lg font-extrabold">{employee.name}</h2>
          <p className="text-xs text-cyan-100">{employee.email}</p>
        </div>

        <div className="px-6 py-5">
          <button
            onClick={toggleAll}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 mb-3"
          >
            Select all modules
            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${allSelected ? "bg-cyan-700 border-cyan-700" : "border-slate-300"}`}>
              {allSelected && <Check className="w-3.5 h-3.5 text-white" />}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {MANAGE_MODULES.map((m) => {
              const Icon = m.icon;
              const checked = selected.has(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition ${
                    checked ? "bg-cyan-50 border-cyan-300 text-cyan-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{m.label}</span>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? "bg-cyan-700 border-cyan-700" : "border-slate-300"}`}>
                    {checked && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow disabled:opacity-60">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Deliberately NOT nested inside any module (HRMS, FlowTrack, etc.) — a
// super admin sits above every module's roles (see allowRoles/
// requireModuleAccess bypass in server/src/middleware), so this page lives
// at the top level, reachable from the Hub, not from inside HRMS's sidebar.
export default function AccessGrants() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

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

  if (!isSuperAdmin(user)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F5F7FB] px-6">
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-4">Only a super admin can view this page.</p>
          <button onClick={() => navigate("/hub")} className="text-cyan-700 font-semibold hover:underline">
            Back to Hub
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-[18px] h-[18px]" /> Back to Hub
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-700 to-cyan-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Access Grants</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Super admin only. Pick exactly which modules each person can edit access for — holding a module's "hr"/"manager"/"admin" tier
              alone no longer grants that on its own.
            </p>
          </div>
        </div>

        <div className="relative max-w-sm mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">HRMS role</th>
                <th className="text-left px-4 py-3">Can manage access to</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No employees found.</td></tr>
              ) : (
                employees.map((e) => {
                  const granted = e.manageAccessModules || [];
                  return (
                    <tr key={e._id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {e.name} {e.isSuperAdmin && <span className="ml-1 text-[10px] font-bold text-cyan-700 align-middle">SUPER ADMIN</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{e.email}</td>
                      <td className="px-4 py-3 capitalize">{e.roles?.hrms || "employee"}</td>
                      <td className="px-4 py-3">
                        {e.isSuperAdmin ? (
                          <span className="text-xs text-slate-400 italic">always granted, every module</span>
                        ) : granted.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {MANAGE_MODULES.filter((m) => granted.includes(m.key)).map((m) => (
                              <span key={m.key} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700">
                                {m.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!e.isSuperAdmin && (
                          <button
                            onClick={() => setEditing(e)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {editing && (
        <GrantModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
