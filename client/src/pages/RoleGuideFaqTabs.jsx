import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getRoleKeyFromUser } from "../data/roleSettingsConfig";
import { ROLE_GUIDE_FAQ } from "../data/roleGuideFaq";
import { getUserIssuesForAdmin } from "../services/api";
import { toast } from "sonner";

// ── Role accent tokens — one consistent FlowTrack indigo theme for every
// role, rather than a different accent color per role.
const INDIGO_ACCENT = {
  chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
  dot: "bg-indigo-600",
  soft: "bg-indigo-50",
  text: "text-indigo-600",
  border: "border-indigo-200",
  num: "bg-indigo-600",
  ring: "ring-indigo-200",
  line: "bg-indigo-100",
  tab: "bg-indigo-600",
};
const ROLE_ACCENTS = {
  ADMIN: INDIGO_ACCENT,
  PM: INDIGO_ACCENT,
  DEVELOPER: INDIGO_ACCENT,
  QA: INDIGO_ACCENT,
  BUSINESS_USER: INDIGO_ACCENT,
  DEFAULT: INDIGO_ACCENT,
};

// ── Sliding pill tab bar ──────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange, accent }) {
  const refs = useRef({});
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = refs.current[active];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, tabs]);

  return (
    <div className="relative inline-flex items-center bg-slate-100 rounded-xl p-1 gap-0.5 border border-slate-200">
      {/* sliding pill */}
      <span
        className={`absolute top-1 bottom-1 rounded-lg ${accent.tab} transition-all duration-250 ease-out`}
        style={{ left: pill.left, width: pill.width }}
      />
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => (refs.current[t.id] = el)}
          onClick={() => onChange(t.id)}
          className={`relative z-10 px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${
            active === t.id
              ? "text-white"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
          {t.count > 0 && (
            <span
              className={`ml-1 font-normal ${active === t.id ? "text-white/70" : "text-slate-400"}`}
            >
              ({t.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Accordion FAQ item ────────────────────────────────────────────────────────
function AccordionItem({ q, a, defaultOpen = false, accent }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-xl border bg-white transition-all duration-200 ${
        open
          ? `${accent.border} ring-1 ${accent.ring}`
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start sm:items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-start sm:items-center gap-2.5">
          <span
            className={`mt-0.5 sm:mt-0 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-200 ${
              open
                ? `${accent.soft} ${accent.text}`
                : "bg-slate-100 text-slate-400"
            }`}
          >
            Q
          </span>
          <span className="text-[13px] font-semibold text-slate-800 leading-snug">
            {q}
          </span>
        </span>
        <span
          className={`shrink-0 mt-0.5 sm:mt-0 transition-transform duration-200 ${
            open ? `rotate-180 ${accent.text}` : "text-slate-400"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-4 pl-11 text-[13px] text-slate-500 leading-relaxed">
            {a}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Guide step ────────────────────────────────────────────────────────────────
function GuideStep({ index, total, title, content, accent }) {
  const isLast = index === total - 1;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full ${accent.num} text-white text-[11px] font-bold`}
        >
          {index + 1}
        </div>
        {!isLast && <div className={`w-px flex-1 ${accent.line} my-1`} />}
      </div>

      <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 transition-colors duration-150">
          <p className="text-[13px] font-semibold text-slate-800 leading-snug">
            {title}
          </p>
          <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-10 px-4">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
}

// ── Search icon ───────────────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RoleGuideFaqTabs({ initialTab = "guide" }) {
  const { user } = useAuth();
  const roleKey = useMemo(() => getRoleKeyFromUser(user), [user]);
  const roleContent = roleKey ? ROLE_GUIDE_FAQ[roleKey] : null;
  const accent = ROLE_ACCENTS[roleKey] || ROLE_ACCENTS.DEFAULT;

  const guide = roleContent?.guide || [];
  const faq = roleContent?.faq || [];

  const tab = initialTab;
  const [query, setQuery] = useState("");

  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    const isAdmin = user?.role?.toString()?.toUpperCase?.() === "ADMIN";
    if (!isAdmin) return;
    if (tab !== "submitted") return;

    // Fetch once per mount/tab open to avoid looping.
    // (We only fetch if issues are still empty and we're not already loading.)
    if (issues.length !== 0) return;
    if (issuesLoading) return;

    let cancelled = false;
    setIssuesLoading(true);

    getUserIssuesForAdmin()
      .then((res) => {
        if (cancelled) return;
        setIssues(res?.data?.data || res?.data || []);
      })
      .catch((e) => {
        if (cancelled) return;
        // Surface API error clearly for easier debugging
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.data?.message ||
          e?.message ||
          "Failed to load submitted issues for admin";
        toast.error(msg);
        console.error("getUserIssuesForAdmin failed:", e);
      })
      .finally(() => {
        if (cancelled) return;
        setIssuesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, user?.role]);

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? faq.filter(
          (i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q),
        )
      : faq;
  }, [faq, query]);

  return (
    <div className="w-full max-w-8xl mx-auto px-3 sm:px-4 lg:px-0">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* ── Body ── */}
        <div className="p-4 sm:p-6">
          {/* Admin Submitted Issues tab */}
          {tab === "submitted" &&
            user?.role?.toString()?.toUpperCase?.() === "ADMIN" && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-bold text-slate-700">
                    Submitted Issues
                  </p>
                  <div className="text-[11px] text-slate-400">
                    All submitted issues
                  </div>
                </div>

                {issuesLoading && issues.length === 0 ? (
                  <EmptyState
                    title="Loading..."
                    subtitle="Fetching submitted issues."
                  />
                ) : issues?.length === 0 ? (
                  <EmptyState
                    title="No submitted issues"
                    subtitle="No users have submitted issues yet."
                  />
                ) : (
                  <div className="space-y-2">
                    {issues.map((it) => (
                      <div
                        key={it._id}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-800 truncate">
                              {it.message || "(No message)"}
                            </p>
                            <p className="text-[11.5px] text-slate-500 mt-1">
                              Submitted by:{" "}
                              {it.submittedBy?.name ||
                                it.submittedBy?.email ||
                                "Unknown"}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {it.createdAt
                                ? new Date(it.createdAt).toLocaleString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                : ""}
                            </p>
                          </div>
                          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border border-slate-200 bg-slate-50 text-slate-600">
                            {it.status || "OPEN"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

          {/* Guide tab */}
          {tab === "guide" && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-bold text-slate-700">
                  How it works for you
                </p>
                {guide.length > 0 && (
                  <span className="text-[11px] text-slate-400">
                    {guide.length} steps
                  </span>
                )}
              </div>

              {guide.length === 0 ? (
                <EmptyState
                  title="No guide yet"
                  subtitle="A step-by-step guide for this role hasn't been added yet."
                />
              ) : (
                <div className="max-w-8xl">
                  {guide.map((item, idx) => (
                    <GuideStep
                      key={idx}
                      index={idx}
                      total={guide.length}
                      title={item.title}
                      content={item.content}
                      accent={accent}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* FAQ tab */}
          {tab === "faq" && (
            <section>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <p className="text-[13px] font-bold text-slate-700">
                  Frequently asked questions
                  {faq.length > 0 && (
                    <span className="ml-1.5 font-normal text-slate-400">
                      ({faq.length})
                    </span>
                  )}
                </p>

                {faq.length > 0 && (
                  <div className="relative w-full sm:w-52">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <SearchIcon />
                    </span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search questions…"
                      className={`w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 outline-none transition-all duration-150 focus:bg-white focus:border-slate-300 focus:ring-2 ${accent.ring}`}
                    />
                  </div>
                )}
              </div>

              {faq.length === 0 ? (
                <EmptyState
                  title="No FAQ yet"
                  subtitle="Frequently asked questions for this role haven't been added yet."
                />
              ) : filteredFaq.length === 0 ? (
                <EmptyState
                  title="No matches"
                  subtitle={`Nothing found for "${query}". Try a different term.`}
                />
              ) : (
                <div className="space-y-2">
                  {filteredFaq.map((item, idx) => (
                    <AccordionItem
                      key={idx}
                      q={item.q}
                      a={item.a}
                      defaultOpen={idx === 0 && !query}
                      accent={accent}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
