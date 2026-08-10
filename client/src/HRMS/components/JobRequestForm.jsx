import { useState } from "react";
import { X } from "lucide-react";

const EMPTY = {
  title: "", department: "", positions: 1, location: "", employmentType: "Full-time",
  experienceRequired: "", skillsRequired: "", skillsPreferred: "", salaryRangeMin: "", salaryRangeMax: "",
  description: "", businessJustification: "", priority: "Medium", targetHiringDate: "",
};

const csvToArray = (v) => v.split(",").map((s) => s.trim()).filter(Boolean);

export default function JobRequestForm({ initial, onSubmit, onClose, saving }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    skillsRequired: (initial?.skillsRequired || []).join(", "),
    skillsPreferred: (initial?.skillsPreferred || []).join(", "),
    targetHiringDate: initial?.targetHiringDate ? initial.targetHiringDate.slice(0, 10) : "",
  }));

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit({
      ...form,
      positions: Number(form.positions) || 1,
      salaryRangeMin: form.salaryRangeMin ? Number(form.salaryRangeMin) : null,
      salaryRangeMax: form.salaryRangeMax ? Number(form.salaryRangeMax) : null,
      skillsRequired: csvToArray(form.skillsRequired),
      skillsPreferred: csvToArray(form.skillsPreferred),
      targetHiringDate: form.targetHiringDate || null,
    });
  };

  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400";
  const label = "text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Request a new job opening</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className={label}>Job title *</label>
            <input className={input} value={form.title} onChange={set("title")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Department</label>
              <input className={input} value={form.department} onChange={set("department")} />
            </div>
            <div>
              <label className={label}>Positions</label>
              <input type="number" min="1" className={input} value={form.positions} onChange={set("positions")} />
            </div>
            <div>
              <label className={label}>Location</label>
              <input className={input} value={form.location} onChange={set("location")} />
            </div>
            <div>
              <label className={label}>Employment type</label>
              <select className={input} value={form.employmentType} onChange={set("employmentType")}>
                {["Full-time", "Part-time", "Contract", "Intern"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Experience required</label>
              <input className={input} value={form.experienceRequired} onChange={set("experienceRequired")} placeholder="e.g. 3-5 years" />
            </div>
            <div>
              <label className={label}>Priority</label>
              <select className={input} value={form.priority} onChange={set("priority")}>
                {["Low", "Medium", "High", "Urgent"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Salary range min</label>
              <input type="number" className={input} value={form.salaryRangeMin} onChange={set("salaryRangeMin")} />
            </div>
            <div>
              <label className={label}>Salary range max</label>
              <input type="number" className={input} value={form.salaryRangeMax} onChange={set("salaryRangeMax")} />
            </div>
          </div>
          <div>
            <label className={label}>Required skills (comma separated)</label>
            <input className={input} value={form.skillsRequired} onChange={set("skillsRequired")} />
          </div>
          <div>
            <label className={label}>Preferred skills (comma separated)</label>
            <input className={input} value={form.skillsPreferred} onChange={set("skillsPreferred")} />
          </div>
          <div>
            <label className={label}>Job description</label>
            <textarea rows={3} className={input} value={form.description} onChange={set("description")} />
          </div>
          <div>
            <label className={label}>Business justification</label>
            <textarea rows={2} className={input} value={form.businessJustification} onChange={set("businessJustification")} />
          </div>
          <div>
            <label className={label}>Target hiring date</label>
            <input type="date" className={input} value={form.targetHiringDate} onChange={set("targetHiringDate")} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow disabled:opacity-60">
            {saving ? "Submitting..." : "Submit request"}
          </button>
        </div>
      </form>
    </div>
  );
}
