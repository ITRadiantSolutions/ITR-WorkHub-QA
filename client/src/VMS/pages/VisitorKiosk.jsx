import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VisitorForm from "../components/VisitorForm.jsx";
import OTPModal from "../components/OTPModal.jsx";
import { API } from "../../services/api.js";

const REDIRECT_SECS = 10;

function SuccessScreen({ visitor, onDone }) {
  const [count, setCount] = useState(REDIRECT_SECS);

  useEffect(() => {
    if (count <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = ((REDIRECT_SECS - count) / REDIRECT_SECS) * 100;
  const initials = (visitor?.fullName ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const details = [
    { label: "Full Name", value: visitor?.fullName },
    { label: "Host", value: visitor?.personToMeetId?.name || visitor?.personToMeet?.name || "Not Assigned" },
    { label: "Mobile", value: visitor?.mobileNumber },
    { label: "Purpose", value: visitor?.purpose },
    {
      label: "Registered",
      value: visitor?.createdAt
        ? new Date(visitor.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "Not Available",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-pink-600 to-pink-700" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,_#dbeafe_0%,_transparent_70%)]" />
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-rose-50/80 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-pink-50/60 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/60">
            <div className="relative bg-gradient-to-r from-pink-600 to-rose-500 px-6 pt-8 pb-16 text-center">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
              <div className="absolute -left-4 bottom-4 h-16 w-16 rounded-full bg-white/10" />
              <div className="relative z-10">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-2 ring-white/30">
                  <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-white">Verification Successful</h1>
                <p className="mt-1 text-sm text-white/70">Your visit has been registered</p>
              </div>
            </div>

            <div className="relative px-6">
              <div className="-mt-10 mb-5 flex justify-center">
                <div className="relative">
                  {visitor?.photoUrl ? (
                    <img src={visitor.photoUrl} alt={visitor.fullName} className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-lg" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-pink-500 to-rose-400 text-2xl font-semibold text-white shadow-lg">
                      {initials}
                    </div>
                  )}
                  <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-green-400 to-emerald-500 shadow">
                    <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="mb-5 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-xs font-semibold text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  OTP Verified · Pending Host Approval
                </span>
              </div>

              <div className="mb-5 divide-y divide-slate-50 rounded-xl border border-slate-100 bg-slate-50/60 overflow-hidden">
                {details.map((d) => (
                  <div key={d.label} className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 shrink-0">{d.label}</span>
                    <span className="truncate text-xs font-medium text-slate-700 text-right">{d.value ?? "—"}</span>
                  </div>
                ))}
              </div>

              <div className="mb-5 rounded-xl border border-pink-100 bg-pink-50/60 px-4 py-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-pink-500">What's next?</p>
                <div className="space-y-1.5">
                  {["Your host will receive an approval notification", "Wait in the reception area for confirmation", "You'll be notified once approved"].map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-pink-100 text-[9px] font-bold text-pink-600">{i + 1}</span>
                      <p className="text-xs text-pink-800">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Starting a new check-in…</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-pink-200 bg-white shadow-sm">
                    <span className="text-sm font-semibold text-pink-600">{count}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-600 transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="mb-6 flex gap-2">
                <button
                  onClick={onDone}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-[0.98]"
                >
                  New Check-In
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-pink-300 hover:text-pink-600 active:scale-[0.98]"
                >
                  Print
                </button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400">ITRadiant Visitor Portal · Secure • Fast • Contactless</p>
        </div>
      </div>
    </div>
  );
}

// Ported from the standalone VMS project's VisitorKiosk.jsx. This is a
// public page (no ItrOne login) meant to run full-screen on a reception
// tablet, so "Home" resets the kiosk to a fresh check-in instead of
// navigating into the logged-in app.
export default function VisitorKiosk() {
  const navigate = useNavigate();
  const [currentVisitor, setCurrentVisitor] = useState(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpMode, setOtpMode] = useState("self");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  const reset = () => {
    setCurrentVisitor(null);
    setOtpOpen(false);
    setVerified(false);
    setMessage("");
    setError("");
  };

  const handleSubmit = async (form) => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const { photoUrl, ...rest } = form;
      const { data } = await API.post("/vms/visitors/create", { ...rest, photoDataUrl: photoUrl });
      setCurrentVisitor(data.visitor);
      setOtpOpen(true);
      setMessage("OTP sent to your phone. Enter it to verify your visit.");
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (code) => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      if (otpMode === "self") {
        if (!currentVisitor) throw new Error("Missing visitor id");
        const visitorId = currentVisitor.id ?? currentVisitor._id;
        const { data } = await API.post("/vms/visitors/verify-otp", { visitorId, code });
        setCurrentVisitor(data.visitor);
      } else {
        const { data } = await API.post("/vms/visitors/verify-invited-otp", { code });
        setCurrentVisitor(data.visitor);
      }
      setOtpOpen(false);
      setVerified(true);
    } catch (err) {
      setError(err?.response?.data?.error || "OTP verification failed. Please try again.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (otpMode !== "self" || !currentVisitor) return;
    const visitorId = currentVisitor.id ?? currentVisitor._id;
    await API.post("/vms/visitors/resend-invited-otp", { visitorId });
  };

  if (verified) return <SuccessScreen visitor={currentVisitor} onDone={reset} />;

  return (
    <div className="relative min-h-screen bg-white">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-rose-500 via-pink-600 to-pink-800" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,_#dbeafe_0%,_transparent_70%)]" />
      <div className="pointer-events-none fixed right-0 top-0 h-80 w-80 rounded-full bg-rose-50/60 blur-3xl" />

      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M11 11a4 4 0 100-8 4 4 0 000 8zM21 19v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-800 tracking-wide">ITRadiant Visitor Portal</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            Live
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-3 pb-5 pt-1 sm:px-6">
        <div className="mb-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Visitor Check-In</h1>
              <p className="mt-1 text-sm text-slate-500">Register a new visitor or verify an invited visitor using OTP.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>

          <div className="mt-5">
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setOtpMode("self");
                  reset();
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${otpMode === "self" ? "bg-white text-pink-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
              >
                Self Visitor
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpMode("invited");
                  reset();
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${otpMode === "invited" ? "bg-white text-pink-600 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
              >
                Invited Visitor
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="mb-4 mt-4 flex items-start gap-3 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm">
            <p className="flex-1 text-xs font-medium text-green-700 leading-relaxed">{message}</p>
            <button onClick={() => setMessage("")} className="text-green-400 hover:text-green-600">
              ✕
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-white px-4 py-3 shadow-sm">
            <p className="flex-1 text-xs font-medium text-red-700 leading-relaxed">{error}</p>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
              ✕
            </button>
          </div>
        )}

        <div className="mt-4">
          {otpMode === "self" ? (
            <VisitorForm onSubmit={handleSubmit} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm">
              <div className="mb-3">
                <p className="text-sm font-semibold text-slate-800">Invited user</p>
                <p className="mt-1 text-xs text-slate-500">Enter the 6-digit code sent to the invited visitor.</p>
              </div>
              <button
                type="button"
                onClick={() => setOtpOpen(true)}
                className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-3 text-xs font-bold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-[0.98]"
              >
                Verify Invited OTP
              </button>
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-medium text-slate-500">Note: Code is valid only for today (visit date).</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-500">Processing…</p>
          </div>
        </div>
      )}

      <OTPModal open={otpOpen} onClose={() => setOtpOpen(false)} onVerify={handleVerify} onResend={otpMode === "self" ? handleResend : undefined} />
    </div>
  );
}
