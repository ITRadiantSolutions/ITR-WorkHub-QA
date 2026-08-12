import { useEffect, useState } from "react";
import { toast } from "sonner";
import { API } from "../services/api";
import Icons from "../components/Icons";

function GroupModal({ group, users, groups, onClose, onSaved }) {
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [members, setMembers] = useState(new Set((group?.members || []).map((m) => m._id || m)));
  const [saving, setSaving] = useState(false);

  // Mirrors the server's one-group-per-user rule (usersGroupController.js
  // findConflictingMembers) so the picker doesn't offer someone the save
  // would just reject — the group being edited is excluded so its own
  // existing members stay pickable.
  const alreadyGroupedUserIds = new Set(
    groups
      .filter((g) => g._id !== group?._id)
      .flatMap((g) => (g.members || []).map((m) => String(m._id || m))),
  );
  const availableUsers = users.filter((u) => members.has(u._id) || !alreadyGroupedUserIds.has(String(u._id)));

  const toggleMember = (id) =>
    setMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (!name.trim()) return toast.error("Group name is required");
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim(), members: Array.from(members) };
    try {
      if (group) await API.put(`/pms/users-groups/${group._id}`, payload);
      else await API.post("/pms/users-groups", payload);
      toast.success(group ? "Group updated" : "Group created");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">{group ? "Edit group" : "New group"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><Icons.X /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Members ({members.size} selected)
            </label>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {availableUsers.map((u) => (
                <label key={u._id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={members.has(u._id)} onChange={() => toggleMember(u._id)} className="accent-violet-600" />
                  <span className="font-medium text-slate-800">{u.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{u.email}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6">
          <button onClick={submit} disabled={saving} className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-slate-500 text-sm font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserGroups() {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null=closed, {}=new, group=edit
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([API.get("/pms/users-groups"), API.get("/users")])
      .then(([gRes, uRes]) => {
        setGroups(gRes.data || []);
        setUsers(uRes.data || []);
      })
      .catch(() => toast.error("Failed to load groups"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete group "${name}"?`)) return;
    try {
      await API.delete(`/pms/users-groups/${id}`);
      toast.success("Group deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete group");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">User groups</h2>
            <p className="text-sm text-slate-500">Assign KRA templates to whole groups at once.</p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow"
          >
            <Icons.Plus /> New Group
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : !groups.length ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-500">No groups yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((g) => (
              <div key={g._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-bold text-slate-900">{g.name}</h3>
                  <span className="text-xs font-semibold text-violet-700 bg-violet-100 px-2 py-1 rounded-full shrink-0">
                    {g.members?.length || 0} members
                  </span>
                </div>
                {g.description && <p className="text-sm text-slate-500 mb-3">{g.description}</p>}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(g.members || []).slice(0, 5).map((m) => (
                    <span key={m._id} className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                      {m.name}
                    </span>
                  ))}
                  {g.members?.length > 5 && <span className="text-[11px] font-medium text-slate-400">+{g.members.length - 5} more</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditing(g); setShowModal(true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs py-2 hover:bg-slate-50"
                  >
                    <Icons.Edit /> Edit
                  </button>
                  <button onClick={() => handleDelete(g._id, g.name)} className="p-2 rounded-xl border border-slate-200 text-red-500 hover:bg-red-50" title="Delete">
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <GroupModal
          group={editing}
          users={users}
          groups={groups}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
