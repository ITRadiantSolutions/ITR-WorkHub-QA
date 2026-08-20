import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Receipt, Plus, X, Check, XCircle, Paperclip, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { expensesApi } from "../hrmsApi";

const CATEGORY_LABELS = {
  travel: "Travel",
  food: "Food",
  accommodation: "Accommodation",
  office_supplies: "Office Supplies",
  internet: "Internet",
  other: "Other",
};

const STATUS_TONE = {
  submitted: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-700",
  reimbursed: "bg-emerald-50 text-emerald-700",
};

const Badge = ({ status }) => (
  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_TONE[status] || "bg-slate-100 text-slate-600"}`}>
    {status}
  </span>
);

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const money = (n) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SubmitExpenseModal({ onClose, onSubmit, saving }) {
  const [form, setForm] = useState({ category: "travel", amount: "", expenseDate: "", description: "" });
  const [bill, setBill] = useState(null);
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const valid = form.category && Number(form.amount) > 0 && form.expenseDate;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Submit an expense</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.category} onChange={set("category")}>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" min="0.01" step="0.01" placeholder="Amount" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.amount} onChange={set("amount")} />
          <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.expenseDate} onChange={set("expenseDate")} />
        </div>
        <textarea placeholder="Description (optional)" rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.description} onChange={set("description")} />
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <Paperclip className="w-4 h-4" />
          <span>{bill ? bill.name : "Attach bill (optional)"}</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setBill(e.target.files?.[0] || null)} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button
            disabled={saving || !valid}
            onClick={() => onSubmit(form, bill)}
            className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ expense, onClose, onReview }) {
  const [comment, setComment] = useState("");
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{expense.employee?.name}'s expense</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-slate-600">
          <span className="font-semibold">{CATEGORY_LABELS[expense.category]}</span> · {money(expense.amount)} · {fmtDate(expense.expenseDate)}
        </p>
        {expense.description && <p className="text-sm text-slate-500">{expense.description}</p>}

        {showReject ? (
          <div className="space-y-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason for rejection" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReject(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Back</button>
              <button onClick={() => onReview("reject", comment)} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">Confirm reject</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowReject(true)} className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button onClick={() => onReview("approve", "")} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseTable({ rows, showEmployee, isHr, onReview, onReimburse, onViewBill }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {showEmployee && <th className="text-left px-4 py-3">Employee</th>}
            <th className="text-left px-4 py-3">Category</th>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Amount</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr><td colSpan={showEmployee ? 6 : 5} className="px-4 py-8 text-center text-slate-400 italic">Nothing here yet.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r._id}>
              {showEmployee && <td className="px-4 py-3 font-semibold text-slate-800">{r.employee?.name}</td>}
              <td className="px-4 py-3">{CATEGORY_LABELS[r.category] || r.category}</td>
              <td className="px-4 py-3 text-slate-600">{fmtDate(r.expenseDate)}</td>
              <td className="px-4 py-3">{money(r.amount)}</td>
              <td className="px-4 py-3"><Badge status={r.status} /></td>
              <td className="px-4 py-3 flex gap-3">
                {r.billBlobName && (
                  <button onClick={() => onViewBill(r)} className="text-slate-500 font-semibold hover:underline text-xs">Bill</button>
                )}
                {onReview && r.status === "submitted" && (
                  <button onClick={() => onReview(r)} className="text-cyan-700 font-semibold hover:underline text-xs">Review</button>
                )}
                {isHr && onReimburse && r.status === "approved" && (
                  <button onClick={() => onReimburse(r)} className="text-emerald-700 font-semibold hover:underline text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Reimburse
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Expenses() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";
  const isManager = user?.roles?.hrms === "manager";

  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState([]);
  const [team, setTeam] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [saving, setSaving] = useState(false);

  const tabs = useMemo(() => [
    { key: "mine", label: "My Expenses" },
    ...(isManager ? [{ key: "team", label: "Team" }] : []),
    ...(isHr ? [{ key: "all", label: "All Expenses" }] : []),
  ], [isManager, isHr]);

  const load = useCallback(() => {
    setLoading(true);
    const calls = [expensesApi.mine().then((r) => setMine(r.data || []))];
    if (isManager) calls.push(expensesApi.team().then((r) => setTeam(r.data || [])));
    if (isHr) calls.push(expensesApi.all().then((r) => setAll(r.data || [])));
    Promise.all(calls).catch(() => toast.error("Failed to load expenses")).finally(() => setLoading(false));
  }, [isManager, isHr]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (form, bill) => {
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      if (bill) data.append("bill", bill);
      await expensesApi.create(data);
      toast.success("Expense submitted");
      setShowSubmit(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit expense");
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (action, comment) => {
    try {
      await expensesApi.review(reviewing._id, action, comment);
      toast.success(`Expense ${action}d`);
      setReviewing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to review expense");
    }
  };

  const handleReimburse = async (r) => {
    try {
      await expensesApi.reimburse(r._id);
      toast.success("Marked reimbursed");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    }
  };

  const handleViewBill = async (r) => {
    try {
      const res = await expensesApi.billUrl(r._id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to open bill");
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-cyan-700" /> Expenses
          </h1>
          <p className="text-sm text-slate-500 mt-1">Submit claims and track reimbursement.</p>
        </div>
        <button onClick={() => setShowSubmit(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow">
          <Plus className="w-4 h-4" /> Submit expense
        </button>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-2 mb-5">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === t.key ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          {tab === "mine" && <ExpenseTable rows={mine} showEmployee={false} isHr={isHr} onViewBill={handleViewBill} />}
          {tab === "team" && <ExpenseTable rows={team} showEmployee isHr={isHr} onReview={setReviewing} onViewBill={handleViewBill} />}
          {tab === "all" && <ExpenseTable rows={all} showEmployee isHr={isHr} onReview={setReviewing} onReimburse={handleReimburse} onViewBill={handleViewBill} />}
        </>
      )}

      {showSubmit && <SubmitExpenseModal saving={saving} onClose={() => setShowSubmit(false)} onSubmit={handleSubmit} />}
      {reviewing && <ReviewModal expense={reviewing} onClose={() => setReviewing(null)} onReview={handleReview} />}
    </main>
  );
}
