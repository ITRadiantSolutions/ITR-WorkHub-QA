import { useState, useRef, useEffect, useCallback } from "react";
import { useNotifications } from "../context/NotificationContext.jsx";
import { toast } from "sonner";
import {
  formatTimeAgo,
  getActivityClass,
  getActivityLabel,
  getActorName,
  getNotificationMessage,
  getNotificationSummary,
} from "../utils/notificationDisplay.js";
import Icons from "./Icons.jsx";
// ── Icons ─────────────────────────────────────────────────────────────────────

// ── Notification type config ──────────────────────────────────────────────────
function getTypeConfig(type = "") {
  if (type.startsWith("task"))
    return {
      icon: Icons.Tasks,
      bg: "bg-blue-500",
      light: "bg-blue-50 text-blue-600",
    };
  if (type.startsWith("project"))
    return {
      icon: Icons.Projects,
      bg: "bg-violet-500",
      light: "bg-violet-50 text-violet-600",
    };
  if (type.startsWith("team"))
    return {
      icon: Icons.Team,
      bg: "bg-emerald-500",
      light: "bg-emerald-50 text-emerald-600",
    };
  return {
    icon: Icons.Zap,
    bg: "bg-slate-500",
    light: "bg-slate-100 text-slate-600",
  };
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name }) {
  const colors = [
    "bg-blue-500",
    "bg-violet-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
  ];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div
      className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "task", label: "Tasks" },
  { id: "project", label: "Projects" },
  { id: "team", label: "Team" },
];

// ── Single notification row ───────────────────────────────────────────────────
function NotificationItem({ notification, onMarkRead }) {
  const itemRef = useRef(null);
  const autoMarkedRef = useRef(false);
  const cfg = getTypeConfig(notification.type);
  const actor = getActorName(notification);
  const message = getNotificationMessage(notification);
  const summary = getNotificationSummary(notification);
  const isUnread = !notification.isRead;

  useEffect(() => {
    if (!isUnread || autoMarkedRef.current || !itemRef.current) return;
    if (!("IntersectionObserver" in window)) return;

    let markTimer;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.65) return;

        autoMarkedRef.current = true;
        markTimer = window.setTimeout(() => {
          onMarkRead(notification._id);
        }, 500);
        observer.disconnect();
      },
      { threshold: [0.65] },
    );

    observer.observe(itemRef.current);

    return () => {
      window.clearTimeout(markTimer);
      observer.disconnect();
    };
  }, [isUnread, notification._id, onMarkRead]);

  return (
    <div
      ref={itemRef}
      className={`relative group px-4 py-3.5 border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50 ${isUnread ? "bg-blue-50/40" : ""}`}
    >
      {/* Unread dot */}
      {isUnread && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500" />
      )}

      <div className="flex items-start gap-3 pl-1">
        {/* Type icon + avatar */}
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${isUnread ? cfg.bg : "bg-slate-200"}`}
          >
            <cfg.icon />
          </div>
          {actor && (
            <div className="absolute -bottom-1.5 -right-1.5">
              <Avatar name={actor} />
            </div>
          )}
        </div>

        {/* Text */}
    <div className="flex-1 min-w-0">
  {/* Activity Badge */}
  {notification.activityType && (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide mb-1.5 ${
        getActivityClass?.(notification.activityType) || cfg.light
      }`}
    >
      {getActivityLabel?.(notification.activityType) ||
        notification.activityType}
    </span>
  )}

  {/* Title */}
  <h4
    className={`truncate text-[13px] font-semibold leading-5 ${
      isUnread ? "text-slate-900" : "text-slate-700"
    }`}
  >
    {notification.title}
  </h4>

  {/* Summary */}
  {(message || summary) && (
    <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
      {message || summary}
    </p>
  )}

  {/* Footer */}
  <div className="mt-2 flex items-center justify-between gap-2">
    {actor ? (
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-[9px] font-bold text-white shrink-0">
          {actor.charAt(0).toUpperCase()}
        </div>

        <span className="truncate text-[10px] font-semibold text-slate-600">
          {actor}
        </span>
      </div>
    ) : (
      <div />
    )}

    <div className="flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-400">
      <Icons.Clock className="h-3 w-3" />
      <span>{formatTimeAgo(notification.createdAt)}</span>
    </div>
  </div>
</div>

        {/* Mark-read button */}
        {isUnread && (
          <button
            onClick={() => onMarkRead(notification._id)}
            title="Mark as read"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-100"
          >
            <Icons.Check />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    clearAll,
    fetchUnreadCount,
    fetchNotifications,
  } = useNotifications();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Bell shake animation when new notifs arrive
  const [shake, setShake] = useState(false);
  const prevCount = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > prevCount.current) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  const handleMarkAllRead = async () => {
    const res = await markAsRead({ all: true });
    if (res.success) toast.success("All marked as read");
  };

const handleClearAll = () => {
  toast.warning(
    "Are you sure you want to clear all unread notifications?",
    {
      duration: 6000,

      action: {
        label: "Clear All",
        onClick: async () => {
          try {
            const res = await clearAll();

            if (res?.success) {
              toast.success("Unread notifications cleared");
            } else {
              toast.error("Failed to clear notifications");
            }
          } catch {
            toast.error("Failed to clear notifications");
          }
        },
      },

      cancel: {
        label: "Cancel",
      },
    },
  );
};

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchUnreadCount(), fetchNotifications()]);
    setRefreshing(false);
    toast.success("Refreshed", { duration: 1500 });
  }, [fetchUnreadCount, fetchNotifications]);

  const handleMarkOneRead = useCallback(async (id) => {
    await markAsRead({ notificationId: id });
  }, [markAsRead]);

  // Apply filter
  const filtered = notifications
    .filter((n) => {
      if (filter === "all") return true;
      if (filter === "unread") return !n.isRead;
      return n.type?.startsWith(filter);
    })
    .slice(0, 20);

  const unreadInFilter = notifications.filter(
    (n) =>
      !n.isRead &&
      (filter === "all" || filter === "unread" || n.type?.startsWith(filter)),
  ).length;

  return (
    <div
      className="relative"
      ref={dropdownRef}
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
    >
      {/* ── Bell button ─────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={`${unreadCount} unread notifications`}
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
          open
            ? "bg-blue-700 text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
        style={{ animation: shake ? "bellShake 0.5s ease" : undefined }}
      >
        <Icons.Bell hasUnread={unreadCount > 0} />

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold rounded-full shadow-md transition-all ${
              open ? "bg-white text-slate-900" : "bg-red-500 text-white"
            }`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}

        {/* Active ring */}
        {open && (
          <span className="absolute inset-0 rounded-xl ring-2 ring-slate-900/20" />
        )}
      </button>

      {/* ── Dropdown ────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            className="absolute top-full right-0 mt-2 w-[380px] z-50 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              border: "1px solid rgba(15,23,42,0.1)",
              background: "white",
              animation: "dropIn 0.18s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="px-4 py-3.5 flex items-center justify-between bg-white border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Refresh */}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Refresh"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                >
                  <span
                    style={{
                      animation: refreshing
                        ? "spin 0.8s linear infinite"
                        : undefined,
                      display: "inline-block",
                    }}
                  >
                    <Icons.Refresh />
                  </span>
                </button>
                {/* Mark all read */}
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={loading}
                    title="Mark all read"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition disabled:opacity-50"
                  >
                    <Icons.CheckAll />
                  </button>
                )}
                {/* Clear unread */}
                {unreadCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={loading}
                    title="Clear unread"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <Icons.Trash />
                  </button>
                )}
                {/* Close */}
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <Icons.X />
                </button>
              </div>
            </div>

            {/* ── Filter tabs ──────────────────────────────────────── */}
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1 overflow-x-auto scrollbar-none">
              {FILTERS.map((f) => {
                const cnt =
                  f.id === "all"
                    ? notifications.length
                    : f.id === "unread"
                      ? notifications.filter((n) => !n.isRead).length
                      : notifications.filter((n) => n.type?.startsWith(f.id))
                          .length;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                      filter === f.id
                        ? "bg-blue-700 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                    {cnt > 0 && (
                      <span
                        className={`text-[10px] px-1 rounded-full font-bold ${filter === f.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}
                      >
                        {cnt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Body ────────────────────────────────────────────── */}
            <div className="max-h-[400px] overflow-y-auto overscroll-contain">
              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-10">
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                </div>
              )}

              {/* Empty state */}
              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">
                    {filter === "all"
                      ? "All caught up!"
                      : `No ${filter} notifications`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {filter === "all"
                      ? "New activity will appear here"
                      : "Switch to All to see everything"}
                  </p>
                  {filter !== "all" && (
                    <button
                      onClick={() => setFilter("all")}
                      className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                    >
                      View all →
                    </button>
                  )}
                </div>
              )}

              {/* Notification items */}
              {!loading && filtered.length > 0 && (
                <div>
                  {/* Section header if unread present */}
                  {unreadInFilter > 0 && filter !== "unread" && (
                    <div className="px-4 py-2 flex items-center justify-between bg-blue-50/60 border-b border-blue-100">
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
                        {unreadInFilter} Unread
                      </span>
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
                      >
                        Mark all read
                      </button>
                    </div>
                  )}
                  {filtered.map((n) => (
                    <NotificationItem
                      key={n._id}
                      notification={n}
                      onMarkRead={handleMarkOneRead}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────────────── */}
            {!loading && notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">
                  {filtered.length} of {notifications.length} shown
                </p>
                <div className="flex items-center gap-2">
                  {filter !== "all" && (
                    <button
                      onClick={() => setFilter("all")}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition"
                    >
                      Show all
                    </button>
                  )}
                  {unreadCount > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:text-red-700 transition"
                    >
                      <Icons.Trash />
                      Clear {unreadCount} unread
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Keyframe styles ─────────────────────────────────────────── */}
      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes bellShake {
          0%,100% { transform: rotate(0deg);   }
          20%     { transform: rotate(-12deg);  }
          40%     { transform: rotate(10deg);   }
          60%     { transform: rotate(-8deg);   }
          80%     { transform: rotate(6deg);    }
        }
        @keyframes spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default NotificationBell;
