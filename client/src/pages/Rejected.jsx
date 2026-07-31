import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────
const Icon = {
  XCircle: () => (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),

  Refresh: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15A9 9 0 1 1 18.37 5.64L23 10" />
    </svg>
  ),

  ArrowLeft: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function Rejected() {
  const navigate = useNavigate();

  return (
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-6"
    >
      {/* Background Blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-16 -left-16 w-72 h-72 bg-rose-100 rounded-full blur-3xl opacity-70" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-slate-200 rounded-full blur-3xl opacity-70" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden">
          {/* Top Accent */}
          <div className="h-1 bg-gradient-to-r from-rose-600 via-rose-500 to-slate-700" />

          {/* Status Badge */}
          <div className="pt-5 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Request Rejected
            </div>
          </div>

          {/* Icon */}
          <div className="pt-4 flex justify-center">
            <div className="w-20 h-20 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Icon.XCircle />
            </div>
          </div>

          {/* Text */}
          <div className="px-6 pt-4 text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Account Rejected
            </h1>

            <p className="text-sm text-slate-500 leading-6 mt-2 max-w-[290px] mx-auto">
              Your access request was not approved by the Admin.
              Please contact your workspace Admin for details.
            </p>
          </div>

          {/* Info Box */}
          <div className="mx-5 mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2">
              What you can do
            </p>

            <div className="space-y-2 text-sm text-slate-600">
              <p>• Contact Admin for reason</p>
              <p>• Request access again if needed</p>
              <p>• Refresh later for updated status</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="px-5 pt-5 pb-5 space-y-2">
            <button
              onClick={() => navigate("/")}
              className="w-full h-11 rounded-2xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition flex items-center justify-center gap-2"
            >
              <Icon.ArrowLeft />
              Back to Login
            </button>

            
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 mt-3">
          Last checked: {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
}