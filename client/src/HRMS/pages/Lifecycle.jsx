import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { UserCog, Plus, X, Check, MessageSquare, Wallet2 } from "lucide-react";
import { onboardingApi, offboardingApi, employeesApi } from "../hrmsApi";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

const STATUS_TONE = {
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  notice_period: "bg-amber-50 text-amber-700",
  cleared: "bg-emerald-50 text-emerald-700",
};

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {status?.replace(/_/g, " ")}
  </span>
);

function StartOnboardingModal({ employees, onClose, onSubmit, saving }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?._id || "");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Start onboarding</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button disabled={saving || !employeeId} onClick={() => onSubmit(employeeId)} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? "Starting..." : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingCard({ record, onToggleItem }) {
  const done = record.items.filter((i) => i.done).length;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-slate-900">{record.employee?.name}</h3>
          <p className="text-xs text-slate-500">{done} of {record.items.length} items complete</p>
        </div>
        <Badge status={record.status} />
      </div>
      <div className="space-y-1.5">
        {record.items.map((item) => (
          <label key={item._id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={item.done} onChange={(e) => onToggleItem(record._id, item._id, e.target.checked)} className="rounded border-slate-300" />
            <span className={item.done ? "line-through text-slate-400" : ""}>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function InitiateOffboardingModal({ employees, onClose, onSubmit, saving }) {
  const [form, setForm] = useState({ employeeId: employees[0]?._id || "", resignationDate: "", lastWorkingDate: "", reason: "" });
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  const valid = form.employeeId && form.resignationDate && form.lastWorkingDate;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Initiate offboarding</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.employeeId} onChange={set("employeeId")}>
          {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Resignation date</label>
            <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.resignationDate} onChange={set("resignationDate")} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Last working date</label>
            <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.lastWorkingDate} onChange={set("lastWorkingDate")} />
          </div>
        </div>
        <textarea placeholder="Reason (optional)" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.reason} onChange={set("reason")} />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button disabled={saving || !valid} onClick={() => onSubmit(form)} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? "Saving..." : "Initiate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteModal({ title, onClose, onSubmit, saving }) {
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <textarea placeholder="Notes (optional)" rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button disabled={saving} onClick={() => onSubmit(notes)} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OffboardingCard({ record, onExitInterview, onFinalSettlement }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-slate-900">{record.employee?.name}</h3>
        <Badge status={record.status} />
      </div>
      <p className="text-xs text-slate-500 mb-3">Last working day {fmtDate(record.lastWorkingDate)}</p>
      <div className="space-y-1.5 text-sm text-slate-600 mb-3">
        <p className="flex items-center gap-1.5">{record.exitInterview.conducted ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />} Exit interview</p>
        <p className="flex items-center gap-1.5">{record.pendingAssetReturns === 0 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />} Assets returned {record.pendingAssetReturns > 0 && `(${record.pendingAssetReturns} pending)`}</p>
        <p className="flex items-center gap-1.5">{record.finalSettlement.processed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />} Final settlement</p>
      </div>
      {record.status !== "cleared" && (
        <div className="flex gap-2">
          {!record.exitInterview.conducted && (
            <button onClick={() => onExitInterview(record)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              <MessageSquare className="w-3.5 h-3.5" /> Record exit interview
            </button>
          )}
          {record.exitInterview.conducted && !record.finalSettlement.processed && (
            <button onClick={() => onFinalSettlement(record)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-700 text-white text-xs font-semibold">
              <Wallet2 className="w-3.5 h-3.5" /> Process final settlement
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Lifecycle() {
  const [tab, setTab] = useState("onboarding");
  const [onboarding, setOnboarding] = useState([]);
  const [offboarding, setOffboarding] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStartOnboarding, setShowStartOnboarding] = useState(false);
  const [showInitiateOffboarding, setShowInitiateOffboarding] = useState(false);
  const [exitInterviewFor, setExitInterviewFor] = useState(null);
  const [settlementFor, setSettlementFor] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      onboardingApi.all().then((r) => setOnboarding(r.data || [])),
      offboardingApi.all().then((r) => setOffboarding(r.data || [])),
      employeesApi.list().then((r) => setEmployees(r.data || [])),
    ]).catch(() => toast.error("Failed to load lifecycle data")).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStartOnboarding = async (employeeId) => {
    setSaving(true);
    try {
      await onboardingApi.start(employeeId);
      toast.success("Onboarding started");
      setShowStartOnboarding(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start onboarding");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleItem = async (onboardingId, itemId, done) => {
    try {
      await onboardingApi.setItem(onboardingId, itemId, done);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update checklist");
    }
  };

  const handleInitiateOffboarding = async (form) => {
    setSaving(true);
    try {
      await offboardingApi.initiate(form);
      toast.success("Offboarding initiated");
      setShowInitiateOffboarding(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to initiate offboarding");
    } finally {
      setSaving(false);
    }
  };

  const handleExitInterview = async (notes) => {
    setSaving(true);
    try {
      await offboardingApi.recordExitInterview(exitInterviewFor._id, notes);
      toast.success("Exit interview recorded");
      setExitInterviewFor(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record exit interview");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalSettlement = async (notes) => {
    setSaving(true);
    try {
      await offboardingApi.processFinalSettlement(settlementFor._id, notes);
      toast.success("Final settlement processed");
      setSettlementFor(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to process settlement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <UserCog className="w-6 h-6 text-cyan-700" /> Lifecycle
          </h1>
          <p className="text-sm text-slate-500 mt-1">Onboarding checklists and offboarding clearance.</p>
        </div>
        {tab === "onboarding" ? (
          <button onClick={() => setShowStartOnboarding(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
            <Plus className="w-4 h-4" /> Start onboarding
          </button>
        ) : (
          <button onClick={() => setShowInitiateOffboarding(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
            <Plus className="w-4 h-4" /> Initiate offboarding
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab("onboarding")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "onboarding" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Onboarding</button>
        <button onClick={() => setTab("offboarding")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "offboarding" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Offboarding</button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          {tab === "onboarding" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {onboarding.length === 0 && <p className="text-sm text-slate-400 italic">No onboarding checklists yet.</p>}
              {onboarding.map((record) => <OnboardingCard key={record._id} record={record} onToggleItem={handleToggleItem} />)}
            </div>
          )}

          {tab === "offboarding" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offboarding.length === 0 && <p className="text-sm text-slate-400 italic">No offboarding records yet.</p>}
              {offboarding.map((record) => (
                <OffboardingCard key={record._id} record={record} onExitInterview={setExitInterviewFor} onFinalSettlement={setSettlementFor} />
              ))}
            </div>
          )}
        </>
      )}

      {showStartOnboarding && <StartOnboardingModal employees={employees} saving={saving} onClose={() => setShowStartOnboarding(false)} onSubmit={handleStartOnboarding} />}
      {showInitiateOffboarding && <InitiateOffboardingModal employees={employees} saving={saving} onClose={() => setShowInitiateOffboarding(false)} onSubmit={handleInitiateOffboarding} />}
      {exitInterviewFor && <NoteModal title="Record exit interview" saving={saving} onClose={() => setExitInterviewFor(null)} onSubmit={handleExitInterview} />}
      {settlementFor && <NoteModal title="Process final settlement" saving={saving} onClose={() => setSettlementFor(null)} onSubmit={handleFinalSettlement} />}
    </main>
  );
}
