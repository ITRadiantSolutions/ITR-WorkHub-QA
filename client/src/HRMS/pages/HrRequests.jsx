import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { LifeBuoy, Plus, X, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { hrRequestsApi } from "../hrmsApi";

const TYPE_LABELS = {
  salary_certificate: "Salary Certificate",
  experience_letter: "Experience Letter",
  document_request: "Document Request",
  profile_change: "Profile Change",
  bank_change: "Bank Change",
  query: "General Query",
};

const STATUS_TONE = {
  open: "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-700",
  resolved: "bg-emerald-50 text-emerald-700",
};

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {status?.replace(/_/g, " ")}
  </span>
);

function RaiseRequestModal({ onClose, onSubmit, saving }) {
  const [form, setForm] = useState({ type: "query", subject: "", description: "" });
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Raise an HR request</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.type} onChange={set("type")}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input placeholder="Subject" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.subject} onChange={set("subject")} />
        <textarea placeholder="Details (optional)" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.description} onChange={set("description")} />

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button
            disabled={saving || !form.subject.trim()}
            onClick={() => onSubmit(form)}
            className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolveModal({ request, onClose, onResolve, saving }) {
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Resolve request</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-slate-600">{request.subject}</p>
        <textarea placeholder="Resolution note (optional)" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button disabled={saving} onClick={() => onResolve(note)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Mark resolved
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestTable({ rows, isHr, onAssignToMe, onResolve }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {isHr && <th className="text-left px-4 py-3">Requested by</th>}
            <th className="text-left px-4 py-3">Type</th>
            <th className="text-left px-4 py-3">Subject</th>
            {isHr && <th className="text-left px-4 py-3">Assigned to</th>}
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr><td colSpan={isHr ? 6 : 4} className="px-4 py-8 text-center text-slate-400 italic">Nothing here yet.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r._id}>
              {isHr && <td className="px-4 py-3 font-semibold text-slate-800">{r.requestedBy?.name}</td>}
              <td className="px-4 py-3 text-slate-600">{TYPE_LABELS[r.type] || r.type}</td>
              <td className="px-4 py-3">
                <p className="text-slate-800">{r.subject}</p>
                {r.status === "resolved" && r.resolutionNote && <p className="text-xs text-slate-400 mt-0.5">{r.resolutionNote}</p>}
              </td>
              {isHr && <td className="px-4 py-3 text-slate-600">{r.assignedTo?.name || "—"}</td>}
              <td className="px-4 py-3"><Badge status={r.status} /></td>
              <td className="px-4 py-3 flex gap-3">
                {isHr && r.status !== "resolved" && !r.assignedTo && (
                  <button onClick={() => onAssignToMe(r)} className="text-cyan-700 font-semibold hover:underline text-xs">Assign to me</button>
                )}
                {isHr && r.status !== "resolved" && (
                  <button onClick={() => onResolve(r)} className="text-emerald-700 font-semibold hover:underline text-xs">Resolve</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HrRequests() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";

  const [tab, setTab] = useState(isHr ? "all" : "mine");
  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRaise, setShowRaise] = useState(false);
  const [resolving, setResolving] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const calls = [hrRequestsApi.mine().then((r) => setMine(r.data || []))];
    if (isHr) calls.push(hrRequestsApi.all().then((r) => setAll(r.data || [])));
    Promise.all(calls).catch(() => toast.error("Failed to load HR requests")).finally(() => setLoading(false));
  }, [isHr]);

  useEffect(() => { load(); }, [load]);

  const handleRaise = async (form) => {
    setSaving(true);
    try {
      await hrRequestsApi.create(form);
      toast.success("Request submitted");
      setShowRaise(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit request");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignToMe = async (r) => {
    try {
      await hrRequestsApi.assign(r._id, user._id || user.id);
      toast.success("Assigned to you");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign");
    }
  };

  const handleResolve = async (note) => {
    setSaving(true);
    try {
      await hrRequestsApi.resolve(resolving._id, note);
      toast.success("Marked resolved");
      setResolving(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resolve");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-cyan-700" /> HR Requests
          </h1>
          <p className="text-sm text-slate-500 mt-1">Certificates, letters, document and profile change requests.</p>
        </div>
        <button onClick={() => setShowRaise(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
          <Plus className="w-4 h-4" /> Raise a request
        </button>
      </div>

      {isHr && (
        <div className="flex gap-2 mb-5">
          <button onClick={() => setTab("all")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "all" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            All Requests
          </button>
          <button onClick={() => setTab("mine")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "mine" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            My Requests
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : tab === "all" ? (
        <RequestTable rows={all} isHr onAssignToMe={handleAssignToMe} onResolve={setResolving} />
      ) : (
        <RequestTable rows={mine} isHr={false} />
      )}

      {showRaise && <RaiseRequestModal saving={saving} onClose={() => setShowRaise(false)} onSubmit={handleRaise} />}
      {resolving && <ResolveModal request={resolving} saving={saving} onClose={() => setResolving(null)} onResolve={handleResolve} />}
    </main>
  );
}
