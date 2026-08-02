import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Icons from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { API } from "../services/api";

const BASE_SECTIONS = [
  {
    key: "dashboard",
    title: "Dashboard",
    steps: [
      "Pick a period (This Week, Last Week, This Month...) from the dropdown.",
      "Activity Distribution shows what share of your logged hours went to your top project vs. everything else.",
      "Hours Logged charts your total hours per project for the selected period.",
      "The Pending and Approved pills show how many of your submitted timesheets are in each state.",
      "Managers and HR also get an employee search box to view a specific report's data, and a Team Timesheet Status panel showing who's submitted for the week/month.",
      "Use the top nav to jump into Timesheet, History or this Guide at any time.",
    ],
  },
  {
    key: "timesheet",
    title: "Timesheet",
    steps: [
      "Use the arrows or date field to move between weeks.",
      "Pick a project on a row, then enter hours under each day.",
      "Check \"Applicable for NSA\" for a day if it should count as non-standard attendance.",
      "Add a row with the + button for another project; remove one with the trash icon — rows with logged hours ask for confirmation before removing.",
      "Use Comment for anything the approver should know about that row.",
      "Select a project in the top-right, press Start to run a live timer, and Pause to add the elapsed time to today. The timer survives a page reload and auto-stops (with a warning) after 8 hours on one day.",
      "The timer only runs for the current week and is blocked on company holidays.",
      "Save Timesheet keeps your entries as a draft you can keep editing.",
      "Submit sends the week to your manager for approval — it requires every weekday to have logged hours and locks the week until they act on it.",
      "If a week comes back as Needs Edit or Rejected, a reason field appears so you can explain your changes before resubmitting. Your edits are auto-saved locally so you won't lose them if you navigate away.",
    ],
  },
  {
    key: "history",
    title: "History",
    steps: [
      "Pending shows weeks you've submitted that are awaiting a decision.",
      "Approved and Rejected show weeks your manager has already acted on.",
      "Modifications shows weeks sent back to you to edit and resubmit.",
      "Press View on any week to see exactly what was submitted.",
      "A week sent back for modification is editable again from that view.",
    ],
  },
  {
    key: "review",
    title: "Review",
    managerOrHr: true,
    steps: [
      "The Review tab lists your direct reports' submitted timesheets awaiting a decision. The list auto-refreshes every minute.",
      "Expand a submission to see per-project hours and the employee's own row-by-row comments.",
      "If a previous reviewer left a note on this timesheet, it's shown as \"Previous reviewer note\".",
      "Approve accepts the week as-is.",
      "Reject or Request Changes (Needs Edit) open a reason dialog — you write a reason, then confirm it on a second screen before it's sent, so you can't fire off a rejection by mistake.",
    ],
  },
  {
    key: "manage",
    title: "Manage",
    managerOrHr: true,
    steps: [
      "The Teams tab lists your employees. Search by name/email, and use \"Show archived\" to view employees archived from Timesheet.",
      "Assign Shifts lets you pick one of the three fixed company shift slots for each employee.",
      "Add or modify an employee's project assignments individually from their card, or use Bulk Assign to add several employees to several projects at once.",
      "Archive from Timesheet removes an employee's access to this module without deleting their account; Restore access brings them back.",
      "The Projects tab creates and edits projects — a description and POC name/email/phone are required, and project names can't duplicate an existing one.",
    ],
  },
  {
    key: "reports",
    title: "Reports",
    managerOrHr: true,
    steps: [
      "Switch between the Employees and Projects views with the toggle.",
      "Filter by period (including a Custom date range) and, in the Employees view, by status.",
      "Click any employee row to open a drill-down with KPI cards, a project-hours breakdown, and a week-by-week detail table you can export to CSV.",
      "Click a project row to expand and see each team member's hours on that project.",
      "Export Excel downloads the whole current view; the download icon on a project row exports that project's weekly pivot report.",
      "Managers see this scoped to their own direct reports; HR sees every employee and project.",
    ],
  },
  {
    key: "nsa-report",
    title: "NSA Report",
    hrOnly: true,
    steps: [
      "Shows every approved timesheet that has at least one day flagged \"Applicable for NSA\", with a Mon–Fri breakdown and the approving manager's name.",
      "Filter by date range using the presets or custom dates, then export the filtered list to CSV.",
      "The trend chart above the table shows the distinct number of employees with an NSA day, month over month.",
    ],
  },
];

const DEFAULT_FAQ = [
  { q: "Can I edit a timesheet after submitting it?", a: "Not directly — once submitted it's locked for your manager to review. If they request changes, it moves to Modifications and becomes editable again." },
  { q: "What happens if I forget to log a day?", a: "Submit requires every weekday to have logged hours (unless it's a company holiday) — you'll get an error listing the missing days if you try to submit early." },
  { q: "Does the timer save automatically?", a: "Pressing Pause adds the elapsed time to today's cell for the selected project, but you still need to Save (and Submit) the timesheet for it to be recorded. The running timer itself is kept in your browser so it survives a reload." },
];

export default function Guide() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roleTs = user?.roles?.timesheet;
  const isHr = roleTs === "hr";
  const isManagerOrHr = ["manager", "hr"].includes(roleTs);

  const sections = useMemo(
    () => BASE_SECTIONS.filter((s) => (s.hrOnly ? isHr : s.managerOrHr ? isManagerOrHr : true)),
    [isHr, isManagerOrHr],
  );

  const [mode, setMode] = useState("guides");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(new Set());

  const [faqs, setFaqs] = useState([]);
  const [faqLoading, setFaqLoading] = useState(true);
  const [faqForm, setFaqForm] = useState({ question: "", answer: "" });
  const [savingFaq, setSavingFaq] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ question: "", answer: "" });

  const loadFaqs = () => {
    setFaqLoading(true);
    API.get("/timesheet-faqs")
      .then((res) => setFaqs(res.data || []))
      .catch(() => toast.error("Failed to load FAQ"))
      .finally(() => setFaqLoading(false));
  };

  useEffect(() => {
    loadFaqs();
  }, []);

  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.map((s) => ({ ...s, steps: s.steps.filter((st) => st.toLowerCase().includes(q)) })).filter(
      (s) => s.title.toLowerCase().includes(q) || s.steps.length,
    );
  }, [sections, query]);

  const displayFaq = faqs.length ? faqs.map((f) => ({ id: f._id, q: f.question, a: f.answer })) : DEFAULT_FAQ.map((f, i) => ({ id: `default-${i}`, ...f }));

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return displayFaq;
    return displayFaq.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [displayFaq, query]);

  const submitFaq = async (e) => {
    e.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return toast.error("Question and answer are required");
    setSavingFaq(true);
    try {
      await API.post("/timesheet-faqs", faqForm);
      setFaqForm({ question: "", answer: "" });
      toast.success("FAQ added");
      loadFaqs();
    } catch {
      toast.error("Failed to add FAQ");
    } finally {
      setSavingFaq(false);
    }
  };

  const startEdit = (f) => {
    setEditingId(f.id);
    setEditDraft({ question: f.q, answer: f.a });
  };

  const saveEdit = async (id) => {
    if (!editDraft.question.trim() || !editDraft.answer.trim()) return toast.error("Question and answer are required");
    try {
      await API.patch(`/timesheet-faqs/${id}`, editDraft);
      setEditingId(null);
      toast.success("FAQ updated");
      loadFaqs();
    } catch {
      toast.error("Failed to update FAQ");
    }
  };

  const deleteFaq = async (id) => {
    if (!window.confirm("Delete this FAQ entry?")) return;
    try {
      await API.delete(`/timesheet-faqs/${id}`);
      toast.success("FAQ deleted");
      loadFaqs();
    } catch {
      toast.error("Failed to delete FAQ");
    }
  };

  return (
    <div className="w-[90%] max-w-[1100px] mx-auto px-2 py-8">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Icons.Book />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Help Center</h2>
              <p className="text-xs text-slate-500">TimeFlow · {sections.length} sections</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("guides")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === "guides" ? "bg-teal-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"}`}
            >
              <Icons.Book /> Guides
            </button>
            <button
              onClick={() => setMode("faq")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === "faq" ? "bg-teal-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"}`}
            >
              <Icons.Help /> FAQ
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
              Print
            </button>
            <button onClick={() => navigate("/timesheet/dashboard")} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white transition">
              <Icons.X />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icons.Search /></span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guides and FAQ..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>

          {mode === "guides" ? (
            <div className="space-y-3">
              {filteredSections.map((s, i) => (
                <div key={s.key} className={`rounded-xl border overflow-hidden transition-colors ${open.has(s.key) ? "border-teal-200" : "border-slate-200"}`}>
                  <button onClick={() => toggle(s.key)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition">
                    <span className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="font-semibold text-slate-800">{s.title}</span>
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{s.steps.length} steps</span>
                    </span>
                    <span className={`text-slate-400 transition-transform duration-200 ${open.has(s.key) ? "rotate-180" : ""}`}>
                      <Icons.ChevronDown />
                    </span>
                  </button>
                  {open.has(s.key) && (
                    <ol className="px-5 pb-4 space-y-1.5 list-decimal list-inside text-sm text-slate-600 bg-slate-50/40 pt-3">
                      {s.steps.map((st, idx) => (
                        <li key={idx}>{st}</li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {isHr && (
                <form onSubmit={submitFaq} className="rounded-xl border border-slate-200 p-4 space-y-2 bg-slate-50/60">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Add FAQ</p>
                  <input
                    value={faqForm.question}
                    onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
                    placeholder="Question"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  />
                  <textarea
                    value={faqForm.answer}
                    onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
                    placeholder="Answer"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  />
                  <button
                    type="submit"
                    disabled={savingFaq}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                  >
                    {savingFaq ? "Adding..." : "Add FAQ"}
                  </button>
                </form>
              )}

              {faqLoading ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
              ) : (
                filteredFaq.map((f) => (
                  <div key={f.id} className="rounded-xl border border-slate-200 p-4">
                    {editingId === f.id ? (
                      <div className="space-y-2">
                        <input
                          value={editDraft.question}
                          onChange={(e) => setEditDraft((d) => ({ ...d, question: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold"
                        />
                        <textarea
                          value={editDraft.answer}
                          onChange={(e) => setEditDraft((d) => ({ ...d, answer: e.target.value }))}
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <button onClick={() => saveEdit(f.id)} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">
                            Save
                          </button>
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm mb-1">{f.q}</p>
                          <p className="text-sm text-slate-500">{f.a}</p>
                        </div>
                        {isHr && !String(f.id).startsWith("default-") && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => startEdit(f)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-slate-50" title="Edit">
                              <Icons.Edit />
                            </button>
                            <button onClick={() => deleteFaq(f.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-slate-50" title="Delete">
                              <Icons.Trash />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          <span>Updated with each release · Contact HR for issues</span>
          <button onClick={() => window.print()} className="text-teal-600 font-semibold">Export PDF</button>
        </div>
      </div>
    </div>
  );
}
