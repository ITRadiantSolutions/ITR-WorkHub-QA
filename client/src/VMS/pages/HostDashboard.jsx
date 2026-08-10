import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../../services/api.js";
import InviteVisitorModal from "../components/InviteVisitorModal.jsx";

const STATUS_CFG = {
  HOST_PENDING: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  PENDING: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  FINAL_APPROVED: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  APPROVED: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  CHECKED_IN: { dot: "bg-green-500", bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  REJECTED: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

function StatusBadge({ status = "" }) {
  const c = STATUS_CFG[status?.toUpperCase()] ?? { dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${color.border}`}>
      <p className={`text-[11px] font-bold uppercase tracking-widest ${color.label}`}>{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${color.value}`}>{value}</p>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${color.bar}`} />
    </div>
  );
}

function initialsOf(name) {
  return (name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function HostOverview({ pending, onGoToVisitors }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Host Overview</h1>
        <p className="text-xs text-slate-500 mt-0.5">Visitors waiting on your approval.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Pending Approval"
          value={pending.length}
          color={{ border: "border-amber-100", label: "text-amber-400", value: "text-amber-600", bar: "bg-gradient-to-r from-amber-400 to-orange-400" }}
        />
      </div>

      <div className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-md shadow-slate-200/40 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Pending Requests</span>
          <button onClick={onGoToVisitors} className="text-xs font-semibold text-pink-600 hover:underline">
            Review all →
          </button>
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <p className="text-xs font-semibold">All caught up!</p>
            <p className="text-[11px] mt-0.5">No pending approvals right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.slice(0, 5).map((v) => {
              const vid = v.id ?? v._id;
              return (
                <div key={vid} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                  {v.photoUrl ? (
                    <img src={v.photoUrl} alt={v.fullName} className="h-8 w-8 rounded-xl object-cover shrink-0 ring-1 ring-amber-200" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-[10px] font-bold text-white">
                      {initialsOf(v.fullName)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{v.fullName ?? "—"}</p>
                    <p className="text-[11px] text-slate-500 truncate">{v.purpose ?? "—"}</p>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalCenter({ visitors, loading, actionLoading, onRefresh, onDecision, queueFilter, onSetQueueFilter, onResendOtp, resendLoadingId }) {
  const queueLabel = { pending: "Pending", approved: "Approved", invited: "Invited", rejected: "Rejected" }[queueFilter];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{queueLabel} Visitors</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {visitors.length} request{visitors.length !== 1 ? "s" : ""} in this queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { key: "pending", label: "Pending" },
              { key: "approved", label: "Approved" },
              { key: "invited", label: "Invited" },
              { key: "rejected", label: "Rejected" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSetQueueFilter(opt.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  opt.key === queueFilter ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow shadow-rose-200" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-pink-300 hover:text-pink-600 active:scale-[0.98] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
        </div>
      ) : visitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-slate-400">
          <p className="text-sm font-semibold text-slate-600">All clear!</p>
          <p className="mt-1 text-xs text-slate-400">No {queueLabel.toLowerCase()} visitor requests at this time.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {["Visitor", "Contact", "Purpose", "Duration", "Status", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visitors.map((v) => {
                  const vid = v.id ?? v._id;
                  return (
                    <tr key={vid} className="transition-colors hover:bg-pink-50/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {v.photoUrl ? (
                            <img src={v.photoUrl} alt={v.fullName} className="h-9 w-9 rounded-xl object-cover ring-1 ring-slate-200 shrink-0" />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-[11px] font-bold text-white">
                              {initialsOf(v.fullName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{v.fullName ?? "—"}</p>
                            <p className="text-[10px] text-slate-400">{v.email ?? ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{v.mobileNumber ?? "—"}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-600 truncate max-w-[140px]">{v.purpose ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{v.expectedDuration ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {queueFilter === "pending" ? (
                            <>
                              <button
                                onClick={() => onDecision(vid, true)}
                                disabled={actionLoading}
                                className="rounded-lg bg-green-50 px-2.5 py-1.5 text-[11px] font-semibold text-green-700 border border-green-200 transition hover:bg-green-100 active:scale-[0.97] disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => onDecision(vid, false)}
                                disabled={actionLoading}
                                className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 border border-red-200 transition hover:bg-red-100 active:scale-[0.97] disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : queueFilter === "invited" ? (
                            <button
                              onClick={() => onResendOtp(vid)}
                              disabled={resendLoadingId === vid}
                              className="rounded-lg bg-pink-50 px-2.5 py-1.5 text-[11px] font-semibold text-pink-700 border border-pink-200 transition hover:bg-pink-100 disabled:opacity-50"
                            >
                              {resendLoadingId === vid ? "Sending…" : "Resend OTP"}
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Ported from the standalone VMS project's HostDashboard.jsx. Adapted:
// RoleBasedNavbar replaced by VmsLayout's sidebar (this renders inside its
// <Outlet/>, active tab comes from the URL — /vms/host vs /vms/host/visitors
// — matching how every other module's layout in this app works), API calls
// point at /vms/visitors/*, and alert()s became sonner toasts.
export default function VmsHostDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname.endsWith("/visitors") ? "visitors" : "overview";
  const [visitors, setVisitors] = useState([]);
  const [pendingForOverview, setPendingForOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState("pending");
  const [actionLoading, setActionLoading] = useState(false);
  const [resendLoadingId, setResendLoadingId] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const QUEUE_ENDPOINT = {
    pending: "/vms/visitors/host/pending",
    approved: "/vms/visitors/host/approved",
    rejected: "/vms/visitors/host/rejected",
    invited: "/vms/visitors/host/invited",
  };

  const loadVisitors = async (filter = queueFilter) => {
    setLoading(true);
    try {
      const { data } = await API.get(QUEUE_ENDPOINT[filter]);
      setVisitors(data?.visitors || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Unable to load visitors.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisitors(queueFilter);
  }, [queueFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    API.get("/vms/visitors/host/pending")
      .then(({ data }) => setPendingForOverview(data?.visitors || []))
      .catch(() => {});
  }, []);

  const handleDecision = async (visitorId, approved) => {
    setActionLoading(true);
    try {
      await API.post("/vms/visitors/host-approve", { visitorId, approved, reason: approved ? "Approved for entry" : "Rejected by host" });
      setVisitors((prev) => prev.filter((v) => (v.id ?? v._id) !== visitorId));
      toast.success(approved ? "Visitor approved successfully." : "Visitor rejected successfully.");
      await loadVisitors();
    } catch (err) {
      toast.error(err?.response?.data?.error ?? "Unable to submit host decision.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResend = async (visitorId) => {
    if (!visitorId) return;
    try {
      setResendLoadingId(visitorId);
      await API.post("/vms/visitors/resend-invited-otp", { visitorId });
      toast.success("OTP resent successfully.");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to resend OTP");
    } finally {
      setResendLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        <div className="mb-5 flex items-center justify-end">
          <button
            onClick={() => setInviteOpen(true)}
            className="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-rose-200 transition hover:opacity-90 active:scale-[0.98]"
          >
            + Invite Visitor
          </button>
        </div>

        {tab === "overview" ? (
          <HostOverview pending={pendingForOverview} onGoToVisitors={() => navigate("/vms/host/visitors")} />
        ) : (
          <ApprovalCenter
            visitors={visitors}
            loading={loading}
            actionLoading={actionLoading}
            onRefresh={() => loadVisitors()}
            onDecision={handleDecision}
            queueFilter={queueFilter}
            onSetQueueFilter={setQueueFilter}
            onResendOtp={handleResend}
            resendLoadingId={resendLoadingId}
          />
        )}
      </div>

      <InviteVisitorModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          if (queueFilter === "invited") loadVisitors();
        }}
      />
    </div>
  );
}
