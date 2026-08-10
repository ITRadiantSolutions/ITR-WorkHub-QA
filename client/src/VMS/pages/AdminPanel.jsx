import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";

const STATUS_CFG = {
  OTP_PENDING: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500", label: "OTP Pending" },
  OTP_VERIFIED: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", dot: "bg-cyan-500", label: "Verified" },
  HOST_PENDING: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500", label: "Host Approval Pending" },
  FINAL_APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Final Approved" },
  APPROVED: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500", label: "Approved" },
  CHECKED_IN: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500", label: "Checked In" },
  CHECKED_OUT: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400", label: "Checked Out" },
  REJECTED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", label: "Rejected" },
};
const statusCfg = (s = "") => STATUS_CFG[s?.toUpperCase()] ?? { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400", label: s || "—" };

function StatusBadge({ status }) {
  const c = statusCfg(status);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${c.bg} ${c.text} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function initialsOf(name) {
  return (name ?? "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function toTitleCase(str = "") {
  return String(str).replaceAll("_", " ").replace(/\s+/g, " ").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Overview: analytics stat cards ──────────────────────────────────────────
function Overview({ analytics }) {
  const cards = [
    { label: "Total Visitors", value: analytics?.totalVisitors, color: "border-rose-100 text-rose-400", valueColor: "text-rose-700", bar: "from-rose-400 to-pink-400" },
    { label: "OTP Pending", value: analytics?.pending, color: "border-rose-100 text-rose-300", valueColor: "text-rose-600", bar: "from-rose-300 to-pink-300" },
    { label: "Approved", value: analytics?.approved, color: "border-pink-100 text-pink-400", valueColor: "text-pink-700", bar: "from-pink-400 to-rose-500" },
    { label: "Checked In", value: analytics?.checkedIn, color: "border-pink-100 text-pink-300", valueColor: "text-pink-600", bar: "from-pink-300 to-rose-300" },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
        <p className="text-xs text-slate-500 mt-0.5">Visitor activity across the building.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${c.color.split(" ")[0]}`}>
            <p className={`text-[11px] font-bold uppercase tracking-widest ${c.color.split(" ")[1]}`}>{c.label}</p>
            <p className={`mt-2 text-3xl font-semibold ${c.valueColor}`}>{c.value ?? "—"}</p>
            <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${c.bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Visitors: browse table + detail card ────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

function VisitorCard({ visitor, loading }) {
  if (loading) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
      </div>
    );
  }
  if (!visitor) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
        <p className="text-sm font-semibold text-slate-600">No visitor selected</p>
        <p className="mt-1 text-xs text-slate-400">Click "View" on any row to see full details here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="relative bg-gradient-to-r from-pink-600 to-rose-500 px-5 pt-5 pb-14">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Visitor Profile</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{visitor.fullName ?? "—"}</h3>
          </div>
          <StatusBadge status={visitor.status} />
        </div>
      </div>
      <div className="relative px-5">
        <div className="-mt-10 mb-4 flex items-end gap-4">
          {visitor.photoUrl ? (
            <img src={visitor.photoUrl} alt={visitor.fullName} className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-lg" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-pink-500 to-rose-400 text-xl font-bold text-white shadow-lg">
              {initialsOf(visitor.fullName)}
            </div>
          )}
          <div className="mb-1 min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{visitor.email ?? "—"}</p>
            <p className="text-xs text-slate-500">{visitor.mobileNumber ?? "—"}</p>
          </div>
        </div>

        <div className="space-y-3 pb-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <DetailRow label="Host" value={visitor.personToMeet?.name ?? visitor.personToMeetId?.name} />
            {(visitor.visitorType === "Invited" || visitor.createdById) && (
              <DetailRow label="Invited By" value={visitor.createdById?.name || visitor.createdById?.email} />
            )}
            <DetailRow label="Purpose" value={visitor.purpose} />
            <DetailRow label="Expected Duration" value={visitor.expectedDuration} />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <DetailRow label="Address" value={visitor.address} />
            <DetailRow label="Visitor Type" value={visitor.visitorType} />
            {visitor.notes && <DetailRow label="Notes" value={visitor.notes} />}
          </div>

          {(visitor.checkInTime || visitor.checkOutTime || visitor.createdAt) && (
            <div className="grid grid-cols-2 gap-2">
              {visitor.createdAt && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Registered</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-700">{new Date(visitor.createdAt).toLocaleString()}</p>
                </div>
              )}
              {visitor.checkInTime && (
                <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">Checked In</p>
                  <p className="mt-0.5 text-xs font-medium text-green-700">{new Date(visitor.checkInTime).toLocaleString()}</p>
                </div>
              )}
              {visitor.checkOutTime && (
                <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Checked Out</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">{new Date(visitor.checkOutTime).toLocaleString()}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VisitorsBrowser() {
  const [visitors, setVisitors] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [listType, setListType] = useState("all");
  const [resendLoadingId, setResendLoadingId] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingList(true);
      try {
        const { data } = listType === "invited" ? await API.get("/vms/visitors/invited") : await API.get("/vms/visitors");
        if (mounted) setVisitors(data?.visitors || []);
      } catch (e) {
        toast.error(e?.response?.data?.error || "Unable to load visitors.");
      } finally {
        if (mounted) setLoadingList(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [listType]);

  useEffect(() => {
    if (!selectedId) return;
    let mounted = true;
    (async () => {
      setLoadingDetails(true);
      setSelectedVisitor(null);
      try {
        const { data } = await API.get(`/vms/visitors/${selectedId}`);
        if (mounted) setSelectedVisitor(data?.visitor ?? null);
      } catch (e) {
        toast.error(e?.response?.data?.error || "Unable to load visitor details.");
      } finally {
        if (mounted) setLoadingDetails(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedId]);

  const rows = useMemo(
    () =>
      visitors.map((v) => ({
        id: v.id ?? v._id,
        fullName: v.fullName ?? "—",
        mobileNumber: v.mobileNumber ?? "—",
        status: v.status ?? "—",
        host: v.personToMeet?.name ?? "—",
        purpose: v.purpose ?? "—",
        photoUrl: v.photoUrl ?? null,
        createdAt: v.createdAt ?? null,
      })),
    [visitors],
  );

  const filtered = useMemo(
    () =>
      rows.filter((v) => {
        const q = search.toLowerCase();
        const matchSearch = !q || v.fullName.toLowerCase().includes(q) || v.mobileNumber.includes(q) || v.host.toLowerCase().includes(q) || v.purpose.toLowerCase().includes(q);
        const matchStatus = statusFilter === "ALL" || v.status.toUpperCase() === statusFilter;
        return matchSearch && matchStatus;
      }),
    [rows, search, statusFilter],
  );

  const handleResend = async (visitorId) => {
    try {
      setResendLoadingId(visitorId);
      await API.post("/vms/visitors/resend-invited-otp", { visitorId });
      toast.success("OTP resent successfully.");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to resend OTP");
    } finally {
      setResendLoadingId(null);
    }
  };

  const statuses = ["ALL", ...Object.keys(STATUS_CFG)];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Visitor Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filtered.length} of {rows.length} {listType === "invited" ? "invited" : "all"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {[{ key: "all", label: "All Visitors" }, { key: "invited", label: "Invited" }].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  setListType(opt.key);
                  setSelectedId(null);
                  setSelectedVisitor(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  opt.key === listType ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow shadow-rose-200" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search visitors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-700 placeholder-slate-400 shadow-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-7 text-xs text-slate-700 shadow-sm outline-none focus:border-rose-400 cursor-pointer"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All Statuses" : STATUS_CFG[s]?.label ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {loadingList ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <p className="text-sm font-semibold">No visitors found</p>
              <p className="text-xs mt-1">Try adjusting your search or filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    {["Visitor", "Contact", "Host", "Purpose", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((v) => {
                    const isSelected = selectedId === v.id;
                    const showResend = listType === "invited";
                    return (
                      <tr key={v.id} onClick={() => setSelectedId(v.id)} className={`cursor-pointer transition-colors ${isSelected ? "bg-pink-50/60" : "hover:bg-slate-50/80"}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {v.photoUrl ? (
                              <img src={v.photoUrl} alt={v.fullName} className="h-8 w-8 rounded-xl object-cover ring-1 ring-slate-200 shrink-0" />
                            ) : (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-400 text-[10px] font-bold text-white">
                                {initialsOf(v.fullName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className={`truncate text-xs font-semibold ${isSelected ? "text-pink-700" : "text-slate-800"}`}>{v.fullName}</p>
                              {v.createdAt && <p className="text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{v.mobileNumber}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 truncate max-w-[100px]">{v.host}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[100px]">{v.purpose}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {showResend && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResend(v.id);
                                }}
                                disabled={resendLoadingId === v.id}
                                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border bg-white text-rose-700 border-rose-200 hover:bg-rose-50 disabled:opacity-50"
                              >
                                {resendLoadingId === v.id ? "Resending…" : "Resend"}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(v.id);
                              }}
                              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                                isSelected ? "bg-pink-600 text-white shadow shadow-pink-200" : "bg-pink-50 text-pink-600 hover:bg-pink-100"
                              }`}
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <VisitorCard visitor={selectedVisitor} loading={loadingDetails} />
        </div>
      </div>
    </div>
  );
}

// ── Audit log ────────────────────────────────────────────────────────────────
function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (offset = 0) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const { data } = await API.get("/vms/admin/audit-logs", { params: { limit: 20, offset } });
      setLogs((prev) => (offset === 0 ? data.logs || [] : [...prev, ...(data.logs || [])]));
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Unable to load audit logs.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canLoadMore = logs.length < total;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit Logs</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {logs.length} of {total} entries
        </p>
      </div>

      <div className="rounded-2xl border border-white/80 bg-white/80 shadow-md shadow-slate-200/40 backdrop-blur overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <p className="text-sm font-semibold">No logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const visitorName = log.newValue?.fullName || log.oldValue?.fullName;
              return (
                <div key={log._id} className="flex items-center gap-3 px-4 py-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800">{toTitleCase(log.action)}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {log.actorId?.name || "System"}
                      {visitorName ? ` · ${visitorName}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] text-slate-400">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</p>
                </div>
              );
            })}
          </div>
        )}

        {canLoadMore && (
          <div className="p-4">
            <button
              onClick={() => load(logs.length)}
              disabled={loadingMore}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                loadingMore ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {loadingMore ? "Loading…" : "Load More"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Floating quick check-out widget (reception/admin only) ─────────────────
function QuickCheckoutWidget() {
  const [open, setOpen] = useState(false);
  const [checkedIn, setCheckedIn] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await API.get("/vms/visitors", { params: { status: "checked_in" } });
      const list = data?.visitors ?? [];
      setCheckedIn(list);
      if (!selectedId && list.length > 0) setSelectedId(String(list[0]?.id ?? list[0]?._id ?? ""));
    } catch {
      // best-effort widget — stay quiet on failure
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = checkedIn.find((v) => String(v.id ?? v._id) === selectedId);
  const count = checkedIn.length;

  const handleCheckout = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await API.post("/vms/visitors/checkout", { visitorId: selectedId });
      toast.success("Checked out successfully.");
      setSelectedId("");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to check out.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
          <div className="relative bg-gradient-to-r from-pink-600 to-rose-500 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Reception</p>
                <h3 className="text-sm font-semibold text-white">Quick Check-out</h3>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                {count} on-site
              </span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {loadingList ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
              </div>
            ) : count === 0 ? (
              <p className="py-6 text-center text-xs font-semibold text-slate-500">No visitors on-site</p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-0.5">
                  {checkedIn.map((v) => {
                    const id = String(v.id ?? v._id ?? "");
                    const sel = selectedId === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setSelectedId(id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                          sel ? "border-pink-200 bg-pink-50 shadow-sm" : "border-slate-100 bg-slate-50/60 hover:border-pink-100"
                        }`}
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white ${sel ? "bg-gradient-to-br from-pink-500 to-rose-400" : "bg-gradient-to-br from-slate-400 to-slate-500"}`}>
                          {initialsOf(v.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-xs font-semibold ${sel ? "text-pink-800" : "text-slate-700"}`}>{v.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{v.mobileNumber ?? ""}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selected && (
                  <button
                    onClick={handleCheckout}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-rose-200 transition hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? "Checking out…" : `Confirm Exit — ${selected.fullName}`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-600 to-rose-500 shadow-lg shadow-pink-300/50 transition-all hover:scale-105 active:scale-95"
      >
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[9px] font-bold text-white">{count > 9 ? "9+" : count}</span>
        )}
      </button>
    </div>
  );
}

// Ported from the standalone VMS project's AdminDashboard.jsx + VisitorsAdminPanel.jsx
// + the ReceptionistWidget from Home.jsx, consolidated into one page. Not
// ported: the reception "approve/escalate" queue (VISIT_STATUS.RECEPTION_APPROVED/
// ESCALATED) — the original frontend never actually called that endpoint anywhere;
// verified visitors go straight to HOST_PENDING, so it was already dead in the
// source app. Also not ported: Reports/Settings/Users tabs (AdminReports.jsx,
// Adminsettings.jsx, UsersManagement.jsx) and the dark-themed, unused
// VisitorDetails.jsx page.
export default function VmsAdminPanel() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.roles?.vms === "admin";
  const tab = location.pathname.endsWith("/audit") ? "audit" : location.pathname.endsWith("/visitors") ? "visitors" : "overview";
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    API.get("/vms/admin/analytics")
      .then(({ data }) => setAnalytics(data))
      .catch(() => {});
  }, [isAdmin]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        {tab === "overview" && isAdmin && <Overview analytics={analytics} />}
        {tab === "visitors" && <VisitorsBrowser />}
        {tab === "audit" && isAdmin && <AuditLog />}
      </div>

      <QuickCheckoutWidget />
    </div>
  );
}
