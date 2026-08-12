import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, ShieldPlus, ShieldMinus, History, Search, Pencil, Check, Settings2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isSuperAdmin } from "../utils/hrmsrolecheck";
import { employeesApi } from "../HRMS/hrmsApi";
import { MANAGE_MODULES } from "../HRMS/moduleAccessConfig";

const MODULE_LABELS = Object.fromEntries(MANAGE_MODULES.map((m) => [m.key, m.label]));

// Mirrors PROTECTED_SUPER_ADMIN_EMAIL in server/src/controllers/userController.js
// — this is UI-only (hides the Remove action instead of letting it 400);
// the server is what actually enforces it.
const PROTECTED_SUPER_ADMIN_EMAIL = "pulkit.bopche@itradiant.com";
const isProtectedSuperAdmin = (e) => e.email?.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL;

// Blue is deliberately not one of the 6 workspace tile accents on the Hub
// (indigo/emerald/violet/amber/rose/cyan) — this page sits above every
// module as platform-level admin tooling, not a workspace, so it gets its
// own identity instead of borrowing one.
const TABS = [
  { key: "grants", label: "Access Grants", icon: ShieldCheck, description: "Decide who can manage access, and to which modules." },
  { key: "manage", label: "Manage Roles", icon: Settings2, description: "Assign each person's role and access, module by module." },
  { key: "super-admins", label: "Super Admins", icon: ShieldPlus, description: "Grant or remove the highest privilege in the app." },
  { key: "audit", label: "Audit Logs", icon: History, description: "Every access-grant, role and super admin change, in order." },
];

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
        <div className="bg-gradient-to-br from-blue-700 to-blue-500 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wide text-white/80">Manage access</p>
          <h2 className="text-lg font-extrabold">{employee.name}</h2>
          <p className="text-xs text-white/80">{employee.email}</p>
        </div>

        <div className="px-6 py-5">
          <button
            onClick={toggleAll}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 mb-3"
          >
            Select all modules
            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${allSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
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
                    checked ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{m.label}</span>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
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
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow disabled:opacity-60">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Same module-picker → per-employee role/access table that used to live at
// /hrms/manage + /hrms/manage/:moduleKey, folded into Access Grants instead
// of a separate HRMS-nested page — every module a super admin can touch,
// not just HRMS.
function ManageRolesTab({ employees, onChanged, moduleKey, onSelectModule }) {
  const [savingId, setSavingId] = useState(null);
  const module = MANAGE_MODULES.find((m) => m.key === moduleKey);

  const changeRole = async (targetUser, role) => {
    setSavingId(targetUser._id);
    try {
      await employeesApi.setRole(targetUser._id, role, module.key);
      toast.success(`${module.label} role updated`);
      onChanged();
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
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update access");
    } finally {
      setSavingId(null);
    }
  };

  if (!module) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {MANAGE_MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              onClick={() => onSelectModule(m.key)}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left hover:border-blue-300 hover:shadow-md transition"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <p className="font-bold text-slate-900">{m.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">Manage roles &amp; access</p>
            </button>
          );
        })}
      </div>
    );
  }

  const roleOptions = module.roles;

  return (
    <div>
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
            {employees.length === 0 ? (
              <tr><td colSpan={module.hasArchive ? 4 : 3} className="px-4 py-8 text-center text-slate-400 italic">No employees found.</td></tr>
            ) : (
              employees.map((u) => {
                const currentRole = u.roles?.[module.key] || module.defaultRole;
                const archived = Boolean(u.archived?.[module.key]);
                // The select must always include the user's current role even
                // if it's above what a normal grant would newly assign —
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
    </div>
  );
}

// Granting/revoking super admin bypasses every other permission gate in the
// app, so this asks for the employee's email to be typed out before it'll
// let the action through — a plain "Are you sure?" is too easy to click
// past by habit for something this powerful.
function SuperAdminModal({ employee, action, onClose, onSaved }) {
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const granting = action === "grant";
  const matches = confirmText.trim().toLowerCase() === employee.email.toLowerCase();

  const save = async () => {
    if (!matches) return;
    setSaving(true);
    try {
      await employeesApi.setSuperAdmin(employee._id, granting);
      toast.success(granting ? `${employee.name} is now a super admin` : `Super admin removed from ${employee.name}`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update super admin status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`px-6 py-5 text-white ${granting ? "bg-gradient-to-br from-blue-700 to-blue-500" : "bg-gradient-to-br from-rose-600 to-rose-500"}`}>
          <p className="text-xs font-bold uppercase tracking-wide text-white/80">{granting ? "Grant super admin" : "Remove super admin"}</p>
          <h2 className="text-lg font-extrabold">{employee.name}</h2>
          <p className="text-xs text-white/80">{employee.email}</p>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-600">
            {granting
              ? "This gives them full access to every module, bypassing all role and access-grant checks. This is the highest privilege in the app."
              : "They will lose all super admin privileges, including the ability to manage Access Grants, immediately."}
          </p>
          <label className="block text-xs font-semibold text-slate-500">
            Type <span className="font-mono text-slate-700">{employee.email}</span> to confirm
          </label>
          <input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Employee email"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !matches}
            className={`px-4 py-2 rounded-xl text-white text-sm font-semibold shadow disabled:opacity-40 ${granting ? "bg-blue-600 hover:bg-blue-700" : "bg-rose-600 hover:bg-rose-700"}`}
          >
            {saving ? "Saving..." : granting ? "Grant super admin" : "Remove super admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Two sub-views: who already holds it (a short, scannable list — most of
// the time this is what you came here to check), and the full employee
// list to actually flip someone's status from.
function SuperAdminsTab({ employees, loading, onAction }) {
  const [view, setView] = useState("current");
  const admins = employees.filter((e) => e.isSuperAdmin);

  return (
    <div>
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 mb-4">
        <button
          onClick={() => setView("current")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            view === "current" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Current Admins{admins.length ? ` (${admins.length})` : ""}
        </button>
        <button
          onClick={() => setView("manage")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            view === "manage" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Give / Remove Access
        </button>
      </div>

      {view === "current" ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No super admins found.</td></tr>
              ) : (
                admins.map((e) => (
                  <tr key={e._id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-800">{e.name}</td>
                    <td className="px-4 py-3 text-slate-500">{e.email}</td>
                    <td className="px-4 py-3 text-right">
                      {isProtectedSuperAdmin(e) ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-500" title="This super admin is protected and can't be removed">
                          <ShieldCheck className="w-3.5 h-3.5" /> Protected
                        </span>
                      ) : (
                        <button
                          onClick={() => onAction({ employee: e, action: "revoke" })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <ShieldMinus className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No employees found.</td></tr>
              ) : (
                employees.map((e) => (
                  <tr key={e._id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-800">{e.name}</td>
                    <td className="px-4 py-3 text-slate-500">{e.email}</td>
                    <td className="px-4 py-3">
                      {e.isSuperAdmin ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">Super admin</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Regular</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.isSuperAdmin ? (
                        isProtectedSuperAdmin(e) ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-500" title="This super admin is protected and can't be removed">
                            <ShieldCheck className="w-3.5 h-3.5" /> Protected
                          </span>
                        ) : (
                          <button
                            onClick={() => onAction({ employee: e, action: "revoke" })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            <ShieldMinus className="w-3.5 h-3.5" /> Remove
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => onAction({ employee: e, action: "grant" })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <ShieldPlus className="w-3.5 h-3.5" /> Make super admin
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ACTION_LABELS = {
  "user.superAdmin.granted": "Super admin granted",
  "user.superAdmin.revoked": "Super admin revoked",
  "user.manageAccessGrant.updated": "Access grant updated",
  "user.role.updated": "Role updated",
  "user.archive.updated": "Access updated",
};
const actionLabel = (log) => ACTION_LABELS[log.event] || log.event;

// Detail text assumes "Performed by" is shown in its own table column, so
// it deliberately doesn't repeat the actor the way a one-line feed would.
function detailFor(log) {
  const target = log.metadata?.targetName || log.metadata?.targetEmail || "an employee";
  if (log.event === "user.superAdmin.granted") return `Made ${target} a super admin`;
  if (log.event === "user.superAdmin.revoked") return `Removed super admin from ${target}`;
  if (log.event === "user.manageAccessGrant.updated") {
    const before = new Set(log.oldValue?.modules || []);
    const after = new Set(log.newValue?.modules || []);
    const added = [...after].filter((m) => !before.has(m)).map((m) => MODULE_LABELS[m] || m);
    const removed = [...before].filter((m) => !after.has(m)).map((m) => MODULE_LABELS[m] || m);
    const parts = [];
    if (added.length) parts.push(`granted ${added.join(", ")}`);
    if (removed.length) parts.push(`revoked ${removed.join(", ")}`);
    return `${parts.length ? parts.join(" and ") : "Updated"} access for ${target}`;
  }
  if (log.event === "user.role.updated") {
    const moduleLabel = MODULE_LABELS[log.newValue?.module] || log.newValue?.module;
    return `Set ${target}'s ${moduleLabel} role to "${log.newValue?.role}" (was "${log.oldValue?.role || "employee"}")`;
  }
  if (log.event === "user.archive.updated") {
    const moduleLabel = MODULE_LABELS[log.newValue?.module] || log.newValue?.module;
    return `${log.newValue?.archived ? "Removed" : "Restored"} ${target}'s access to ${moduleLabel}`;
  }
  return log.event;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function AuditLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    employeesApi
      .accessAuditLogs({ limit: 500 })
      .then((res) => setLogs(res.data?.logs || []))
      .catch(() => toast.error("Failed to load audit logs"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400">Loading...</div>;

  if (logs.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 italic">No access-grant changes recorded yet.</div>;
  }

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageLogs = logs.slice(start, start + pageSize);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Details</th>
              <th className="text-left px-4 py-3">Performed by</th>
              <th className="text-left px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageLogs.map((log) => {
              const isSuperAdminEvent = log.event.startsWith("user.superAdmin");
              return (
                <tr key={log._id} className="hover:bg-slate-50/60 align-top">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        isSuperAdminEvent ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {isSuperAdminEvent ? <ShieldCheck className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      {actionLabel(log)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-sm">{detailFor(log)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-semibold text-slate-800">{log.actorName || "—"}</p>
                    <p className="text-xs text-slate-400">{log.actorEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>
            {start + 1}–{Math.min(start + pageSize, logs.length)} of {logs.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Prev
          </button>
          <span className="px-2 text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Next
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
// Laid out as its own console (left rail, electric blue accent) rather than
// reusing any single module's chrome — it isn't a workspace, it's the
// control panel that sits above all six.
export default function AccessGrants() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("grants");
  const [manageModuleKey, setManageModuleKey] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [superAdminAction, setSuperAdminAction] = useState(null); // { employee, action }

  const switchTab = (key) => {
    setTab(key);
    if (key !== "manage") setManageModuleKey(null);
  };

  const manageModule = MANAGE_MODULES.find((m) => m.key === manageModuleKey);

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
          <button onClick={() => navigate("/hub")} className="text-blue-700 font-semibold hover:underline">
            Back to Hub
          </button>
        </div>
      </main>
    );
  }

  const active = TABS.find((t) => t.key === tab);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 shrink-0 bg-white border-r border-slate-100 flex flex-col sticky top-0 h-screen">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-2 px-5 py-5 text-slate-500 hover:text-slate-900 transition text-sm font-semibold shrink-0">
          <ArrowLeft className="w-4 h-4" /> Back to Hub
        </button>

        <div className="flex items-center gap-3 px-5 pb-5 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 leading-tight">Access Grants</p>
            <p className="text-[11px] text-slate-400">Super admin console</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`relative w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {isActive && <span className="absolute left-0.5 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-blue-600" />}
                <Icon className="w-4.5 h-4.5 shrink-0" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 text-[11px] text-slate-400 border-t border-slate-100">
          Signed in as <span className="text-slate-600 font-medium">{user?.name}</span>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-8 py-8">
        <div className="mb-6">
          {tab === "manage" && manageModule ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setManageModuleKey(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
                title="Back to all modules"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <manageModule.icon className="w-4.5 h-4.5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">{manageModule.label}</h1>
                <p className="text-sm text-slate-500 mt-0.5">Manage roles &amp; access for {manageModule.label}</p>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-extrabold text-slate-900">{active.label}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{active.description}</p>
            </>
          )}
        </div>

        {tab !== "audit" && !(tab === "manage" && !manageModule) && (
          <div className="relative max-w-sm mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
        )}

        {tab === "grants" && (
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
                          {e.name} {e.isSuperAdmin && <span className="ml-1 text-[10px] font-bold text-blue-700 align-middle">SUPER ADMIN</span>}
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
                                <span key={m.key} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
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
        )}

        {tab === "manage" && (
          <ManageRolesTab employees={employees} onChanged={load} moduleKey={manageModuleKey} onSelectModule={setManageModuleKey} />
        )}

        {tab === "super-admins" && (
          <SuperAdminsTab employees={employees} loading={loading} onAction={setSuperAdminAction} />
        )}

        {tab === "audit" && <AuditLogsTab />}
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

      {superAdminAction && (
        <SuperAdminModal
          employee={superAdminAction.employee}
          action={superAdminAction.action}
          onClose={() => setSuperAdminAction(null)}
          onSaved={() => {
            setSuperAdminAction(null);
            load();
          }}
        />
      )}
    </div>
  );
}
