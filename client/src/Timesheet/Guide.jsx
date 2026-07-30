import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icons from "../components/Icons";

const SECTIONS = [
  {
    key: "dashboard",
    title: "Dashboard",
    steps: [
      "Pick a period (This Week, Last Week, This Month...) from the dropdown.",
      "Activity Distribution shows what share of your logged hours went to your top project vs. everything else.",
      "Hours Logged charts your total hours per project for the selected period.",
      "The Pending and Approved pills show how many of your submitted timesheets are in each state.",
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
      "Add a row with the + button for another project; remove one with the trash icon.",
      "Use Comment for anything the approver should know about that row.",
      "Select a project in the top-right, press Start to run a live timer, and Pause to add the elapsed time to today.",
      "Save Timesheet keeps your entries as a draft you can keep editing.",
      "Submit sends the week to your manager for approval — it locks the week until they act on it.",
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
];

const FAQ = [
  { q: "Can I edit a timesheet after submitting it?", a: "Not directly — once submitted it's locked for your manager to review. If they request changes, it moves to Modifications and becomes editable again." },
  { q: "What happens if I forget to log a day?", a: "You can still Save Timesheet with some days left blank — just make sure the week has at least one entry before saving." },
  { q: "Does the timer save automatically?", a: "Pressing Pause adds the elapsed time to today's cell for the selected project, but you still need to Save (and Submit) the timesheet for it to be recorded." },
];

export default function Guide() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("guides");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(new Set());

  const toggle = (key) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({ ...s, steps: s.steps.filter((st) => st.toLowerCase().includes(q)) })).filter(
      (s) => s.title.toLowerCase().includes(q) || s.steps.length,
    );
  }, [query]);

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ;
    return FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="w-[90%] max-w-[1100px] mx-auto px-2 py-8">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Icons.Book />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Help Center</h2>
              <p className="text-xs text-slate-500">TimeFlow · {SECTIONS.length} sections</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("guides")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === "guides" ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"}`}
            >
              <Icons.Book /> Guides
            </button>
            <button
              onClick={() => setMode("faq")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === "faq" ? "bg-indigo-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"}`}
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
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>

          {mode === "guides" ? (
            <div className="space-y-3">
              {filteredSections.map((s, i) => (
                <div key={s.key} className={`rounded-xl border overflow-hidden transition-colors ${open.has(s.key) ? "border-indigo-200" : "border-slate-200"}`}>
                  <button onClick={() => toggle(s.key)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition">
                    <span className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
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
            <div className="space-y-3">
              {filteredFaq.map((f, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-800 text-sm mb-1">{f.q}</p>
                  <p className="text-sm text-slate-500">{f.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
          <span>Updated with each release · Contact HR for issues</span>
          <button onClick={() => window.print()} className="text-indigo-600 font-semibold">Export PDF</button>
        </div>
      </div>
    </div>
  );
}
