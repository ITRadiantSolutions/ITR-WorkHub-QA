import { useState, useEffect, useMemo, useCallback } from "react";

import {
  API,
  DATA_MUTATED_EVENT,
  getRejectedUsers,
  getEditedUsers,
  reApproveUser,
  updateUser,
  deleteUser,
} from "../services/api";
import { toast } from "sonner";
import Icons from "../components/Icons";
import { useAuth } from "../context/AuthContext";

// NOTE: used to refresh role immediately after admin role change

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalizeUsers = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.users)) return payload.users;
  return [];
};

function roleColor(role) {
  return (
    {
      ADMIN: "bg-red-50 text-red-700 border border-red-200",
      PM: "bg-violet-50 text-violet-700 border border-violet-200",
      DEVELOPER: "bg-blue-50 text-blue-700 border border-blue-200",
      QA: "bg-purple-50 text-purple-700 border border-purple-200",
      BUSINESS_USER: "bg-teal-50 text-teal-700 border border-teal-200",
    }[role] || "bg-slate-100 text-slate-600 border border-slate-200"
  );
}

const ROLE_LABELS = {
  ADMIN: "Admin",
  PM: "Project Manager",
  DEVELOPER: "Developer",
  QA: "QA Engineer",
  BUSINESS_USER: "Business Client",
};

const inputCls =
  "w-full border border-slate-200 bg-white px-3 py-2 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder-slate-400 transition";

// ── Micro components ──────────────────────────────────────────────────────────
function Avatar({ name, size = "sm" }) {
  const colors = [
    "bg-indigo-600",
    "bg-violet-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
  ];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const sz = size === "lg" ? "w-11 h-11 text-[15px]" : "w-7 h-7 text-[11px]";
  return (
    <div
      className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function ActionBtn({ onClick, disabled, title, colorCls, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 ${colorCls}`}
    >
      {children}
    </button>
  );
}

// ── Confirm toast helper ──────────────────────────────────────────────────────
function confirmToast({
  icon,
  iconBg,
  title,
  desc,
  note,
  actionLabel,
  actionCls,
  onAction,
}) {
  toast.custom(
    (t) => (
      <div className="w-[340px] rounded-xl border border-slate-200 bg-white shadow-2xl p-4">
        <div className="flex items-start gap-3 mb-4">
          <div
            className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-[13px] font-bold text-slate-900 mb-0.5">
              {title}
            </h3>
            <p className="text-[12px] text-slate-500 leading-relaxed">{desc}</p>
            {note && (
              <p className="text-[11px] font-semibold text-red-500 mt-1">
                {note}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => toast.dismiss(t)}
            className="h-8 px-3.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              toast.dismiss(t);
              onAction();
            }}
            className={`h-8 px-3.5 rounded-lg text-white text-[12px] font-semibold transition ${actionCls}`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    ),
    { duration: Infinity, position: "top-center" },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeesPage({ searchRequest }) {
  const { refreshUser, user: authUser } = useAuth();

  const [activeTab, setActiveTab] = useState("pending");
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [rejectedUsers, setRejectedUsers] = useState([]);
  const [editedUsers, setEditedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const isSearchingRef = useMemo(() => ({ current: false }), []);

  useEffect(() => {
    if (searchRequest?.type !== "user") return;
    setActiveTab(searchRequest.userTab || "approved");
    setSearch(searchRequest.query || "");
    setShowViewModal(false);
    setShowEditModal(false);
    setSelectedUser(null);
  }, [searchRequest]);

  useEffect(() => {
    if (!search.trim()) {
      isSearchingRef.current = false;
      setDebouncedSearch("");
      return;
    }

    isSearchingRef.current = true;

    const t = setTimeout(() => {
      setDebouncedSearch(search);
      isSearchingRef.current = false;
    }, 250);

    return () => {
      clearTimeout(t);
      // keep ref true while user is still typing
      isSearchingRef.current = true;
    };
  }, [search, isSearchingRef]);

  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "" });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  // ── Parallel fetch (fast) ───────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (silent && isSearchingRef.current) return;

    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [pendRes, allRes, rejRes, editRes] = await Promise.allSettled([
      API.get("/auth/pending-users"),
      API.get("/users"),
      getRejectedUsers(),
      getEditedUsers(),
    ]);

    if (pendRes.status === "fulfilled")
      setPendingUsers(normalizeUsers(pendRes.value.data));

    if (allRes.status === "fulfilled") {
      const approved = normalizeUsers(allRes.value.data)
        .filter((u) => u.approvalStatus === "Approved")
        .map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          signupDate: new Date(u.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          provider: u.provider,
        }));
      setApprovedUsers(approved);
    }

    if (rejRes.status === "fulfilled")
      setRejectedUsers(normalizeUsers(rejRes.value.data));

    if (editRes.status === "fulfilled")
      setEditedUsers(normalizeUsers(editRes.value.data));

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);
  useEffect(() => {
    const h = () => fetchAll(true);
    window.addEventListener(DATA_MUTATED_EVENT, h);
    return () => window.removeEventListener(DATA_MUTATED_EVENT, h);
  }, [fetchAll]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const tabMap = useMemo(
    () => ({
      pending: pendingUsers,
      approved: approvedUsers,
      rejected: rejectedUsers,
      edited: editedUsers,
    }),
    [pendingUsers, approvedUsers, rejectedUsers, editedUsers],
  );

  const currentUsers = tabMap[activeTab] || [];

  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return currentUsers;

    return currentUsers.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q),
    );
  }, [currentUsers, debouncedSearch]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const setActing = (id, state) =>
    setActionLoading((p) => ({ ...p, [id]: state }));

  const handleApprove = (id, name = "User") =>
    confirmToast({
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      iconBg: "bg-emerald-50",
      title: "Approve User",
      actionCls: "bg-emerald-600 hover:bg-emerald-700",
      desc: `${name} will be able to log in and access the platform.`,
      actionLabel: "Approve",
      onAction: async () => {
        setActing(id, "approve");
        const t = toast.loading("Approving...");
        try {
          await API.put(`/auth/${id}/approve`);
          toast.dismiss(t);
          toast.success(`${name} approved`);
          await Promise.all([fetchPendingUsers(), fetchApprovedUsers()]);
        } catch {
          toast.dismiss(t);
          toast.error("Approval failed");
        } finally {
          setActing(id, null);
        }
      },
    });

  const handleReject = (id, name = "User") =>
    confirmToast({
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ),
      iconBg: "bg-red-50",
      title: "Reject Request",
      actionCls: "bg-red-600 hover:bg-red-700",
      desc: `${name}'s account request will be rejected.`,
      note: "This can be reversed later by an admin.",
      actionLabel: "Reject",
      onAction: async () => {
        setActing(id, "reject");
        const t = toast.loading("Rejecting...");
        try {
          await API.put(`/auth/${id}/reject`);
          toast.dismiss(t);
          toast.success(`${name} rejected`);
          await Promise.all([fetchPendingUsers(), fetchRejectedUsers()]);
        } catch {
          toast.dismiss(t);
          toast.error("Reject failed");
        } finally {
          setActing(id, null);
        }
      },
    });

  const handleDelete = (id) =>
    confirmToast({
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      iconBg: "bg-red-50",
      title: "Delete User",
      actionCls: "bg-red-600 hover:bg-red-700",
      desc: "This will permanently remove the user.",
      note: "This action cannot be undone.",
      actionLabel: "Delete",
      onAction: async () => {
        setActing(id, "delete");
        try {
          await deleteUser(id);
          toast.success("User deleted");
          await fetchAll(true);
        } catch {
          toast.error("Delete failed");
        } finally {
          setActing(id, null);
        }
      },
    });

  const handleReApprove = async (id) => {
    setActing(id, "reapprove");
    try {
      await reApproveUser(id);
      toast.success("User re-approved");
      await Promise.all([fetchRejectedUsers(), fetchApprovedUsers()]);
    } catch {
      toast.error("Re-approve failed");
    } finally {
      setActing(id, null);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      const r = await API.get("/auth/pending-users");
      setPendingUsers(normalizeUsers(r.data));
    } catch (e) {
      console.error("Failed to fetch pending users", e);
    }
  };
  const fetchApprovedUsers = async () => {
    try {
      const r = await API.get("/users");
      setApprovedUsers(
        normalizeUsers(r.data)
          .filter((u) => u.approvalStatus === "Approved")
          .map((u) => ({
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            signupDate: new Date(u.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            provider: u.provider,
          })),
      );
    } catch (e) {
      console.error("Failed to fetch approved users", e);
    }
  };
  const fetchRejectedUsers = async () => {
    try {
      const r = await getRejectedUsers();
      setRejectedUsers(normalizeUsers(r.data));
    } catch (e) {
      console.error("Failed to fetch rejected users", e);
    }
  };

  const handleView = (id) => {
    const u = currentUsers.find((u) => (u.id || u._id) === id);
    if (!u) return;
    setSelectedUser(u);
    setShowViewModal(true);
  };

  const handleEdit = (id) => {
    const u = currentUsers.find((u) => (u.id || u._id) === id);
    if (!u) return;
    setSelectedUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updatedUserId = selectedUser?.id || selectedUser?._id;
      await updateUser(updatedUserId, editForm);
      const currentUserId = authUser?._id || authUser?.id;

      // Notify app that a user was updated
      window.dispatchEvent(
        new CustomEvent("flowtrack:user-role-changed", {
          detail: {
            userId: updatedUserId,
          },
        }),
      );

      toast.success(`${editForm.name} updated`);
      setShowEditModal(false);

      await fetchAll(true);

      // If current logged-in user was updated
      if (
        updatedUserId &&
        currentUserId &&
        String(updatedUserId) === String(currentUserId)
      ) {
        const fresh = await refreshUser();

        const newRole = fresh?.role || editForm.role;

        if (fresh) {
          setTimeout(() => {
            localStorage.setItem("user", JSON.stringify(fresh));
          }, 100);
        }

        const routes = {
          ADMIN: "/admin",
          PM: "/Project-manager",
          DEVELOPER: "/developer",
          QA: "/qa",
          BUSINESS_USER: "/business",
        };

        const nextPath = routes[newRole] || "/business";

        setTimeout(() => {
          if (window.location.pathname !== nextPath) {
            window.location.replace(nextPath);
          }
        }, 300);
      }
    } catch (err) {
      console.error("Update User Error:", err);

      toast.error(err?.response?.data?.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  // ── Tab config ──────────────────────────────────────────────────────────────
  const tabs = [
    {
      id: "pending",
      label: "Pending",
      count: pendingUsers.length,
      activeCls: "bg-amber-500 text-white",
      dotCls: "bg-white/30",
    },
    {
      id: "approved",
      label: "Approved",
      count: approvedUsers.length,
      activeCls: "bg-emerald-600 text-white",
      dotCls: "bg-white/30",
    },
    {
      id: "rejected",
      label: "Rejected",
      count: rejectedUsers.length,
      activeCls: "bg-red-500 text-white",
      dotCls: "bg-white/30",
    },
    {
      id: "edited",
      label: "Edited",
      count: editedUsers.length,
      activeCls: "bg-indigo-600 text-white",
      dotCls: "bg-white/30",
    },
  ];

  const statusBadge = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    rejected: "bg-red-50 text-red-700 border border-red-200",
    edited: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
        <p className="text-[12px] text-slate-400">Loading users...</p>
      </div>
    );

  return (
    <div className="w-full space-y-1">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 mt-[1%] flex-wrap">
        <div>
          <h2 className="text-[17px] font-bold text-slate-900">
            User Management
          </h2>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          title="Refresh"
          className="
    flex items-center gap-2
    h-9 px-3
    rounded-xl
    border border-slate-200
    bg-white
    text-sm font-medium text-slate-600
    hover:bg-slate-50 hover:text-slate-900
    transition-all
    disabled:opacity-50 disabled:cursor-not-allowed
  "
        >
          <Icons.Refresh spin={refreshing} />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tabs.map((tab, i) => {
          const colors = [
            {
              dark: "bg-slate-100 border-slate-200",
              icon: "bg-slate-200 text-slate-500",
              val: "text-slate-800",
              lbl: "text-slate-500",
            },
            {
              dark: "bg-white border-slate-200",
              icon: "bg-emerald-50 text-emerald-500",
              val: "text-slate-800",
              lbl: "text-slate-400",
            },
            {
              dark: "bg-white border-slate-200",
              icon: "bg-red-50 text-red-500",
              val: "text-slate-800",
              lbl: "text-slate-400",
            },
            {
              dark: "bg-white border-slate-200",
              icon: "bg-indigo-50 text-indigo-500",
              val: "text-slate-800",
              lbl: "text-slate-400",
            },
          ][i];
          return (
            <div
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearch("");
              }}
              className={`rounded-xl border p-2 cursor-pointer  transition-all  ${colors.dark} ${activeTab === tab.id ? "ring-1 ring-blue-600 border-blue-600" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10.5px] font-semibold uppercase tracking-wider ${colors.lbl}`}
                >
                  {tab.label}
                </span>
                {tab.count > 0 && i === 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </div>
              <p className={`text-[24px] font-bold leading-none ${colors.val}`}>
                {tab.count}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Tab bar + Search ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        {/* Tabs pill group */}
        <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5 shrink-0 w-full sm:w-auto overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearch("");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? tab.activeCls
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/25" : "bg-slate-200 text-slate-600"}`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 w-full sm:w-auto">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icons.Search />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab} users…`}
            className="w-full h-9 pl-7 pr-8 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder-slate-400 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition"
            >
              <Icons.X />
            </button>
          )}
        </div>

        {search && (
          <span className="text-[12px] text-slate-400 whitespace-nowrap shrink-0">
            {filteredUsers.length} of {currentUsers.length}
          </span>
        )}
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Icons.Users />
            </div>
            <p className="text-[13px] font-semibold text-slate-700">
              {search ? "No users match your search" : `No ${activeTab} users`}
            </p>
            <p className="text-[12px] text-slate-400">
              {search
                ? "Try a different keyword"
                : activeTab === "pending"
                  ? "All requests processed"
                  : `No ${activeTab} records found`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    "User",
                    "Email",
                    "Role",
                    activeTab === "rejected"
                      ? "Rejected By"
                      : activeTab === "edited"
                        ? "Edited By"
                        : "Joined",
                    "Status",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wider text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((u) => {
                  const uid = u.id || u._id;
                  const isActing = actionLoading[uid];
                  const isPending = activeTab === "pending";
                  const isRejected = activeTab === "rejected";
                  const isEdited = activeTab === "edited";

const col4 = isRejected
  ? u.rejectedBy || u.rejectedByName || "Unknown"
  : isEdited
    ? u.editedBy || u.editedByName || "Unknown"
    : u.signupDate || "—";

                  return (
                    <tr
                      key={uid}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* User */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} />
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold text-slate-800 truncate">
                              {u.name}
                            </p>
                            {u.provider === "microsoft" && (
                              <span className="text-[9.5px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                                MSFT
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-2.5">
                        <span className="text-[12px] text-slate-500 truncate block max-w-[180px]">
                          {u.email}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${roleColor(u.role)}`}
                        >
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>

                      {/* Col 4 */}
                      <td className="px-4 py-2.5">
                        <span className="text-[12px] text-slate-500">
                          {col4}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${statusBadge[activeTab]}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          {activeTab.charAt(0).toUpperCase() +
                            activeTab.slice(1)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <ActionBtn
                            onClick={() => handleView(uid)}
                            title="View"
                            colorCls="text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          >
                            <Icons.Eye />
                          </ActionBtn>
                          <ActionBtn
                            onClick={() => handleEdit(uid)}
                            title="Edit"
                            colorCls="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Icons.Edit />
                          </ActionBtn>

                          {isPending && (
                            <>
                              <ActionBtn
                                onClick={() => handleApprove(uid, u.name)}
                                disabled={!!isActing}
                                title="Approve"
                                colorCls="text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
                              >
                                {isActing === "approve" ? (
                                  <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Icons.Check />
                                )}
                              </ActionBtn>
                              <ActionBtn
                                onClick={() => handleReject(uid, u.name)}
                                disabled={!!isActing}
                                title="Reject"
                                colorCls="text-red-500 hover:bg-red-50 border border-red-200"
                              >
                                {isActing === "reject" ? (
                                  <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Icons.X />
                                )}
                              </ActionBtn>
                            </>
                          )}

                          {isRejected && (
                            <>
                              <ActionBtn
                                onClick={() => handleReApprove(uid)}
                                disabled={!!isActing}
                                title="Re-approve"
                                colorCls="text-emerald-600 hover:bg-emerald-50 border border-emerald-200"
                              >
                                {isActing === "reapprove" ? (
                                  <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Icons.Check />
                                )}
                              </ActionBtn>
                              <ActionBtn
                                onClick={() => handleDelete(uid)}
                                disabled={!!isActing}
                                title="Delete"
                                colorCls="text-red-500 hover:bg-red-50 border border-red-200"
                              >
                                {isActing === "delete" ? (
                                  <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Icons.Trash />
                                )}
                              </ActionBtn>
                            </>
                          )}
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

      {/* ── View Modal ── */}
      {showViewModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowViewModal(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden">
            <div
              className="h-1 w-full"
              style={{
                backgroundColor: {
                  pending: "#f59e0b",
                  approved: "#10b981",
                  rejected: "#ef4444",
                  edited: "#6366f1",
                }[activeTab],
              }}
            />
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar name={selectedUser.name} />
                <div>
                  <p className="text-[13px] font-bold text-slate-900">
                    {selectedUser.name}
                  </p>
                  <span
                    className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${roleColor(selectedUser.role)}`}
                  >
                    {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition"
              >
                <Icons.X />
              </button>
            </div>
            <div className="p-5 space-y-2.5">
              {[
                { label: "Email", value: selectedUser.email },
                {
                  label: "Role",
                  value: ROLE_LABELS[selectedUser.role] || selectedUser.role,
                },
                { label: "Joined", value: selectedUser.signupDate || "—" },
                {
                  label: "Status",
                  value: activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
                },
                ...(selectedUser.provider
                  ? [
                      {
                        label: "Provider",
                        value: selectedUser.provider.toUpperCase(),
                      },
                    ]
                  : []),
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                >
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                    {row.label}
                  </span>
                  <span className="text-[12.5px] font-semibold text-slate-700">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowViewModal(false)}
                className="w-full h-9 rounded-lg bg-slate-100 text-slate-700 text-[13px] font-semibold hover:bg-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {showEditModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <Icons.Edit />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-900">
                    Edit User
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {selectedUser.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition"
              >
                <Icons.X />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-5 space-y-3.5">
              <Field label="Full Name">
                <input
                  className={inputCls}
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                />
              </Field>
              {/* <Field label="Email">
                <input
                  type="email"
                  disabled={selectedUser.provider === "microsoft"}
                  className={inputCls}
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  required
                />
              </Field> */}
              <Field label="Email">
                <input
                  type="email"
                  value={editForm.email}
                  disabled
                  readOnly
                  className={`${inputCls} cursor-not-allowed bg-slate-100 text-slate-500`}
                />
              </Field>
              {/* Role editing moved to HRMS Manage > FlowTrack (single centralized place for module access).
                  editForm.role stays populated from handleEdit so submitting this form still round-trips
                  the user's existing role unchanged — only name changes actually take effect here.
              <Field label="Role">
                <div className="relative">
                  <select
                    className={`${inputCls} appearance-none pr-8`}
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value })
                    }
                  >
                    <option value="PM">Project Manager</option>
                    <option value="DEVELOPER">Developer</option>
                    <option value="QA">QA Engineer</option>
                    <option value="BUSINESS_USER">Business Client</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icons.Chevron />
                  </div>
                </div>
              </Field>

              {editForm.role && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">New role:</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${roleColor(editForm.role)}`}
                  >
                    {ROLE_LABELS[editForm.role] || editForm.role}
                  </span>
                </div>
              )}
              */}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-9 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-r-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Icons.Save />
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="h-9 px-4 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
