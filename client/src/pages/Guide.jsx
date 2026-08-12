import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icons from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { isSuperAdmin } from "../utils/hrmsrolecheck";

const SECTIONS = [
  {
    key: "hub",
    title: "Hub",
    icon: "Sparkle",
    accent: "blue",
    steps: [
      "The Hub is your landing page after login — each tile is a workspace (FlowTrack, Time Flow, PMS, LMS, VMS, HRMS).",
      "Click a tile to open that workspace. A grayed-out tile marked \"No Access\" means an admin hasn't granted you that module yet — contact your administrator.",
      "Your name, email and initials appear top-right; use Sign out to log out of ItrOne.",
      "Super admins see an extra Access Grants button top-right for controlling who can manage access across every module.",
    ],
  },
  {
    key: "flowtrack",
    title: "FlowTrack",
    icon: "Zap",
    accent: "indigo",
    steps: [
      "Plan and track work across Projects, Sprints, Tasks and Bugs.",
      "What you land on depends on your role: Admins, PMs, Developers, QA and Business users each get a dashboard tailored to their work.",
      "Open a project to see its sprints; open a sprint to see its tasks and bugs.",
      "Use this space for day-to-day delivery tracking rather than for HR or timesheet items.",
    ],
  },
  {
    key: "timesheet",
    title: "Time Flow (Timesheet)",
    icon: "Clock",
    accent: "emerald",
    steps: [
      "Log hours against a project, submit the week for approval, and track past submissions under History.",
      "Managers and HR get Review, Team Status, Manage and Reports tabs to approve timesheets and manage projects/employees.",
      "Time Flow has its own detailed, searchable guide with a full walkthrough of every screen.",
    ],
    link: { label: "Open the Time Flow guide", to: "/timesheet/guide" },
  },
  {
    key: "pms",
    title: "PMS",
    icon: "Target",
    accent: "violet",
    steps: [
      "Manage performance cycles, KRAs (goals) and reviews.",
      "Fill in your KRAs/templates when a cycle is open, and submit self-reviews when requested.",
      "Managers and HR use this space to run review cycles, assign templates and view submission reports.",
    ],
  },
  {
    key: "lms",
    title: "LMS",
    icon: "Book",
    accent: "amber",
    steps: [
      "Browse the course catalog and enroll in courses relevant to your role.",
      "Track progress and certifications from My Learning.",
      "Admins/HR can build courses, assign them to employees, and review completion reports from the Manage area.",
    ],
  },
  {
    key: "vms",
    title: "VMS",
    icon: "UserPlus",
    accent: "rose",
    steps: [
      "Used to manage visitors — check-ins/check-outs, appointments and badges.",
      "Hosts see and manage visitors coming to see them from the Host dashboard.",
      "Admins get an Admin panel covering every visitor and an audit trail.",
    ],
  },
  {
    key: "hrms",
    title: "HRMS",
    icon: "Briefcase",
    accent: "cyan",
    steps: [
      "Central place for employee records, job openings and referrals.",
      "Your own profile and, if you manage people, your direct reports appear under My Team.",
      "HR/admins use Manage to control roles and module access per employee, and Jobs/Referrals to run hiring.",
    ],
  },
];

const FAQ = [
  { q: "How do I get back to the Hub from a workspace?", a: "Every workspace has a \"Back\" link in its header/sidebar that returns you to the Hub, where you can pick a different workspace." },
  { q: "A tile on the Hub says \"No Access\" — what do I do?", a: "It means you haven't been granted that module yet. Ask your manager or a super admin to grant access (via Access Grants or the module's own Manage Access page)." },
  { q: "Who can grant access to modules?", a: "Only super admins can decide who is allowed to manage access at all (via Access Grants on the Hub). From there, whoever is granted a module can manage roles/access within that module." },
  { q: "Where do I log my hours?", a: "Open the Time Flow tile from the Hub, then use the Timesheet tab. See the dedicated Time Flow guide for a full walkthrough." },
];

const ACCENTS = {
  blue: { chip: "bg-blue-50 text-blue-600", ring: "border-blue-200" },
  indigo: { chip: "bg-indigo-50 text-indigo-600", ring: "border-indigo-200" },
  emerald: { chip: "bg-emerald-50 text-emerald-600", ring: "border-emerald-200" },
  violet: { chip: "bg-violet-50 text-violet-600", ring: "border-violet-200" },
  amber: { chip: "bg-amber-50 text-amber-600", ring: "border-amber-200" },
  rose: { chip: "bg-rose-50 text-rose-600", ring: "border-rose-200" },
  cyan: { chip: "bg-cyan-50 text-cyan-600", ring: "border-cyan-200" },
};

export default function Guide() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState("guides");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(new Set(["hub"]));

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate("/hub")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <Icons.Back /> Back to Hub
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <Icons.Help />
              </div>
              <div>
                <h1 className="font-bold text-slate-900">Help Guide</h1>
                <p className="text-xs text-slate-500">Hi {user?.name?.split(" ")[0] || "there"} · How each workspace works</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode("guides")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === "guides" ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"}`}
              >
                <Icons.Book /> Guides
              </button>
              <button
                onClick={() => setMode("faq")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === "faq" ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"}`}
              >
                <Icons.Help /> FAQ
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
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            {mode === "guides" ? (
              <div className="space-y-3">
                {filteredSections.map((s) => {
                  const a = ACCENTS[s.accent];
                  const Icon = Icons[s.icon];
                  return (
                    <div key={s.key} className={`rounded-xl border overflow-hidden transition-colors ${open.has(s.key) ? a.ring : "border-slate-200"}`}>
                      <button onClick={() => toggle(s.key)} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition">
                        <span className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${a.chip}`}>{Icon ? <Icon /> : null}</span>
                          <span className="font-semibold text-slate-800">{s.title}</span>
                        </span>
                        <span className={`text-slate-400 transition-transform duration-200 ${open.has(s.key) ? "rotate-180" : ""}`}>
                          <Icons.ChevronDown />
                        </span>
                      </button>
                      {open.has(s.key) && (
                        <div className="px-5 pb-4 bg-slate-50/40 pt-3">
                          <ul className="space-y-1.5 list-disc list-inside text-sm text-slate-600">
                            {s.steps.map((st, idx) => (
                              <li key={idx}>{st}</li>
                            ))}
                          </ul>
                          {s.link && (
                            <button
                              onClick={() => navigate(s.link.to)}
                              className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
                            >
                              {s.link.label} →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFaq.map((f, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-semibold text-slate-800 text-sm mb-1">{f.q}</p>
                    <p className="text-sm text-slate-500">{f.a}</p>
                  </div>
                ))}
                {isSuperAdmin(user) && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                    <p className="font-semibold text-indigo-800 text-sm mb-1">As a super admin, where do I control who can grant access?</p>
                    <p className="text-sm text-indigo-700">Use the Access Grants button on the Hub — it's the top-level control for who can manage access to each module.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
