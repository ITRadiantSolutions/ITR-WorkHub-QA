import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { API } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";

const todayISODate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function FieldLabel({ children }) {
  return <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{children}</div>;
}

// Ported from the standalone VMS project's InviteVisitorModal.jsx. Adapted:
// the original's "Host (optional)" field was a raw text box for pasting a
// Mongo ID with no lookup at all — this modal only opens from a host's own
// dashboard, so it now just defaults personToMeetId to the inviting host
// (dropping the field entirely instead of asking them to paste their own id).
// Also dropped: an OTPModal wired up here that could never open (open state
// was never set true anywhere in the source file) — dead UI.
export default function InviteVisitorModal({ open, onClose, onInvited }) {
  const { user } = useAuth();

  const [visitDate, setVisitDate] = useState(todayISODate());
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expectedDuration, setExpectedDuration] = useState("2 hours");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setVisitDate(todayISODate());
    setFullName("");
    setMobileNumber("");
    setEmail("");
    setPurpose("");
    setExpectedDuration("2 hours");
    setSending(false);
    setError("");
  };

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  const canSend = useMemo(
    () => fullName.trim().length >= 2 && mobileNumber.replace(/\D/g, "").length >= 10 && purpose.trim().length >= 2 && Boolean(visitDate),
    [fullName, mobileNumber, purpose, visitDate],
  );

  const handleInviteSend = async () => {
    if (!canSend) {
      toast.error("Please fill required fields.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await API.post("/vms/visitors/create", {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.replace(/\D/g, ""),
        email: email.trim(),
        purpose: purpose.trim(),
        expectedDuration,
        visitDate,
        personToMeetId: user?._id ?? user?.id,
        visitorType: "Invited",
        notes: "Invited by host",
      });
      toast.success("Invite sent. OTP delivered to visitor phone.");
      onInvited?.();
      onClose?.();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Failed to send invite";
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0" style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}>
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-2xl shadow-slate-300/40 backdrop-blur">
        <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-pink-600" />

        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Invite visitor</h2>
              <p className="text-[11px] text-slate-500 mt-1">Add visitor details, choose visit date, and send a 6-digit OTP.</p>
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div>
              <FieldLabel>Visit date</FieldLabel>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Full name *</FieldLabel>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter name"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                />
              </div>
              <div>
                <FieldLabel>Mobile number *</FieldLabel>
                <input
                  type="text"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                />
              </div>
            </div>

            <div>
              <FieldLabel>Purpose *</FieldLabel>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Meeting / Delivery / Interview"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Email (optional)</FieldLabel>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                />
              </div>
              <div>
                <FieldLabel>Duration</FieldLabel>
                <input
                  type="text"
                  value={expectedDuration}
                  onChange={(e) => setExpectedDuration(e.target.value)}
                  placeholder="2 hours"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
                />
              </div>
            </div>
          </div>

          {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 font-semibold">{error}</div>}

          <div className="flex gap-2 px-0 py-4">
            <button
              onClick={onClose}
              disabled={sending}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-pink-300 hover:text-pink-600 active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleInviteSend}
              disabled={sending || !canSend}
              className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Sending…" : "Invite Send"}
            </button>
          </div>

          <div className="text-center text-[11px] text-slate-400 pb-2">
            OTP verification will be accepted only if <span className="font-bold">today</span> matches the selected visit date.
          </div>
        </div>
      </div>
    </div>
  );
}
