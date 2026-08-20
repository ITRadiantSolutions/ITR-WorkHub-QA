import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Laptop, Plus, X, UserPlus, Undo2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { assetsApi, employeesApi } from "../hrmsApi";

const CATEGORY_LABELS = { laptop: "Laptop", monitor: "Monitor", mobile: "Mobile", sim: "SIM", keyboard: "Keyboard", mouse: "Mouse", other: "Other" };
const CONDITIONS = ["new", "good", "fair", "damaged"];

const STATUS_TONE = {
  available: "bg-emerald-50 text-emerald-700",
  assigned: "bg-blue-50 text-blue-700",
  retired: "bg-slate-100 text-slate-500",
  active: "bg-blue-50 text-blue-700",
  returned: "bg-slate-100 text-slate-500",
};

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {status}
  </span>
);

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

function AssetFormModal({ initial, onClose, onSubmit, saving }) {
  const [form, setForm] = useState(() => ({
    assetTag: initial?.assetTag || "",
    name: initial?.name || "",
    category: initial?.category || "laptop",
    serialNumber: initial?.serialNumber || "",
    condition: initial?.condition || "new",
    notes: initial?.notes || "",
  }));
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{initial ? "Edit asset" : "Add asset"}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Asset tag" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.assetTag} onChange={set("assetTag")} disabled={Boolean(initial)} />
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.category} onChange={set("category")}>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <input placeholder="Name (e.g. Dell XPS 13)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.name} onChange={set("name")} />
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Serial number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.serialNumber} onChange={set("serialNumber")} />
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.condition} onChange={set("condition")}>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <textarea placeholder="Notes (optional)" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.notes} onChange={set("notes")} />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button
            disabled={saving || !form.assetTag.trim() || !form.name.trim()}
            onClick={() => onSubmit(form)}
            className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : initial ? "Save changes" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignModal({ asset, employees, onClose, onSubmit, saving }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?._id || "");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Assign {asset.name}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button disabled={saving || !employeeId} onClick={() => onSubmit(employeeId)} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReturnModal({ assignment, onClose, onSubmit, saving }) {
  const [condition, setCondition] = useState(assignment.asset?.condition || "good");
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Return {assignment.asset?.name}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={condition} onChange={(e) => setCondition(e.target.value)}>
          {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea placeholder="Notes (optional)" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button disabled={saving} onClick={() => onSubmit(condition, notes)} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? "Saving..." : "Mark returned"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Assets() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";

  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [returning, setReturning] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const calls = [assetsApi.myAssignments().then((r) => setMine(r.data || []))];
    if (isHr) {
      calls.push(assetsApi.list().then((r) => setCatalog(r.data || [])));
      calls.push(assetsApi.assignments().then((r) => setAssignments(r.data || [])));
      calls.push(employeesApi.list().then((r) => setEmployees(r.data || [])));
    }
    Promise.all(calls).catch(() => toast.error("Failed to load assets")).finally(() => setLoading(false));
  }, [isHr]);

  useEffect(() => { load(); }, [load]);

  const handleSubmitAsset = async (form) => {
    setSaving(true);
    try {
      if (editing) {
        await assetsApi.update(editing._id, form);
        toast.success("Asset updated");
      } else {
        await assetsApi.create(form);
        toast.success("Asset added");
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save asset");
    } finally {
      setSaving(false);
    }
  };

  const toggleRetire = async (asset) => {
    try {
      await assetsApi.setStatus(asset._id, asset.status === "retired" ? "available" : "retired");
      toast.success(asset.status === "retired" ? "Asset reactivated" : "Asset retired");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleAssign = async (employeeId) => {
    setSaving(true);
    try {
      await assetsApi.assign(assigning._id, employeeId);
      toast.success("Asset assigned");
      setAssigning(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (condition, notes) => {
    setSaving(true);
    try {
      await assetsApi.return(returning._id, condition, notes);
      toast.success("Asset returned");
      setReturning(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to return asset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Laptop className="w-6 h-6 text-cyan-700" /> Assets
          </h1>
          <p className="text-sm text-slate-500 mt-1">Company equipment and who has it.</p>
        </div>
        {isHr && tab === "catalog" && (
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
            <Plus className="w-4 h-4" /> Add asset
          </button>
        )}
      </div>

      {isHr && (
        <div className="flex gap-2 mb-5">
          <button onClick={() => setTab("mine")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "mine" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>My Assets</button>
          <button onClick={() => setTab("catalog")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "catalog" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Catalog</button>
          <button onClick={() => setTab("assignments")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "assignments" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Assignments</button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          {tab === "mine" && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="text-left px-4 py-3">Asset</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Assigned on</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mine.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No assets assigned to you.</td></tr>}
                  {mine.map((a) => (
                    <tr key={a._id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{a.asset?.name} <span className="text-slate-400 font-normal">({a.asset?.assetTag})</span></td>
                      <td className="px-4 py-3 text-slate-600">{CATEGORY_LABELS[a.asset?.category] || a.asset?.category}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(a.assignedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "catalog" && isHr && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3">Tag</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Category</th>
                    <th className="text-left px-4 py-3">Condition</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {catalog.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">No assets yet.</td></tr>}
                  {catalog.map((a) => (
                    <tr key={a._id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.assetTag}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{a.name}</td>
                      <td className="px-4 py-3 text-slate-600">{CATEGORY_LABELS[a.category] || a.category}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{a.condition}</td>
                      <td className="px-4 py-3"><Badge status={a.status} /></td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => { setEditing(a); setShowForm(true); }} className="text-cyan-700 font-semibold hover:underline text-xs">Edit</button>
                        {a.status === "available" && (
                          <button onClick={() => setAssigning(a)} className="text-cyan-700 font-semibold hover:underline text-xs flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Assign</button>
                        )}
                        {a.status !== "assigned" && (
                          <button onClick={() => toggleRetire(a)} className="text-slate-500 font-semibold hover:underline text-xs">{a.status === "retired" ? "Reactivate" : "Retire"}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "assignments" && isHr && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="text-left px-4 py-3">Asset</th><th className="text-left px-4 py-3">Employee</th><th className="text-left px-4 py-3">Assigned on</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No assignments yet.</td></tr>}
                  {assignments.map((a) => (
                    <tr key={a._id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{a.asset?.name} <span className="text-slate-400 font-normal">({a.asset?.assetTag})</span></td>
                      <td className="px-4 py-3 text-slate-600">{a.employee?.name}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(a.assignedAt)}</td>
                      <td className="px-4 py-3"><Badge status={a.status} /></td>
                      <td className="px-4 py-3">
                        {a.status === "active" && (
                          <button onClick={() => setReturning(a)} className="text-cyan-700 font-semibold hover:underline text-xs flex items-center gap-1"><Undo2 className="w-3.5 h-3.5" /> Return</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showForm && <AssetFormModal initial={editing} saving={saving} onClose={() => { setShowForm(false); setEditing(null); }} onSubmit={handleSubmitAsset} />}
      {assigning && <AssignModal asset={assigning} employees={employees} saving={saving} onClose={() => setAssigning(null)} onSubmit={handleAssign} />}
      {returning && <ReturnModal assignment={returning} saving={saving} onClose={() => setReturning(null)} onSubmit={handleReturn} />}
    </main>
  );
}
