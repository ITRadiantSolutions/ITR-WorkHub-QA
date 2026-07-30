import { useEffect, useRef, useState, useCallback } from "react";
import { adminNotificationAPI } from "../services/adminNotificationApi";
import { DATA_MUTATED_EVENT } from "../services/api";

export default function useAdminSidebarTabCounts({
  employeeId,
  performedById,
  projectId,
}) {
  const [tabCounts, setTabCounts] = useState({
    projects: 0,
    tasks: 0,
    sprints: 0,
    bugs: 0,
    notifications: 0,
  });

  const [loading, setLoading] = useState(false);

  const inFlightRef = useRef(false);
  const mutationTimerRef = useRef(null);

  const fetchTabCounts = useCallback(async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setLoading(true);

    try {
      const res = await adminNotificationAPI.getAdminSidebarTabsCounts({
        employeeId: employeeId || undefined,
        performedById: performedById || undefined,
        projectId: projectId || undefined,
        noCache: false,
      });

      setTabCounts(
        res?.data?.tabs || {
          projects: 0,
          tasks: 0,
          sprints: 0,
          bugs: 0,
          notifications: 0,
        },
      );
    } catch (error) {
      console.error("Failed to fetch admin sidebar tab counts", error);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [employeeId, performedById, projectId]);

  // Initial load
  useEffect(() => {
    fetchTabCounts();
  }, [fetchTabCounts]);

  // Refresh whenever data changes anywhere in the app
  useEffect(() => {
    const handleMutation = () => {
      window.clearTimeout(mutationTimerRef.current);
      mutationTimerRef.current = window.setTimeout(fetchTabCounts, 150);
    };
    window.addEventListener(DATA_MUTATED_EVENT, handleMutation);
    return () => {
      window.clearTimeout(mutationTimerRef.current);
      window.removeEventListener(DATA_MUTATED_EVENT, handleMutation);
    };
  }, [fetchTabCounts]);

  // Socket/data events keep counts current. Refresh once when the tab becomes
  // visible instead of polling every five seconds in the background.
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") fetchTabCounts();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () =>
      document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [fetchTabCounts]);
  return {
    tabCounts,
    loading,
    fetchTabCounts,
    setTabCounts,
  };
}
