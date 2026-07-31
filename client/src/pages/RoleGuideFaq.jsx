import React, { useEffect, useMemo, useRef, useState } from "react";
import { submitUserIssue, getUserIssuesForAdmin } from "../services/api";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { getRoleKeyFromUser } from "../data/roleSettingsConfig";
import { ROLE_GUIDE_FAQ } from "../data/roleGuideFaq";
import RoleGuideFaqTabs from "./RoleGuideFaqTabs";

// ── Role accent tokens
const ROLE_ACCENTS = {
  ADMIN: {
    chip: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    soft: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
    num: "bg-red-600",
    ring: "ring-red-200",
    line: "bg-red-100",
    tab: "bg-red-600",
  },
  PM: {
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    soft: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
    num: "bg-blue-600",
    ring: "ring-blue-200",
    line: "bg-blue-100",
    tab: "bg-blue-600",
  },
  DEVELOPER: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    soft: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-200",
    num: "bg-emerald-600",
    ring: "ring-emerald-200",
    line: "bg-emerald-100",
    tab: "bg-emerald-600",
  },
  QA: {
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
    soft: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-200",
    num: "bg-purple-600",
    ring: "ring-purple-200",
    line: "bg-purple-100",
    tab: "bg-purple-600",
  },
  BUSINESS_USER: {
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    soft: "bg-rose-50",
    text: "text-rose-600",
    border: "border-rose-200",
    num: "bg-rose-600",
    ring: "ring-rose-200",
    line: "bg-rose-100",
    tab: "bg-rose-600",
  },
  DEFAULT: {
    chip: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    soft: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    num: "bg-slate-700",
    ring: "ring-slate-200",
    line: "bg-slate-200",
    tab: "bg-slate-700",
  },
};

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange, accent }) {
  return (
    <div className="flex items-center gap-1 border border-slate-200 rounded-lg bg-slate-50 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap transition-all ${
            active === t.id
              ? `${accent.tab} text-white shadow-sm`
              : "text-slate-500 hover:text-slate-700 hover:bg-white"
          }`}
        >
          {t.label}
          {t.count > 0 && (
            <span
              className={`ml-1 text-[10px] font-normal ${active === t.id ? "text-white/70" : "text-slate-400"}`}
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
      className={`rounded-xl border bg-white transition-all ${open ? `${accent.border} ring-1 ${accent.ring}` : "border-slate-200 hover:border-slate-300"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${open ? `${accent.soft} ${accent.text}` : "bg-slate-100 text-slate-400"}`}
          >
            Q
          </span>
          <span className="text-[13px] font-semibold text-slate-800 leading-snug">
            {q}
          </span>
        </span>
        <span
          className={`shrink-0 mt-0.5 transition-transform duration-200 ${open ? `rotate-180 ${accent.text}` : "text-slate-400"}`}
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
        className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
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
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full ${accent.num} text-white text-[11px] font-bold`}
        >
          {index + 1}
        </div>
        {!isLast && <div className={`w-px flex-1 ${accent.line} my-1`} />}
      </div>
      <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 transition-colors">
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
    <div className="flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 px-4">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-[13px] font-semibold text-slate-600">{title}</p>
      <p className="text-[12px] text-slate-400 mt-1 max-w-xs leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
}

// ── Issue Modal ───────────────────────────────────────────────────────────────
function IssueModal({ user, onClose, accent }) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDesc, setIssueDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submittedIssuesCount, setSubmittedIssuesCount] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!issueTitle.trim()) {
      setError("Issue title is required.");
      return;
    }
    if (!issueDesc.trim()) {
      setError("Description is required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitUserIssue({ title: issueTitle, description: issueDesc });
      setSubmitted(true);
      toast.success("Issue submitted. Admin will review it shortly.");
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to submit. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  useEffect(() => {
    if (user?.role?.toUpperCase() !== "ADMIN") return;

    const loadIssueCount = async () => {
      try {
        const res = await getUserIssuesForAdmin();

        const issues = res?.data?.data || res?.data || [];

        setSubmittedIssuesCount(Array.isArray(issues) ? issues.length : 0);
      } catch (err) {
        console.error("Failed to load issue count:", err);
      }
    };

    loadIssueCount();
  }, [user]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md sm:max-w-lg lg:max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Accent strip */}
        <div className={`h-1 w-full ${accent.num}`} />

        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg ${accent.num} flex items-center justify-center shrink-0`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] sm:text-[13.5px] font-bold text-slate-900">
                Report an Issue
              </p>
              <p className="text-[11px] text-slate-400">
                Submitted to admin for review
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {" "}
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          {/* Auto-filled fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Name — read only */}
            <div>
              <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Your Name
              </label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-100 bg-slate-50">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </div>
                <span className="text-[12.5px] font-semibold text-slate-600 truncate">
                  {user?.name || "—"}
                </span>
              </div>
            </div>

            {/* Date — read only */}
            <div>
              <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Date
              </label>
              <div className="h-9 px-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="text-[11.5px] text-slate-500 truncate">
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
          {/* Role — read only */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <div className="h-9 px-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${accent.chip}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                {(user?.role || "User").replace(/_/g, " ")}
              </span>
            </div>
          </div>
          {/* Issue title */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Issue Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              disabled={submitting || submitted}
              maxLength={120}
              placeholder="Brief summary of your issue"
              className="w-full h-9 border border-slate-200 bg-white px-3 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
            />
            <div className="text-right text-[10px] text-slate-400 mt-0.5">
              {issueTitle.length}/120
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              disabled={submitting || submitted}
              placeholder="Describe your issue in detail — steps to reproduce, what you expected vs what happened…"
              className="w-full resize-none border border-slate-200 bg-white px-3 py-2 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
            />
            <div className="text-right text-[10px] text-slate-400 mt-0.5">
              {issueDesc.length}/2000
            </div>
          </div>
          {/* Success */}
          {submitted && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-[12.5px] text-emerald-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Issue submitted! Admin will review it shortly.
            </div>
          )}
          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || submitted}
              className="h-9 px-5 rounded-lg bg-blue-700 text-white text-[13px] font-semibold hover:bg-blue-800 transition flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-r-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : submitted ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Submitted
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Submit Issue
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RoleGuideFaq({ initialTab = "guide" }) {
  const { user } = useAuth();
  const roleKey = useMemo(() => getRoleKeyFromUser(user), [user]);
  const content = roleKey ? ROLE_GUIDE_FAQ[roleKey] : null;
  const accent = ROLE_ACCENTS[roleKey] || ROLE_ACCENTS.DEFAULT;

  const guide = content?.guide || [];
  const faq = content?.faq || [];

  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [showIssueModal, setShowIssueModal] = useState(false);

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? faq.filter(
          (i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q),
        )
      : faq;
  }, [faq, query]);

  const roleLabel = roleKey
    ? roleKey
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Unknown";

  return (
    <div className="w-full max-w-8xl mx-auto px-3 sm:px-4 lg:px-0">
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {" "}
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl ${accent.num} flex items-center justify-center shrink-0`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-[17px] h-[17px] text-white"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M9.5 9.3a2.5 2.5 0 1 1 3.7 2.2c-.7.4-1.2.9-1.2 1.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="16.7" r="0.9" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-slate-900 leading-tight">
                Guide &amp; FAQ
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${accent.chip}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                  {roleLabel}
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Role-specific documentation
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <TabBar
              tabs={[
                { id: "guide", label: "Guide", count: guide.length },
                { id: "faq", label: "FAQ", count: faq.length },
                ...(user?.role?.toString()?.toUpperCase?.() === "ADMIN"
                  ? [{ id: "submitted", label: "Submitted Issues", count: 0 }]
                  : []),
              ]}
              active={tab}
              onChange={(t) => {
                setTab(t);
                setQuery("");
              }}
              accent={accent}
            />
            {user?.role?.toUpperCase() !== "ADMIN" && (
              <button
                type="button"
                onClick={() => setShowIssueModal(true)}
                className="
      h-10 px-4 rounded-xl
      bg-gradient-to-r from-orange-500 via-red-500 to-pink-500
      text-white text-[12.5px] font-semibold
      flex items-center gap-2
      shadow-md shadow-orange-200
      hover:scale-[1.02]
      hover:shadow-lg hover:shadow-orange-300
      transition-all duration-200
      animate-pulse
    "
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Report Issue
                <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-bold uppercase">
                  New
                </span>
              </button>
            )}
          </div>
        </div>
        {/* ── Body ── */}
        <div className="p-5 sm:p-6">
          {/* Admin Submitted Issues tab */}
          {tab === "submitted" &&
            user?.role?.toString()?.toUpperCase?.() === "ADMIN" && (
              <RoleGuideFaqTabs initialTab="submitted" />
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
                <div>
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
                  <div className="relative w-full sm:w-56">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="w-3.5 h-3.5"
                      >
                        <circle
                          cx="11"
                          cy="11"
                          r="6.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                        <path
                          d="m20 20-3.5-3.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search questions…"
                      className={`w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-[12.5px] text-slate-700 placeholder-slate-400 outline-none transition focus:bg-white focus:border-slate-300 focus:ring-2 ${accent.ring}`}
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
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

      {/* ── Issue modal ── */}
      {showIssueModal && (
        <IssueModal
          user={user}
          accent={accent}
          onClose={() => setShowIssueModal(false)}
        />
      )}
    </div>
  );
}
