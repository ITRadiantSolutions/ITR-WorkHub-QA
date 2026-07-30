import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext.jsx";
import { notificationAPI } from "../services/notificationApi.js";
import {
  getCompactNotificationText,
  getActorName,
} from "../utils/notificationDisplay.js";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading, socket } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);
  const notificationsRef = useRef([]);
  const markingReadIdsRef = useRef(new Set());
  const livePopupTimerRef = useRef(null);
  const [livePopup, setLivePopup] = useState(null);
  const [popupVisible, setPopupVisible] = useState(false);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  /* ---------------------------------- */
  /* Badge / icon update helpers        */
  /* ---------------------------------- */
  const trySetAppBadge = useCallback(async (count) => {
    try {
      if (!("setAppBadge" in navigator)) return;
      await navigator.setAppBadge(Math.max(0, count));
    } catch {
      // Badge API is not supported everywhere; fail silently.
    }
  }, []);

  /* ---------------------------------- */
  /* Fetch unread badge count           */
  /* ---------------------------------- */
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || authLoading) return;
    try {
      const response = await notificationAPI.getUnreadCount();
      setUnreadCount(response?.data?.unreadCount || 0);
    } catch (error) {
      console.debug("Badge fetch failed:", error.message);
      setUnreadCount(0);
    }
  }, [isAuthenticated, authLoading]);

  /* ---------------------------------- */
  /* Fetch full notifications           */
  /* ---------------------------------- */
  const fetchNotifications = useCallback(
    async ({ unreadOnly = false, readOnly = false } = {}) => {
      if (!isAuthenticated || authLoading) return;
      try {
        setLoading(true);
        setError(null);
        const response = await notificationAPI.getNotifications({
          page: 1,
          limit: 20,
          unreadOnly,
          readOnly,
        });
        setNotifications(response?.data?.data || []);
        setUnreadCount(response?.data?.unreadCount || 0);
      } catch (error) {
        console.error(
          "Failed to fetch notifications:",
          error?.response?.data || error.message,
        );
        setError(
          error?.response?.data?.error || "Failed to load notifications.",
        );
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, authLoading],
  );

  /* ---------------------------------- */
  /* Mark as read                       */
  /* ---------------------------------- */
  const markAsRead = useCallback(async ({ notificationId, all = false }) => {
    if (notificationId && markingReadIdsRef.current.has(notificationId)) {
      return { success: true };
    }
    if (notificationId) {
      markingReadIdsRef.current.add(notificationId);
    }
    try {
      await notificationAPI.markAsRead({ notificationId, all });
      if (all) {
        setNotifications((prev) =>
          prev.map((item) => ({ ...item, isRead: true })),
        );
        setUnreadCount(0);
      } else if (notificationId) {
        const wasUnread = notificationsRef.current.some(
          (item) => item._id === notificationId && !item.isRead,
        );
        setNotifications((prev) =>
          prev.map((item) =>
            item._id === notificationId ? { ...item, isRead: true } : item,
          ),
        );
        if (wasUnread) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
      return { success: true };
    } catch (error) {
      console.error("Mark read failed:", error);
      return { success: false, error: error.message };
    } finally {
      if (notificationId) {
        markingReadIdsRef.current.delete(notificationId);
      }
    }
  }, []);

  /* ---------------------------------- */
  /* Clear all                          */
  /* ---------------------------------- */
  const clearAll = useCallback(async () => {
    try {
      await notificationAPI.clearNotifications();
      setNotifications((prev) => prev.filter((item) => item.isRead));
      setUnreadCount(0);
      return { success: true };
    } catch (error) {
      console.error("Clear failed:", error);
      return { success: false, error: error.message };
    }
  }, []);

  /* ---------------------------------- */
  /* Initialize after login             */
  /* ---------------------------------- */
  useEffect(() => {
    if (isAuthenticated && !authLoading && !initialized) {
      const init = async () => {
        // The notifications response already includes unreadCount.
        // Avoid a duplicate count query during application startup.
        await fetchNotifications();
        setInitialized(true);
      };
      init();
    }
    if (!isAuthenticated && initialized) {
      setNotifications([]);
      setUnreadCount(0);
      setInitialized(false);
      setError(null);
    }
  }, [
    isAuthenticated,
    authLoading,
    initialized,
    fetchUnreadCount,
    fetchNotifications,
  ]);

  /* Refresh unread count when tab becomes visible */
  useEffect(() => {
    if (!isAuthenticated || authLoading || !initialized) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") fetchUnreadCount();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () =>
      document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [isAuthenticated, authLoading, initialized, fetchUnreadCount]);

  /* ---------------------------------- */
  /* Update PWA app badge               */
  /* ---------------------------------- */
  useEffect(() => {
    if (!isAuthenticated || authLoading || !initialized) return;
    trySetAppBadge(unreadCount);
  }, [isAuthenticated, authLoading, initialized, unreadCount, trySetAppBadge]);

  /* ---------------------------------- */
  /* WebSocket real-time notifications  */
  /* ---------------------------------- */
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    socket.on("newNotification", (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      const compactText = getCompactNotificationText(notification);
      const actor = getActorName(notification);

      window.clearTimeout(livePopupTimerRef.current);
      setLivePopup({
        id: notification?._id || Date.now(),
        text: compactText,
        actor,
      });
      setPopupVisible(true);
      livePopupTimerRef.current = window.setTimeout(() => {
        setPopupVisible(false);
        // Give the exit animation time to finish before unmounting
        window.setTimeout(() => setLivePopup(null), 400);
      }, 2000);
    });

    return () => {
      window.clearTimeout(livePopupTimerRef.current);
      socket.off("newNotification");
    };
  }, [socket, isAuthenticated]);

  /* Dismiss helper — fades out before unmounting */
  const dismissPopup = useCallback(() => {
    window.clearTimeout(livePopupTimerRef.current);
    setPopupVisible(false);
    window.setTimeout(() => setLivePopup(null), 400);
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    initialized,
    error,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* -------------------------------------------------- *
       *  Live notification toast                            *
       * -------------------------------------------------- */}
      {livePopup && (
        <div
          role="status"
          aria-live="polite"
          style={{
            transition:
              "opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.2,0.64,1)",
            opacity: popupVisible ? 1 : 0,
            transform: popupVisible
              ? "translateY(0) scale(1)"
              : "translateY(10px) scale(0.97)",
          }}
          className="
            group
            pointer-events-auto
            fixed
            bottom-5
            right-5
            z-[99999]
            flex
            w-[340px]
            max-w-[calc(100vw-20px)]
            items-start
            gap-3
            rounded-2xl
            border
            border-slate-200/80
            bg-white/96
            px-3.5
            py-3
            shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.06)]
            backdrop-blur-xl
          "
        >
          {/* Accent bar */}
          <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-blue-500 to-indigo-500" />

          {/* Avatar */}
          <div className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold text-white shadow-sm">
            {(livePopup.actor || "N").charAt(0).toUpperCase()}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 py-0.5">
            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide leading-none mb-1">
              New notification
            </p>
            <p className="text-[13px] leading-snug text-slate-700 line-clamp-2">
              <span className="font-semibold text-slate-900">
                {livePopup.actor || "Someone"}
              </span>{" "}
              {livePopup.text}
            </p>
          </div>

          {/* Dismiss */}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={dismissPopup}
            className="
              -mt-0.5
              flex
              h-6
              w-6
              shrink-0
              items-center
              justify-center
              rounded-md
              text-slate-300
              transition-colors
              duration-150
              hover:bg-slate-100
              hover:text-slate-600
            "
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  }
  return context;
};
