import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icons from "../components/Icons";
import WorkHubLogo from "../components/WorkHubLogo";
import LoginDashboardPreview from "../components/LoginDashboardPreview";

// Icons.jsx has no EyeOff variant — a small local fallback for the
// hide-password toggle.
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function InputField({ label, type = "text", placeholder, value, onChange, disabled, IconComp, rightEl }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative group">
        {IconComp && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-600 transition-colors">
            <IconComp />
          </div>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-800
            focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 focus:bg-white
            placeholder-slate-300 transition-all duration-200 disabled:opacity-60 py-2.5
            hover:border-slate-300 hover:bg-white
            ${IconComp ? "pl-9 pr-3" : "px-3.5"} ${rightEl ? "pr-10" : ""}`}
        />
        {rightEl && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    Ic: Icons.Folder,
    bg: "bg-blue-600",
    title: "Project Management",
    desc: "Plan, track and deliver projects efficiently.",
  },
  {
    Ic: Icons.Clock,
    bg: "bg-teal-500",
    title: "Time Tracking",
    desc: "Log hours, timesheets and stay productive.",
  },
  {
    Ic: Icons.Star,
    bg: "bg-violet-500",
    title: "Performance Management",
    desc: "Set goals, review performance and grow together.",
  },
  {
    Ic: Icons.BarChart,
    bg: "bg-orange-500",
    title: "Insights & Reports",
    desc: "Real-time insights to make smarter decisions.",
  },
];

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const navigate = useNavigate();
  const { login, token, user } = useAuth();

  useEffect(() => {
    if (token && user) navigate("/hub", { replace: true });
  }, [token, user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Please enter your email and password");
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });
      const { token, user } = res.data;

      const msStart = localStorage.getItem("ms_login_start");
      if (msStart) localStorage.removeItem("ms_login_start");

      login(user, token);
      window.history.replaceState(null, "", window.location.href);
      navigate("/hub", { replace: true });
    } catch (err) {
      const errorData = err.response?.data || {};
      if (errorData.status === "Pending") {
        toast.info("Your account is pending admin approval.", { duration: 4000 });
        navigate(
          errorData.email
            ? `/waiting-approval?status=Pending&email=${encodeURIComponent(errorData.email)}`
            : "/waiting-approval?status=Pending",
        );
      } else if (errorData.status === "Rejected") {
        toast.error("Account rejected. Contact administrator.", { duration: 5000 });
        navigate("/rejected");
      } else {
        setError(errorData.message || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    setMsLoading(true);
    localStorage.setItem("ms_login_start", Date.now().toString());
    const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
    window.location.href = `${apiBase}/api/auth/azure`;
  };

  return (
    <div style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }} className="h-screen w-screen overflow-hidden flex flex-col lg:flex-row">
      {/* ── Left panel — brand side ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-center gap-5 px-10 xl:px-14 py-6 relative overflow-hidden"
        style={{ background: "linear-gradient(150deg, #eff6ff 0%, #dbeafe 60%, #bfdbfe 100%)" }}
      >
        <div className="relative z-10">
          <WorkHubLogo size="lg" />
          <p className="text-slate-600 text-xs mt-2 font-medium">One Platform. All Your Work.</p>
        </div>

        <div className="relative z-10">
          <h1 className="font-extrabold text-slate-900 leading-[1.15] tracking-tight mb-2" style={{ fontSize: "2rem" }}>
            Manage Projects, Track Time.
            <br />
            <span className="text-blue-600">Drive Performance.</span>
          </h1>
          <p className="text-slate-500 text-sm max-w-md">
            Streamline projects, track productivity, manage performance and achieve more together.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-x-6 gap-y-3">
          {FEATURES.map(({ Ic, bg, title, desc }) => (
            <div key={title} className="flex items-start gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 ${bg}`}>
                <Ic />
              </div>
              <div>
                <p className="text-slate-800 text-sm font-bold leading-tight">{title}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <LoginDashboardPreview />
        </div>

        <div className="relative z-10 flex items-center gap-2.5 bg-white/70 border border-white rounded-xl px-4 py-2.5 max-w-md">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Icons.Shield />
          </div>
          <div>
            <p className="text-slate-800 text-xs font-bold leading-tight">Secure &nbsp;•&nbsp; Reliable &nbsp;•&nbsp; Trusted by Teams</p>
            <p className="text-slate-500 text-[11px] mt-0.5">Enterprise grade security for your business</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — sign-in form ───────────────────────────────────── */}
      <div className="flex-1 h-full bg-white relative overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col items-center justify-center">
        <div className="relative z-10 w-full max-w-[430px]">
          <div className="flex justify-center mb-6 lg:hidden">
            <WorkHubLogo size="lg" />
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl px-5 sm:px-7 py-6 sm:py-7">
            <div className="mb-5">
              <h2 className="text-[24px] sm:text-[28px] font-extrabold text-slate-900 leading-tight">Welcome Back!</h2>
              <p className="text-slate-500 text-sm mt-1">Sign in to continue to ITR WorkHub</p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 flex gap-2">
                <Icons.Alert />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
              <InputField
                label="Email Address"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                IconComp={Icons.User}
              />

              <InputField
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                IconComp={Icons.Lock}
                rightEl={
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-slate-400 hover:text-slate-700">
                    {showPassword ? <EyeOffIcon /> : <Icons.Eye />}
                  </button>
                }
              />

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-600 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Remember Me
                </label>
                <button
                  type="button"
                  onClick={() => toast.info("Contact your administrator to reset your password.")}
                  className="font-semibold text-blue-600 hover:text-blue-700"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Icons.Lock /> Sign In
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">or sign in with</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={loading || msLoading}
                onClick={handleMicrosoftLogin}
                className="w-full h-11 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-50 transition"
              >
                <div
                  className="w-5 h-5 bg-cover bg-center bg-no-repeat"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath fill='%23F25022' d='M1 1h10v10H1z'/%3E%3Cpath fill='%237FBA00' d='M13 1h10v10H13z'/%3E%3Cpath fill='%2300A4EF' d='M1 13h10v10H1z'/%3E%3Cpath fill='%23FFB900' d='M13 13h10v10H13z'/%3E%3C/svg%3E")`,
                  }}
                />
                {msLoading ? "Redirecting..." : "Sign in with Microsoft"}
              </button>

              <button
                type="button"
                onClick={() => toast.info("Google sign-in isn't set up yet — use email/password or Microsoft.")}
                className="w-full h-11 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-50 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.9c2.28-2.1 3.55-5.2 3.55-8.82z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.9-3c-1.08.73-2.47 1.16-4.03 1.16-3.1 0-5.72-2.09-6.66-4.9H1.3v3.09A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.34 14.35a7.2 7.2 0 0 1 0-4.7V6.56H1.3a12 12 0 0 0 0 10.88l4.04-3.09z" />
                  <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.56l4.04 3.09C6.28 6.84 8.9 4.75 12 4.75z" />
                </svg>
                Sign in with Google
              </button>
            </form>

            <p className="text-center text-xs text-slate-500 mt-4">
              Don't have an account? <span className="font-bold text-slate-800">Contact your administrator.</span>
            </p>
          </div>

          <div className="text-center mt-6">
            <p className="text-[11px] font-semibold text-slate-400 tracking-wide">Secure &nbsp;•&nbsp; Reliable &nbsp;•&nbsp; Trusted</p>
            <p className="text-[11px] text-slate-400 mt-1">© {new Date().getFullYear()} ITRadiant Solutions Pvt. Ltd. All rights reserved.</p>
            <p className="text-[10px] text-slate-300 mt-1">Version 2.1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
