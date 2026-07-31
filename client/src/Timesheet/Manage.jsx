import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icons from "../components/Icons";

const PAGE_SIZE = 12;
const AVATAR_COLORS = ["bg-indigo-600", "bg-slate-600", "bg-blue-600", "bg-teal-600", "bg-cyan-700", "bg-sky-700"];
const colorFor = (str) => {
  const hash = [...(str || "")].reduce((h, c) => h * 31 + c.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const initialsOf = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

// ── Project modal (create/edit) ────────────────────────────────────────────
function ProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: project?.name || "",
    description: project?.description || "",
    pocName: project?.poc?.name || "",
    pocEmail: project?.poc?.email || "",
    pocPhone: project?.poc?.phone || "",
    status: project?.status || "Planning",
    priority: project?.priority || "Medium",
  });
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Project name is required");
    setSaving(true);
    try {
      if (project) await API.put(`/projects/${project._id}`, form);
      else await API.post("/projects", form);
      toast.success(project ? "Project updated" : "Project created");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">{project ? "Edit project" : "New project"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icons.X /></button>
        </div>
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
            <input value={form.name} onChange={set("name")} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea value={form.description} onChange={set("description")} rows={2} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={set("status")} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white">
                {["Planning", "Active", "Completed"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Priority</label>
              <select value={form.priority} onChange={set("priority")} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white">
                {["Low", "Medium", "High"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3.5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Point of contact</p>
            <div className="space-y-2.5">
              <input value={form.pocName} onChange={set("pocName")} placeholder="POC name" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
              <input value={form.pocEmail} onChange={set("pocEmail")} placeholder="POC email" type="email" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
              <input value={form.pocPhone} onChange={set("pocPhone")} placeholder="POC phone" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={submit} disabled={saving} className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-500 text-sm font-semibold">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Company-wide holiday calendar (HR only) ─────────────────────────────────
function CompanyHolidaysPanel({ holidays, onChanged }) {
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const addDate = async () => {
    if (!newDate) return;
    setBusy(true);
    try {
      const res = await API.post("/company-holidays", { date: newDate, label: newLabel });
      onChanged((prev) => [...prev.filter((h) => h.date !== res.data.date), res.data].sort((a, b) => a.date.localeCompare(b.date)));
      setNewDate("");
      setNewLabel("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add holiday");
    } finally {
      setBusy(false);
    }
  };

  const removeDate = async (date) => {
    setBusy(true);
    try {
      await API.delete(`/company-holidays/${date}`);
      onChanged((prev) => prev.filter((h) => h.date !== date));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove holiday");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 max-w-2xl">
      <h3 className="text-lg font-bold text-slate-900 mb-1">Company Holiday Calendar</h3>
      <p className="text-sm text-slate-500 mb-4">
        Applies to every project by default. A project can opt out of a specific date (e.g. a client who works through it) from that project's "Declare Holidays" panel.
      </p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label (optional, e.g. Republic Day)"
          className="flex-1 min-w-[160px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button onClick={addDate} disabled={busy || !newDate} className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-50">
          Add
        </button>
      </div>

      {!holidays.length ? (
        <p className="text-sm text-slate-400 text-center py-4">No company holidays declared yet.</p>
      ) : (
        <div className="space-y-1.5">
          {[...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
            <div key={h.date} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">
                {new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                {h.label && <span className="text-slate-400 font-normal"> — {h.label}</span>}
              </span>
              <button onClick={() => removeDate(h.date)} disabled={busy} className="text-red-400 hover:text-red-600"><Icons.Trash /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Holidays modal ──────────────────────────────────────────────────────────
function HolidaysModal({ project, companyHolidays, onClose, onSaved }) {
  const [holidays, setHolidays] = useState(project.holidays || []);
  const [excluded, setExcluded] = useState(new Set(project.excludedHolidays || []));
  const [newDate, setNewDate] = useState("");
  const [busy, setBusy] = useState(false);

  const addDate = async () => {
    if (!newDate) return;
    setBusy(true);
    try {
      const res = await API.post(`/projects/${project._id}/holidays`, { date: newDate });
      setHolidays(res.data.holidays || []);
      setNewDate("");
      onSaved(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add holiday");
    } finally {
      setBusy(false);
    }
  };

  const removeDate = async (date) => {
    setBusy(true);
    try {
      const res = await API.delete(`/projects/${project._id}/holidays/${date}`);
      setHolidays(res.data.holidays || []);
      onSaved(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove holiday");
    } finally {
      setBusy(false);
    }
  };

  const toggleExcluded = async (date, isExcluded) => {
    setBusy(true);
    try {
      const res = isExcluded
        ? await API.delete(`/projects/${project._id}/excluded-holidays/${date}`)
        : await API.post(`/projects/${project._id}/excluded-holidays`, { date });
      setExcluded(new Set(res.data.excludedHolidays || []));
      onSaved(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update exception");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-slate-900">Holidays — {project.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icons.X /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">These dates are blocked on the timesheet for everyone assigned to this project.</p>

        <div className="flex items-center gap-2 mb-4">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button onClick={addDate} disabled={busy || !newDate} className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-50">
            Add
          </button>
        </div>

        {!holidays.length ? (
          <p className="text-sm text-slate-400 text-center py-4">No project-specific holidays declared yet.</p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1.5">
            {[...holidays].sort().map((d) => (
              <div key={d} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <button onClick={() => removeDate(d)} disabled={busy} className="text-red-400 hover:text-red-600"><Icons.Trash /></button>
              </div>
            ))}
          </div>
        )}

        {companyHolidays.length > 0 && (
          <div className="border-t border-slate-100 mt-5 pt-4">
            <p className="text-sm font-bold text-slate-700 mb-1">Company holiday exceptions</p>
            <p className="text-xs text-slate-500 mb-3">
              Check a date to let this project's team log hours on it anyway (e.g. a client who works through that public holiday).
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {companyHolidays.map((h) => {
                const isExcluded = excluded.has(h.date);
                return (
                  <label key={h.date} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isExcluded}
                      disabled={busy}
                      onChange={() => toggleExcluded(h.date, isExcluded)}
                      className="accent-amber-600"
                    />
                    <span className="font-medium text-slate-700 flex-1">
                      {new Date(h.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      {h.label && <span className="text-slate-400 font-normal"> — {h.label}</span>}
                    </span>
                    {isExcluded && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Working</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, onEdit, onHolidays }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-full ${colorFor(project.name)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
            {initialsOf(project.name)}
          </div>
          <h3 className="font-bold text-slate-900 truncate">{project.name}</h3>
        </div>
      </div>
      {project.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>}
      <div className="text-xs text-slate-500 space-y-0.5 mb-3">
        {project.poc?.name && <p><span className="font-semibold text-slate-600">POC Name:</span> {project.poc.name}</p>}
        {project.poc?.email && <p><span className="font-semibold text-slate-600">POC Email:</span> {project.poc.email}</p>}
        <p><span className="font-semibold text-slate-600">Users:</span> {project.teamMembers?.length || 0}</p>
      </div>
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-50">
        <button onClick={() => onHolidays(project)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold py-2 hover:bg-slate-50">
          <Icons.Calendar /> Declare Holidays
        </button>
        <button onClick={() => onEdit(project)} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center shrink-0">
          <Icons.Edit />
        </button>
      </div>
    </div>
  );
}

// ── Add / modify a user's project assignments ──────────────────────────────
function AddProjectModal({ user, projects, assignedIds, onClose, onSaved }) {
  const available = projects.filter((p) => !assignedIds.has(p._id));
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      await API.post(`/projects/${projectId}/team`, { userId: user._id });
      toast.success("Project added");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Add project</h3>
        <p className="text-sm text-slate-500 mb-4">Assign {user.name} to another project.</p>
        {available.length ? (
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm bg-white mb-4">
            <option value="">Select a project...</option>
            {available.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        ) : (
          <p className="text-sm text-slate-400 mb-4">Already assigned to every project.</p>
        )}
        <div className="flex items-center gap-2">
          <button onClick={submit} disabled={busy || !projectId} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">
            Add
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-500 text-sm font-semibold">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ModifyProjectsModal({ user, projects, assignedIds, onClose, onSaved }) {
  const [selected, setSelected] = useState(new Set(assignedIds));
  const [busy, setBusy] = useState(false);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setBusy(true);
    const toAdd = projects.filter((p) => selected.has(p._id) && !assignedIds.has(p._id));
    const toRemove = projects.filter((p) => !selected.has(p._id) && assignedIds.has(p._id));
    try {
      await Promise.all([
        ...toAdd.map((p) => API.post(`/projects/${p._id}/team`, { userId: user._id })),
        ...toRemove.map((p) => API.delete(`/projects/${p._id}/team/${user._id}`)),
      ]);
      toast.success("Project assignments updated");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update assignments");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Modify projects</h3>
        <p className="text-sm text-slate-500 mb-4">Update which projects {user.name} is assigned to.</p>
        <div className="space-y-1.5 mb-5">
          {projects.map((p) => (
            <label key={p._id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm cursor-pointer ${selected.has(p._id) ? "border-teal-300 bg-teal-50/50" : "border-slate-200"}`}>
              <input type="checkbox" checked={selected.has(p._id)} onChange={() => toggle(p._id)} className="accent-teal-600" />
              <span className="font-medium text-slate-800">{p.name}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={submit} disabled={busy} className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-50">
            Save changes
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-500 text-sm font-semibold">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function EmployeeCard({ user, projectNames, onAddProject, onModifyProjects }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-9 h-9 rounded-full ${colorFor(user.name)} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
          {initialsOf(user.name)}
        </div>
        <h3 className="font-bold text-slate-900 truncate">{user.name}</h3>
      </div>
      <p className="text-xs text-slate-500 mb-2 truncate">{user.email}</p>
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[1.5rem]">
        {projectNames.length ? (
          projectNames.map((name) => (
            <span key={name} className="text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5">{name}</span>
          ))
        ) : (
          <span className="text-[11px] text-slate-400">No projects assigned</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-50">
        <button onClick={() => onAddProject(user)} className="flex-1 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold py-2 hover:bg-emerald-50">
          + Add Project
        </button>
        <button onClick={() => onModifyProjects(user)} className="flex-1 rounded-lg border border-red-200 text-red-600 text-xs font-semibold py-2 hover:bg-red-50">
          Remove/Modify
        </button>
      </div>
    </div>
  );
}

// ── New employee modal ──────────────────────────────────────────────────────
function NewEmployeeModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) return toast.error("Name, email and password are required");
    setSaving(true);
    try {
      await API.post("/users", form);
      toast.success("Employee added");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">New employee</h3>
        <div className="space-y-3">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
          <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Temporary password" type="password" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={submit} disabled={saving} className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? "Adding..." : "Add employee"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-500 text-sm font-semibold">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Assign roles / shifts modals ────────────────────────────────────────────
const ROLE_OPTIONS = ["employee", "manager", "hr"];

function AssignRolesModal({ users, onClose, onChanged }) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const filtered = users.filter((u) => !query.trim() || u.name.toLowerCase().includes(query.trim().toLowerCase()) || u.email.toLowerCase().includes(query.trim().toLowerCase()));

  const changeRole = async (user, role) => {
    setBusyId(user._id);
    try {
      await API.patch(`/users/${user._id}/role`, { module: "timesheet", role });
      toast.success(`${user.name} is now ${role}`);
      onChanged(user._id, { roles: { ...user.roles, timesheet: role } });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update role");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Assign roles</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icons.X /></button>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees..." className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm mb-4" />
        <div className="space-y-1.5">
          {filtered.map((u) => (
            <div key={u._id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
              </div>
              <select
                value={u.roles?.timesheet || "employee"}
                onChange={(e) => changeRole(u, e.target.value)}
                disabled={busyId === u._id}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold bg-white shrink-0"
              >
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssignShiftsModal({ users, onClose, onChanged }) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const filtered = users.filter((u) => !query.trim() || u.name.toLowerCase().includes(query.trim().toLowerCase()));

  const save = async (user) => {
    const shift = drafts[user._id] ?? user.shift ?? "";
    setBusyId(user._id);
    try {
      await API.patch(`/users/${user._id}/shift`, { shift });
      toast.success(`Shift updated for ${user.name}`);
      onChanged(user._id, { shift });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update shift");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Assign shifts</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icons.X /></button>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees..." className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm mb-4" />
        <div className="space-y-1.5">
          {filtered.map((u) => (
            <div key={u._id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <p className="text-sm font-semibold text-slate-800 truncate flex-1">{u.name}</p>
              <input
                defaultValue={u.shift || ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [u._id]: e.target.value }))}
                placeholder="e.g. 9:00 AM - 6:00 PM"
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs w-48"
              />
              <button
                onClick={() => save(u)}
                disabled={busyId === u._id}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold disabled:opacity-50 shrink-0"
              >
                Save
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Manage() {
  const { user } = useAuth();
  const isHr = user?.roles?.timesheet === "hr";
  const [tab, setTab] = useState("projects");
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [companyHolidays, setCompanyHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [projectModal, setProjectModal] = useState(null); // "new" | project | null
  const [holidaysProject, setHolidaysProject] = useState(null);
  const [newEmployeeOpen, setNewEmployeeOpen] = useState(false);
  const [assignRolesOpen, setAssignRolesOpen] = useState(false);
  const [assignShiftsOpen, setAssignShiftsOpen] = useState(false);
  const [addProjectFor, setAddProjectFor] = useState(null);
  const [modifyProjectsFor, setModifyProjectsFor] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([API.get("/projects"), API.get("/users"), API.get("/company-holidays")])
      .then(([pRes, uRes, hRes]) => {
        setProjects(pRes.data || []);
        setUsers(uRes.data || []);
        setCompanyHolidays(hRes.data || []);
      })
      .catch(() => toast.error("Failed to load workspace data"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => setPage(1), [tab, search]);

  const projectsByUser = useMemo(() => {
    const map = new Map();
    for (const p of projects) {
      for (const member of p.teamMembers || []) {
        const id = member._id || member;
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(p);
      }
    }
    return map;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.poc?.name?.toLowerCase().includes(q) || p.poc?.email?.toLowerCase().includes(q));
  }, [projects, search]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const items = tab === "projects" ? filteredProjects : tab === "teams" ? filteredUsers : [];
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const patchUser = (id, patch) => setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, ...patch } : u)));

  return (
    <main className="w-[92%] max-w-[1600px] mx-auto px-2 py-8">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Workspace Management</h2>
          <p className="text-sm text-slate-500">Manage your projects and workspace settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAssignRolesOpen(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-teal-200 text-teal-700 text-sm font-bold hover:bg-teal-50">
            <Icons.Users /> Assign Roles
          </button>
          <button onClick={() => setAssignShiftsOpen(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow">
            <Icons.Calendar /> Assign Shifts
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-100 shadow-sm p-1.5 w-fit">
          <button
            onClick={() => setTab("projects")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === "projects" ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <Icons.Dashboard /> Projects
          </button>
          <button
            onClick={() => setTab("teams")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === "teams" ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <Icons.Users /> Teams
          </button>
          {isHr && (
            <button
              onClick={() => setTab("holidays")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === "holidays" ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icons.Calendar /> Company Holidays
            </button>
          )}
        </div>
        {tab !== "holidays" && (
          <div className="relative w-full sm:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search /></span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, POC..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>
        )}
      </div>

      {tab === "holidays" ? (
        loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <CompanyHolidaysPanel holidays={companyHolidays} onChanged={setCompanyHolidays} />
        )
      ) : (
        <>
          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading...</div>
          ) : !pageItems.length ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-500">No results.</div>
          ) : tab === "projects" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pageItems.map((p) => (
                <ProjectCard key={p._id} project={p} onEdit={setProjectModal} onHolidays={setHolidaysProject} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pageItems.map((u) => (
                <EmployeeCard
                  key={u._id}
                  user={u}
                  projectNames={(projectsByUser.get(u._id) || []).map((p) => p.name)}
                  onAddProject={setAddProjectFor}
                  onModifyProjects={setModifyProjectsFor}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
            <p className="text-sm text-slate-500">
              Showing {items.length ? (page - 1) * PAGE_SIZE + 1 : 0} to {Math.min(page * PAGE_SIZE, items.length)} of {items.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                <Icons.Back />
              </button>
              <span className="text-sm font-semibold text-slate-600">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                <Icons.Arrow />
              </button>
            </div>
          </div>

          <button
            onClick={() => (tab === "projects" ? setProjectModal("new") : setNewEmployeeOpen(true))}
            className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg flex items-center justify-center text-2xl font-bold z-30"
            title={tab === "projects" ? "New project" : "New employee"}
          >
            <Icons.Plus />
          </button>
        </>
      )}

      {projectModal && (
        <ProjectModal
          project={projectModal === "new" ? null : projectModal}
          onClose={() => setProjectModal(null)}
          onSaved={() => { setProjectModal(null); load(); }}
        />
      )}
      {holidaysProject && (
        <HolidaysModal
          project={holidaysProject}
          companyHolidays={companyHolidays}
          onClose={() => setHolidaysProject(null)}
          onSaved={(updated) =>
            setProjects((prev) =>
              prev.map((p) => (p._id === updated._id ? { ...p, holidays: updated.holidays, excludedHolidays: updated.excludedHolidays } : p)),
            )
          }
        />
      )}
      {newEmployeeOpen && <NewEmployeeModal onClose={() => setNewEmployeeOpen(false)} onSaved={() => { setNewEmployeeOpen(false); load(); }} />}
      {assignRolesOpen && <AssignRolesModal users={users} onClose={() => setAssignRolesOpen(false)} onChanged={patchUser} />}
      {assignShiftsOpen && <AssignShiftsModal users={users} onClose={() => setAssignShiftsOpen(false)} onChanged={patchUser} />}
      {addProjectFor && (
        <AddProjectModal
          user={addProjectFor}
          projects={projects}
          assignedIds={new Set((projectsByUser.get(addProjectFor._id) || []).map((p) => p._id))}
          onClose={() => setAddProjectFor(null)}
          onSaved={() => { setAddProjectFor(null); load(); }}
        />
      )}
      {modifyProjectsFor && (
        <ModifyProjectsModal
          user={modifyProjectsFor}
          projects={projects}
          assignedIds={new Set((projectsByUser.get(modifyProjectsFor._id) || []).map((p) => p._id))}
          onClose={() => setModifyProjectsFor(null)}
          onSaved={() => { setModifyProjectsFor(null); load(); }}
        />
      )}
    </main>
  );
}
