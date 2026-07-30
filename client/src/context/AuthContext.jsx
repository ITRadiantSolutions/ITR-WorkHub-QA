import {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
  useMemo,
} from "react";
import io from "socket.io-client";
import { clearApiGetCache, DATA_MUTATED_EVENT } from "../services/api.js";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const userRef = useRef(null);
  const refreshUserInFlightRef = useRef(false);
  const lastUserRefreshAtRef = useRef(0);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const login = useCallback((userData, authToken, options = {}) => {
    const currentUserStr = localStorage.getItem("user");
    const currentToken = localStorage.getItem("token");

    if (currentUserStr && currentToken === authToken) {
      try {
        if (
          JSON.stringify(JSON.parse(currentUserStr)) ===
          JSON.stringify(userData)
        ) {
          console.log("Login: Already authenticated, skipping");
          return;
        }
      } catch {
        localStorage.removeItem("user");
      }
    }

    setUser(userData);
    setToken(authToken);
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setError(null);

    const msStart = localStorage.getItem("ms_login_start");
    if (msStart) {
      localStorage.removeItem("ms_login_start");
      console.log("MS Login flow completed:", msStart);
    }

    if (!options.autoRedirect) {
      console.log("AuthContext: Auto-redirect disabled for success page");
      return;
    }

    // Post-login always lands on the module hub (Timesheet / PMS / FlowTrack
    // tiles) instead of jumping straight into a role-specific dashboard.
    console.log("Auto-redirect to: /hub");
    window.location.href = window.location.origin + "/hub";
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get("token");
    const userStr = urlParams.get("user");

    if (authToken && userStr) {
      try {
        console.log("AuthContext parsing MS params");
        const userData = JSON.parse(decodeURIComponent(userStr));
        console.log("MS login data:", userData.name, userData.role);

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
        login(userData, authToken, { autoRedirect: false });
        setLoading(false);
        return;
      } catch (e) {
        console.error("MS param parse error:", e);
      }
    }

    const storedToken = localStorage.getItem("token");
    const storedUserStr = localStorage.getItem("user");
    if (storedToken && storedUserStr) {
      try {
        const userData = JSON.parse(storedUserStr);
        if (userData._id && userData.role && storedToken.length > 10) {
          setToken(storedToken);
          setUser({ ...userData, id: userData._id || userData.id });
          console.log("Sync restore:", userData.role);
        }
      } catch {
        localStorage.clear();
      }
    }

    setLoading(false);
  }, [login]);

  // Refresh user role/details without requiring logout/login.
  // Requests are deduplicated and normal refreshes are limited to once per 5 minutes.
  const refreshUser = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (refreshUserInFlightRef.current) return userRef.current;
    if (!force && now - lastUserRefreshAtRef.current < 5 * 60 * 1000) {
      return userRef.current;
    }

    const tokenToUse = localStorage.getItem("token");
    if (!tokenToUse) return;

    refreshUserInFlightRef.current = true;
    lastUserRefreshAtRef.current = now;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const freshUser = data?.user;
      if (!freshUser) return;

      const previousRole = userRef.current?.role;
      setUser(freshUser);
      localStorage.setItem("user", JSON.stringify(freshUser));

      if (previousRole && previousRole !== freshUser.role) {
        clearApiGetCache();
        window.dispatchEvent(
          new CustomEvent("flowtrack:auth-role-changed", {
            detail: { previousRole, newRole: freshUser.role },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("flowtrack:data-mutated", {
            detail: { reason: "role-changed", timestamp: Date.now() },
          }),
        );
      }
      return freshUser;
    } catch {
      return;
    } finally {
      refreshUserInFlightRef.current = false;
    }
  }, []);

  // After restoring token/user, refresh user from DB so role changes are reflected
  useEffect(() => {
    if (!token) return;
    refreshUser({ force: true });
  }, [token, refreshUser]);


  // Listen for admin-triggered role updates so dashboard updates instantly
  useEffect(() => {
    const onRoleChanged = async (e) => {
      try {
        // If event includes target id, only refresh when it matches
        const targetUserId = e?.detail?.userId;
        const currentUserId = user?._id || user?.id;

        if (
          targetUserId &&
          currentUserId &&
          String(targetUserId) !== String(currentUserId)
        ) {
          return;
        }

        await refreshUser({ force: true });
      } catch {
        // ignore
      }
    };

    window.addEventListener("flowtrack:user-role-changed", onRoleChanged);
    return () =>
      window.removeEventListener("flowtrack:user-role-changed", onRoleChanged);
  }, [refreshUser, user?._id, user?.id]);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      return;
    }

    if (!socketRef.current?.connected) {
      socketRef.current = io(`${import.meta.env.VITE_API_URL}`, {
        auth: { token },
      });

      socketRef.current.on("user:role-changed", () => {
        refreshUser({ force: true });
      });

      const notifyRealtimeRefresh = (event = {}) => {
        clearApiGetCache();
        window.dispatchEvent(
          new CustomEvent(DATA_MUTATED_EVENT, {
            detail: {
              source: "socket",
              entity: "task",
              ...event,
              timestamp: Date.now(),
            },
          }),
        );
      };

      socketRef.current.on("task:changed", notifyRealtimeRefresh);
      socketRef.current.on("connect", () => {
        if (socketRef.current?.recovered) {
          notifyRealtimeRefresh({ action: "reconnected" });
        }
      });
      setSocket(socketRef.current);
      console.log("Socket: Connected once on valid token");
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, [token, refreshUser]);

  const logout = useCallback((options = {}) => {
    setUser(null);
    setToken(null);
    localStorage.clear();
    setError(null);

    if (options?.redirect !== false) {
      // Use hard navigation to fully reset app state
      window.location.href = window.location.origin + "/";
    }
  }, []);

  // Listen for token invalidation events coming from the API layer
  useEffect(() => {
    const onAuthInvalid = () => {
      try {
        logout({ redirect: true });
      } catch {
        // ignore
      }
    };

    window.addEventListener("flowtrack:auth-invalid", onAuthInvalid);
    return () =>
      window.removeEventListener("flowtrack:auth-invalid", onAuthInvalid);
  }, [logout]);

  const setAuthError = (errorMsg) => {
    setError(errorMsg);
  };

  const isAuthenticated = !!token && !!user;

  const hasRole = useCallback(
    (role) => {
      if (Array.isArray(role)) {
        return role.includes(user?.role);
      }
      return user?.role === role;
    },
    [user?.role],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authLoading: loading,
      error,
      login,
      logout,
      refreshUser,
      setAuthError,
      isAuthenticated,
      hasRole,
      socket,
    }),
    [
      user,
      token,
      loading,
      error,
      login,
      logout,
      refreshUser,
      isAuthenticated,
      hasRole,
      socket,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
