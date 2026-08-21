import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Wallet, Plus, Trash2, X, Printer, Download, CheckCircle2, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { salaryStructuresApi, payslipsApi, employeesApi } from "../hrmsApi";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS_TONE = {
  generated: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
};

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {status}
  </span>
);

const money = (n) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_LABELS = { earning: "Earning", contribution: "Contribution", deduction: "Deduction" };
const PAYMENT_MODE_LABELS = { bank_transfer: "Bank Transfer", cash: "Cash", cheque: "Cheque" };

const downloadPayslipPdf = async (payslip) => {
  try {
    const res = await payslipsApi.pdf(payslip._id);
    const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `payslip-${MONTHS[payslip.month - 1]}-${payslip.year}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    toast.error("Failed to download payslip PDF");
  }
};

function PayslipDetailModal({ payslip, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print:bg-white print:static" onClick={onClose}>
      <style>{`@media print { body * { visibility: hidden; } .payslip-print, .payslip-print * { visibility: visible; } .payslip-print { position: absolute; inset: 0; } }`}</style>
      <div onClick={(e) => e.stopPropagation()} className="payslip-print bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between print:hidden">
          <h2 className="text-lg font-bold text-slate-900">Payslip — {MONTHS[payslip.month - 1]} {payslip.year}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <h2 className="hidden print:block text-lg font-bold text-slate-900">Payslip — {MONTHS[payslip.month - 1]} {payslip.year}</h2>

        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {payslip.components.map((c, i) => (
            <div key={i} className="flex justify-between px-4 py-2 text-sm">
              <span className="text-slate-600">{c.name} <span className="text-slate-400 font-normal">({TYPE_LABELS[c.type] || c.type})</span></span>
              <span className={c.type !== "earning" ? "text-red-600" : "text-slate-800"}>
                {c.type !== "earning" ? "−" : ""}{money(c.amount)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><span>Gross earnings</span><span>{money(payslip.grossEarnings)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Total contributions</span><span>−{money(payslip.totalContributions)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Total deductions</span><span>−{money(payslip.totalDeductions)}</span></div>
          <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-100"><span>Net pay</span><span>{money(payslip.netPay)}</span></div>
        </div>

        <div className="flex justify-between items-center print:hidden">
          <Badge status={payslip.status} />
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={() => downloadPayslipPdf(payslip)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-700 text-white text-xs font-semibold">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneratePayslipModal({ employees, onClose, onSubmit, saving }) {
  const now = new Date();
  const [form, setForm] = useState({ employeeId: employees[0]?._id || "", month: now.getMonth() + 1, year: now.getFullYear() });
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Generate payslip</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.employeeId} onChange={set("employeeId")}>
          {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.month} onChange={set("month")}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.year} onChange={set("year")} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button
            disabled={saving || !form.employeeId}
            onClick={() => onSubmit({ ...form, month: Number(form.month), year: Number(form.year) })}
            className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkGenerateModal({ onClose, onSubmit, saving }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Generate for all employees</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-slate-500">
          Generates a payslip for every employee with a salary structure who doesn't already have one for this period.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button disabled={saving} onClick={() => onSubmit({ month, year })} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
            {saving ? "Generating..." : "Generate for all"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SalaryStructureEditor({ employees }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?._id || "");
  const [components, setComponents] = useState([]);
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [uan, setUan] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback((id) => {
    if (!id) return;
    setLoading(true);
    salaryStructuresApi.get(id)
      .then((r) => {
        setComponents(r.data.components || []);
        setPaymentMode(r.data.paymentMode || "bank_transfer");
        setUan(r.data.uan || "");
        setMonthlySalary(r.data.monthlySalary || "");
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setComponents([]);
          setPaymentMode("bank_transfer");
          setUan("");
          setMonthlySalary("");
        } else toast.error("Failed to load salary structure");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(employeeId); }, [employeeId, load]);

  const updateRow = (i, field, value) => setComponents((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRow = () => setComponents((rows) => [...rows, { name: "", type: "earning", amount: 0 }]);
  const removeRow = (i) => setComponents((rows) => rows.filter((_, idx) => idx !== i));

  const gross = components.filter((c) => c.type === "earning").reduce((s, c) => s + Number(c.amount || 0), 0);
  const contributions = components.filter((c) => c.type === "contribution").reduce((s, c) => s + Number(c.amount || 0), 0);
  const deductions = components.filter((c) => c.type === "deduction").reduce((s, c) => s + Number(c.amount || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await salaryStructuresApi.upsert({
        employeeId,
        components: components.map((c) => ({ ...c, amount: Number(c.amount) || 0 })),
        paymentMode,
        uan,
        monthlySalary: Number(monthlySalary) || 0,
      });
      toast.success("Salary structure saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      <select className="w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
      </select>

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Payment mode</label>
              <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                {Object.entries(PAYMENT_MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">UAN</label>
              <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={uan} onChange={(e) => setUan(e.target.value)} placeholder="PF UAN number" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Monthly salary (reference)</label>
              <input type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} placeholder="e.g. 54168" />
            </div>
          </div>

          <div className="space-y-2">
            {components.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input placeholder="Component name" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" value={c.name} onChange={(e) => updateRow(i, "name", e.target.value)} />
                <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={c.type} onChange={(e) => updateRow(i, "type", e.target.value)}>
                  <option value="earning">Earning</option>
                  <option value="contribution">Contribution</option>
                  <option value="deduction">Deduction</option>
                </select>
                <input type="number" placeholder="Amount" className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm" value={c.amount} onChange={(e) => updateRow(i, "amount", e.target.value)} />
                <button onClick={() => removeRow(i)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {components.length === 0 && <p className="text-sm text-slate-400 italic">No components yet — add one below.</p>}
          </div>

          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
            <Plus className="w-3.5 h-3.5" /> Add component
          </button>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">
              Gross <span className="font-semibold text-slate-800">{money(gross)}</span> · Contributions <span className="font-semibold text-red-600">{money(contributions)}</span> · Deductions <span className="font-semibold text-red-600">{money(deductions)}</span> · Net <span className="font-semibold text-slate-900">{money(gross - contributions - deductions)}</span>
            </p>
            <button disabled={saving || !components.length} onClick={handleSave} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? "Saving..." : "Save structure"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";

  const [tab, setTab] = useState("mine");
  const [myPayslips, setMyPayslips] = useState([]);
  const [allPayslips, setAllPayslips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showBulkGenerate, setShowBulkGenerate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const calls = [payslipsApi.mine().then((r) => setMyPayslips(r.data || []))];
    if (isHr) {
      calls.push(payslipsApi.all().then((r) => setAllPayslips(r.data || [])));
      calls.push(employeesApi.list().then((r) => setEmployees(r.data || [])));
    }
    Promise.all(calls).catch(() => toast.error("Failed to load payroll data")).finally(() => setLoading(false));
  }, [isHr]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async (form) => {
    setSaving(true);
    try {
      await payslipsApi.generate(form);
      toast.success("Payslip generated");
      setShowGenerate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate payslip");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkGenerate = async (form) => {
    setSaving(true);
    try {
      const res = await payslipsApi.generateBulk(form);
      toast.success(`Generated ${res.data.generated} payslip(s), skipped ${res.data.skipped}`);
      setShowBulkGenerate(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate payslips");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (p) => {
    try {
      await payslipsApi.markPaid(p._id);
      toast.success("Marked paid");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-cyan-700" /> Payroll
          </h1>
          <p className="text-sm text-slate-500 mt-1">Payslips and salary structure.</p>
        </div>
        {isHr && (
          <div className="flex gap-2">
            <button onClick={() => setShowBulkGenerate(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">
              <Users className="w-4 h-4" /> Generate for all
            </button>
            <button onClick={() => setShowGenerate(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
              <Plus className="w-4 h-4" /> Generate payslip
            </button>
          </div>
        )}
      </div>

      {isHr && (
        <div className="flex gap-2 mb-5">
          <button onClick={() => setTab("mine")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "mine" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            My Payslips
          </button>
          <button onClick={() => setTab("all")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "all" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            All Payslips
          </button>
          <button onClick={() => setTab("structures")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "structures" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            Salary Structures
          </button>
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
                  <tr>
                    <th className="text-left px-4 py-3">Period</th>
                    <th className="text-left px-4 py-3">Gross</th>
                    <th className="text-left px-4 py-3">Deductions</th>
                    <th className="text-left px-4 py-3">Net pay</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myPayslips.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">No payslips yet.</td></tr>
                  )}
                  {myPayslips.map((p) => (
                    <tr key={p._id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{MONTHS[p.month - 1]} {p.year}</td>
                      <td className="px-4 py-3">{money(p.grossEarnings)}</td>
                      <td className="px-4 py-3 text-red-600">−{money(p.totalDeductions)}</td>
                      <td className="px-4 py-3 font-semibold">{money(p.netPay)}</td>
                      <td className="px-4 py-3"><Badge status={p.status} /></td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => setViewing(p)} className="text-cyan-700 font-semibold hover:underline text-xs">View</button>
                        <button onClick={() => downloadPayslipPdf(p)} className="text-slate-500 font-semibold hover:underline text-xs">PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "all" && isHr && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Period</th>
                    <th className="text-left px-4 py-3">Net pay</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allPayslips.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No payslips generated yet.</td></tr>
                  )}
                  {allPayslips.map((p) => (
                    <tr key={p._id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{p.employee?.name}</td>
                      <td className="px-4 py-3">{MONTHS[p.month - 1]} {p.year}</td>
                      <td className="px-4 py-3">{money(p.netPay)}</td>
                      <td className="px-4 py-3"><Badge status={p.status} /></td>
                      <td className="px-4 py-3 flex gap-3">
                        <button onClick={() => setViewing(p)} className="text-cyan-700 font-semibold hover:underline text-xs">View</button>
                        <button onClick={() => downloadPayslipPdf(p)} className="text-slate-500 font-semibold hover:underline text-xs">PDF</button>
                        {p.status === "generated" && (
                          <button onClick={() => handleMarkPaid(p)} className="text-emerald-700 font-semibold hover:underline text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "structures" && isHr && (
            employees.length === 0
              ? <p className="text-sm text-slate-400 italic">No employees found.</p>
              : <SalaryStructureEditor employees={employees} />
          )}
        </>
      )}

      {viewing && <PayslipDetailModal payslip={viewing} onClose={() => setViewing(null)} />}
      {showGenerate && (
        <GeneratePayslipModal employees={employees} saving={saving} onClose={() => setShowGenerate(false)} onSubmit={handleGenerate} />
      )}
      {showBulkGenerate && (
        <BulkGenerateModal saving={saving} onClose={() => setShowBulkGenerate(false)} onSubmit={handleBulkGenerate} />
      )}
    </main>
  );
}
