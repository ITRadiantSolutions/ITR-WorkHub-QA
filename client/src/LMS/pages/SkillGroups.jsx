import { useEffect, useState } from "react";
import { toast } from "sonner";
import { skillGroupsApi, assignmentsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

export default function SkillGroups() {
  const [groups, setGroups] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [membersFor, setMembersFor] = useState(null);

  const load = () =>
    skillGroupsApi
      .all()
      .then((res) => setGroups(res.data))
      .catch(() => toast.error("Failed to load skill groups"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    assignmentsApi.employees().then((res) => setEmployees(res.data)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form._id) await skillGroupsApi.update(form._id, form);
      else await skillGroupsApi.create(form);
      toast.success("Skill group saved");
      setForm(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save skill group");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this skill group?")) return;
    try {
      await skillGroupsApi.remove(id);
      toast.success("Skill group deleted");
      load();
    } catch {
      toast.error("Failed to delete skill group");
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Skill Groups</h1>
        <p className="text-xs text-slate-500 mt-0.5">Group employees for skills-based training — an employee can belong to multiple groups.</p>
      </div>

      <button onClick={() => setForm({ name: "", description: "" })} className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:underline">
        <Icons.Plus /> Add Skill Group
      </button>

      {form && (
        <form onSubmit={submit} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name (e.g. Full Stack)"
            className="text-xs rounded-lg border border-slate-200 px-3 py-1.5"
          />
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            className="text-xs rounded-lg border border-slate-200 px-3 py-1.5"
          />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
              Save
            </button>
            <button type="button" onClick={() => setForm(null)} className="text-xs font-semibold text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((group) => (
          <div key={group._id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Icons.Layers />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{group.name}</p>
                  <p className="text-[10px] text-slate-400">{group.members.length} member{group.members.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setForm(group)} className="text-slate-400 hover:text-amber-600">
                  <Icons.Edit />
                </button>
                <button onClick={() => remove(group._id)} className="text-slate-400 hover:text-red-500">
                  <Icons.Trash />
                </button>
              </div>
            </div>
            {group.description && <p className="text-[10px] text-slate-400">{group.description}</p>}
            <button onClick={() => setMembersFor(group)} className="text-[10px] font-semibold text-amber-600 hover:underline">
              Manage members
            </button>
          </div>
        ))}
        {groups.length === 0 && <p className="text-xs text-slate-400">No skill groups yet.</p>}
      </div>

      {membersFor && (
        <MembersModal
          group={groups.find((g) => g._id === membersFor._id) || membersFor}
          employees={employees}
          onClose={() => setMembersFor(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function MembersModal({ group, employees, onClose, onChanged }) {
  const [memberIds, setMemberIds] = useState(new Set(group.members.map((m) => (typeof m === "string" ? m : m._id))));
  const [saving, setSaving] = useState(false);

  const toggle = async (employeeId) => {
    setSaving(true);
    try {
      if (memberIds.has(employeeId)) {
        await skillGroupsApi.removeMember(group._id, employeeId);
        setMemberIds((prev) => {
          const next = new Set(prev);
          next.delete(employeeId);
          return next;
        });
      } else {
        await skillGroupsApi.addMembers(group._id, [employeeId]);
        setMemberIds((prev) => new Set(prev).add(employeeId));
      }
      onChanged();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update members");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-800">Members — {group.name}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icons.X />
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-slate-50">
          {employees.map((employee) => (
            <label key={employee._id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer">
              <input type="checkbox" disabled={saving} checked={memberIds.has(employee._id)} onChange={() => toggle(employee._id)} />
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">{employee.name}</p>
                <p className="text-[10px] text-slate-400">{employee.email}</p>
              </div>
            </label>
          ))}
          {employees.length === 0 && <p className="text-xs text-slate-400 p-4">No employees available.</p>}
        </div>
      </div>
    </div>
  );
}
