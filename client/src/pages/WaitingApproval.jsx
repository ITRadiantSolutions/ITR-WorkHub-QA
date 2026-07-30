import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { checkUserStatus } from "../services/userApi.js";
import Icons from "../components/Icons.jsx";



// ─────────────────────────────────────────────
// Clock
// ─────────────────────────────────────────────
function AnimatedClock() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const minute = (tick % 60) * 6;
  const hour = (tick % 720) * 0.5;

  return (
    <svg width="56" height="56" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="35" stroke="#CBD5E1" strokeWidth="2" />

      <line
        x1="40"
        y1="40"
        x2={40 + Math.cos(((hour - 90) * Math.PI) / 180) * 14}
        y2={40 + Math.sin(((hour - 90) * Math.PI) / 180) * 14}
        stroke="#0F172A"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <line
        x1="40"
        y1="40"
        x2={40 + Math.cos(((minute - 90) * Math.PI) / 180) * 22}
        y2={40 + Math.sin(((minute - 90) * Math.PI) / 180) * 22}
        stroke="#475569"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <circle cx="40" cy="40" r="3" fill="#0F172A" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Step
// ─────────────────────────────────────────────
function Step({ num, label, done }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border ${
          done
            ? "bg-slate-900 border-slate-900 text-white"
            : "bg-white border-slate-300 text-slate-500"
        }`}
      >
        {done ? <Icons.Check /> : num}
      </div>

      <span
        className={`text-sm ${
          done ? "text-slate-800 font-medium" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function WaitingApproval() {
  const navigate = useNavigate();
  const [dots, setDots] = useState(".");
  const [status, setStatus] = useState("Pending");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("");
  const [polling, setPolling] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Parse query params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status") || "Pending";
    const emailParam = decodeURIComponent(params.get("email") || "");
    const providerParam = params.get("provider") || "";

    setStatus(statusParam);
    setEmail(emailParam);
    setProvider(providerParam);
    console.log("📋 WaitingApproval params:", {
      status: statusParam,
      email: emailParam,
      provider: providerParam,
    });
  }, []);

  // Dots animation
  useEffect(() => {
    const timer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Auto-check if already authenticated (approved)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("approvedRedirect") === "1") {
      toast.success("✅ Account approved! Redirecting to dashboard...");
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Poll status every 30s
  const pollStatus = useCallback(async () => {
    if (!email || polling) return;
    if (status !== "Pending") return;

    setPolling(true);
    setCheckingStatus(true);
    try {
      const res = await checkUserStatus(email);
      const userStatus = res.data.status;
      console.log("🔄 Status check for", email, ":", userStatus);

      if (userStatus === "Approved") {
        toast.success("Account approved! Please sign in to continue.");
        navigate("/", { replace: true });
      } else if (userStatus === "Rejected") {
        toast.error("❌ Account rejected by admin.");
        navigate("/rejected", { replace: true });
      }
    } catch (err) {
      console.error("❌ Status check failed:", err);
    } finally {
      setCheckingStatus(false);
      setPolling(false);
    }
  }, [email, status, polling, navigate]);

  useEffect(() => {
    if (status === "Pending") {
      pollStatus();
      const interval = setInterval(pollStatus, 30000); // 30s
      return () => clearInterval(interval);
    }
  }, [pollStatus, status]);

  return (
    <div
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      className="min-h-screen bg-slate-50 flex items-center justify-center px-2 py-1"
    >
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden">
          {/* Top Accent */}
          <div className="h-1 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500" />

          {/* Status */}
          <div className="pt-0 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {status} {checkingStatus && "(checking...)"}
            </div>
          </div>

          {/* Main Content */}
          <div className="px-6 pt-4 pb-3 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
              <AnimatedClock />
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              Waiting for Approval
            </h1>

            <p className="text-sm text-slate-500 mt-1 leading-6">
              Your {provider === "microsoft" ? "Microsoft" : "FlowTrack"}{" "}
              account ({email || "your account"}) has been registered
              successfully. Waiting for admin approval.
            </p>
          </div>

          {/* Steps */}
          <div className="mx-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Progress
            </p>

            <Step num="1" label="Account Registered" done />
            <Step num="2" label="Admin Verification" done={false} />
            <Step num="3" label="Workspace Access" done={false} />
          </div>

      

          {/* Waiting */}
          <div className="mx-5 mt-3 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-[11px] text-slate-500 flex items-center justify-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-700"
                  style={{
                    animation: "bounce 1.2s infinite",
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            {checkingStatus ? "Checking status" : `Waiting for admin${dots}`}
          </div>

          {/* Buttons */}
          <div className="px-5 pt-4 pb-5 space-y-2">
            <button
              onClick={pollStatus}
              disabled={checkingStatus || !email}
              className="w-full h-11 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-black transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Icons.Refresh />
              {checkingStatus ? "Checking..." : "Check Status"}
            </button>
            <button
    type="button"
    onClick={() => navigate("/")}
    className="w-full h-11 rounded-2xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 transition flex items-center justify-center gap-2"
  >
    <Icons.Back />
    Back to Login
  </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 mt-3">
          Need help? Contact your workspace administrator
        </p>
      </div>
    </div>
  );
}
