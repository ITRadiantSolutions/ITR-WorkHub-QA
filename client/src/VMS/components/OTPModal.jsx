import { useEffect, useRef, useState } from "react";

const DIGITS = 6;

// Ported near-verbatim from the standalone VMS project's OTPModal.jsx — one
// real change: the original "Resend OTP" button had no handler at all.
export default function OTPModal({ open, onClose, onVerify, onResend }) {
  const [digits, setDigits] = useState(Array(DIGITS).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (open) {
      setDigits(Array(DIGITS).fill(""));
      setError("");
      setLoading(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 80);
    }
  }, [open]);

  const handleKey = (e, i) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = [...digits];
        next[i] = "";
        setDigits(next);
      } else if (i > 0) {
        inputRefs.current[i - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      inputRefs.current[i - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && i < DIGITS - 1) {
      inputRefs.current[i + 1]?.focus();
      return;
    }
    if (e.key === "Enter") handleVerify();
  };

  const handleChange = (e, i) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) return;
    if (val.length > 1) {
      const spread = val.slice(0, DIGITS).split("");
      const next = [...digits];
      spread.forEach((ch, idx) => {
        if (idx < DIGITS) next[idx] = ch;
      });
      setDigits(next);
      inputRefs.current[Math.min(spread.length, DIGITS - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (i < DIGITS - 1) inputRefs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGITS);
    const next = Array(DIGITS).fill("");
    pasted.split("").forEach((ch, idx) => {
      next[idx] = ch;
    });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, DIGITS - 1)]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < DIGITS) {
      setError("Please enter all 6 digits.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onVerify(code);
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!onResend || resending) return;
    setResending(true);
    setError("");
    try {
      await onResend();
      setDigits(Array(DIGITS).fill(""));
      inputRefs.current[0]?.focus();
    } catch {
      setError("Could not resend OTP. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const filled = digits.filter(Boolean).length;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-2xl shadow-slate-300/40 backdrop-blur">
        <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-pink-600" />

        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow shadow-rose-200">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">OTP Verification</h2>
              <p className="text-[11px] text-slate-500">Visitor identity check</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mx-5 mb-4 rounded-xl border border-pink-100 bg-gradient-to-r from-rose-50 to-pink-50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-pink-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-[11px] font-medium text-pink-800">A 6-digit code was sent to the visitor's phone number. Enter it below.</p>
          </div>
        </div>

        <div className="px-5 pb-2">
          <div className="flex items-center justify-between gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(e, i)}
                onKeyDown={(e) => handleKey(e, i)}
                onPaste={handlePaste}
                className={`h-12 w-full rounded-xl border-2 text-center text-lg font-extrabold outline-none transition-all
                  ${d ? "border-rose-400 bg-gradient-to-b from-rose-50 to-pink-50 text-pink-700 shadow shadow-rose-100" : "border-slate-200 bg-white text-slate-900 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"}
                  ${error ? "border-red-300" : ""}`}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            {Array(DIGITS).fill(0).map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-200 ${i < filled ? "w-5 bg-gradient-to-r from-rose-500 to-pink-600" : "w-2 bg-slate-200"}`} />
            ))}
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <svg className="h-3.5 w-3.5 shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] font-semibold text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-pink-300 hover:text-pink-600 active:scale-[0.98]">
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={loading || filled < DIGITS}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Verifying…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Verify Code
              </>
            )}
          </button>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-center">
          <p className="text-[11px] text-slate-400">
            Didn't receive the code?{" "}
            <button onClick={handleResend} disabled={resending} className="font-bold text-pink-600 hover:text-rose-600 transition disabled:opacity-50">
              {resending ? "Resending…" : "Resend OTP"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
