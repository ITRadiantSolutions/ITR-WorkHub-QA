import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit, Trash2, Calendar, Clock, Save, Users, X, Search } from "lucide-react";
import Swal from "sweetalert2";
import { isPMS_HR } from "../../utils/pmsrolecheck";

const statusStyles = {
  Active: "bg-green-100 text-green-700 border-green-200",
  Upcoming: "bg-blue-100 text-blue-700 border-blue-200",
  Closed: "bg-gray-100 text-gray-600 border-gray-200",
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "";

const getStatusStyle = (status) => statusStyles[status] || statusStyles.Closed;

export default function CycleTable({
  cycles, loggedInUser, onEdit, onDelete,
  onToggleResponseRating, onUpdateDuration, durationDays,
  remainingTimes, onUpdateReportVisibility, allUsers = [],
}) {
  const isHRUser = loggedInUser && isPMS_HR(loggedInUser);
  // const isHRUser = loggedInUser && isPMS_HR(loggedInUser);

  const isExpired = (expiry) => expiry && new Date(expiry) < new Date();

  const [pending, setPending] = useState({});
  const [saving, setSaving] = useState({});
  const [extraDays, setExtraDays] = useState({});  // ← NEW

  // ── Popup state ──────────────────────────────────────────────────
  const [popup, setPopup] = useState(null);
  const [popupSearch, setPopupSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Initialize pending state from cycles
  useEffect(() => {
    const init = {};
    cycles.forEach((c) => {
      const empKey = `${c.id}-employee`;
      const mgrKey = `${c.id}-manager`;
      const empDur = durationDays[empKey] ?? "7";
      const mgrDur = durationDays[mgrKey] ?? "7";
      const empCustom = durationDays[`${c.id}-employee-custom`] ?? "";
      const mgrCustom = durationDays[`${c.id}-manager-custom`] ?? "";

      init[c.id] = {
        employeeEnabled: c.employeeResponseEnabled && !isExpired(c.employeeResponseExpiry),
        managerEnabled: c.managerResponseEnabled && !isExpired(c.managerResponseExpiry),
        employeeDuration: empDur,
        managerDuration: mgrDur,
        employeeCustomDuration: empCustom,
        managerCustomDuration: mgrCustom,
        reportVisibility: c.reportVisibility || "none",
        selectedEmployees: c.selectedEmployees ?? [],
        selectedManagers: c.selectedManagers ?? [],
        selectedReportUsers: c.reportVisibleTo ?? [],

        _orig: {
          employeeEnabled: c.employeeResponseEnabled && !isExpired(c.employeeResponseExpiry),
          managerEnabled: c.managerResponseEnabled && !isExpired(c.managerResponseExpiry),
          employeeDuration: empDur,
          managerDuration: mgrDur,
          employeeCustomDuration: empCustom,
          managerCustomDuration: mgrCustom,
          reportVisibility: c.reportVisibility || "none",
          selectedEmployees: c.selectedEmployees ?? [],
          selectedManagers: c.selectedManagers ?? [],
          selectedReportUsers: c.reportVisibleTo ?? [],
        },
      };
    });
    setPending(init);
  }, [cycles, durationDays]);

  const isDirty = (cycleId) => {
    const p = pending[cycleId];
    if (!p) return false;
    const o = p._orig;
    return (
      p.employeeEnabled !== o.employeeEnabled ||
      p.managerEnabled !== o.managerEnabled ||
      p.employeeDuration !== o.employeeDuration ||
      p.managerDuration !== o.managerDuration ||
      p.employeeCustomDuration !== o.employeeCustomDuration ||
      p.managerCustomDuration !== o.managerCustomDuration ||
      p.reportVisibility !== o.reportVisibility ||
      JSON.stringify(p.selectedEmployees) !== JSON.stringify(o.selectedEmployees) ||
      JSON.stringify(p.selectedManagers) !== JSON.stringify(o.selectedManagers) ||
      JSON.stringify(p.selectedReportUsers) !== JSON.stringify(o.selectedReportUsers) ||
      !!extraDays[`${cycleId}-employee`] ||   // ← NEW
      !!extraDays[`${cycleId}-manager`]        // ← NEW
    );
  };

  const updatePending = (cycleId, changes) => {
    setPending((prev) => ({
      ...prev,
      [cycleId]: { ...prev[cycleId], ...changes },
    }));
  };

  const handleToggleClick = (cycleId, roleType, currentEnabled, duration) => {
    if (!currentEnabled) {
      const p = pending[cycleId] || {};
      const preSelected = roleType === "employee"
        ? (p.selectedEmployees || [])
        : (p.selectedManagers || []);
      setSelectedUsers(preSelected);
      setPopupSearch("");
      setPopup({ cycleId, roleType, desiredEnabled: true, duration });
    } else {
      if (roleType === "employee") {
        updatePending(cycleId, { employeeEnabled: false });
      } else {
        updatePending(cycleId, { managerEnabled: false });
      }
    }
  };

  const handleReportVisibilityClick = (cycleId, value) => {
    if (value === "selected") {
      const p = pending[cycleId] || {};
      setSelectedUsers(p.selectedReportUsers || []);
      setPopupSearch("");
      setPopup({ cycleId, roleType: "report", desiredEnabled: true, reportValue: value });
    } else {
      updatePending(cycleId, { reportVisibility: value });
    }
  };

  const confirmPopup = () => {
    if (!popup) return;
    const { cycleId, roleType, desiredEnabled } = popup;

    if (roleType === "employee") {
      updatePending(cycleId, {
        employeeEnabled: desiredEnabled,
        selectedEmployees: selectedUsers,
      });
    } else if (roleType === "manager") {
      updatePending(cycleId, {
        managerEnabled: desiredEnabled,
        selectedManagers: selectedUsers,
      });
    } else if (roleType === "report") {
      updatePending(cycleId, {
        reportVisibility: "selected",
        selectedReportUsers: selectedUsers,
      });
    }
    setPopup(null);
  };

  const handleSave = async (cycle) => {
    const p = pending[cycle.id];
    if (!p) return;
    const o = p._orig;

    setSaving((prev) => ({ ...prev, [cycle.id]: true }));
    try {
      const promises = [];

      const empExtra = Number(extraDays[`${cycle.id}-employee`] || 0);
      const mgrExtra = Number(extraDays[`${cycle.id}-manager`] || 0);

      if (p.employeeEnabled !== o.employeeEnabled || p.employeeDuration !== o.employeeDuration ||
        p.employeeCustomDuration !== o.employeeCustomDuration ||
        empExtra > 0 ||
        JSON.stringify(p.selectedEmployees) !== JSON.stringify(o.selectedEmployees)) {
        const dur = p.employeeDuration === "custom"
          ? Number(p.employeeCustomDuration || 7)
          : Number(p.employeeDuration || 7);
        promises.push(
          onToggleResponseRating(cycle.id, "employee", p.employeeEnabled, dur, p.selectedEmployees, empExtra)
        );
      }

      if (p.managerEnabled !== o.managerEnabled || p.managerDuration !== o.managerDuration ||
        p.managerCustomDuration !== o.managerCustomDuration ||
        mgrExtra > 0 ||
        JSON.stringify(p.selectedManagers) !== JSON.stringify(o.selectedManagers)) {
        const dur = p.managerDuration === "custom"
          ? Number(p.managerCustomDuration || 7)
          : Number(p.managerDuration || 7);
        promises.push(
          onToggleResponseRating(cycle.id, "manager", p.managerEnabled, dur, p.selectedManagers, mgrExtra)
        );
      }

      if (p.reportVisibility !== o.reportVisibility ||
        JSON.stringify(p.selectedReportUsers) !== JSON.stringify(o.selectedReportUsers)) {
        promises.push(onUpdateReportVisibility(cycle.id, p.reportVisibility, p.selectedReportUsers));
      }

      await Promise.all(promises);

      // ✅ Clear extra days after save
      setExtraDays(prev => {
        const next = { ...prev };
        delete next[`${cycle.id}-employee`];
        delete next[`${cycle.id}-manager`];
        return next;
      });

    } catch {
      Swal.fire("Error", "Failed to save changes", "error");
    } finally {
      setSaving((prev) => ({ ...prev, [cycle.id]: false }));
    }
  };

  const getPopupUsers = () => {
    if (!popup) return [];
    let filtered = allUsers;
    if (popup.roleType === "employee") {
      filtered = allUsers.filter(u => u.role === "employee");
    } else if (popup.roleType === "manager") {
      filtered = allUsers.filter(u => u.role === "manager" || u.role === "hr");
    }
    if (popupSearch.trim()) {
      filtered = filtered.filter(u =>
        (u.name || "").toLowerCase().includes(popupSearch.toLowerCase())
      );
    }
    return filtered;
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => {
    const ids = getPopupUsers().map(u => u.id);
    setSelectedUsers(ids);
  };

  const clearAll = () => setSelectedUsers([]);

  if (cycles.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16 bg-white rounded-xl border border-slate-200"
      >
        <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-700 font-medium">No cycles found</p>
        <p className="text-slate-500 text-sm mt-1">Try changing search or filters.</p>
      </motion.div>
    );
  }
//console.log("Cycles:", isHRUser);
  return (
    <div className="space-y-3">

      {/* ── User Selection Popup ── */}
      <AnimatePresence>
        {popup && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setPopup(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-slate-700 text-sm">
                      {popup.roleType === "employee"
                        ? "Select Employees"
                        : popup.roleType === "manager"
                          ? "Select Managers / HR"
                          : "Select Users for Report Access"}
                    </span>
                  </div>
                  <button onClick={() => setPopup(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-4 pt-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={popupSearch}
                      onChange={e => setPopupSearch(e.target.value)}
                      placeholder="Search users..."
                      className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">
                      {selectedUsers.length} selected of {getPopupUsers().length}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline font-medium">Select All</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={clearAll} className="text-xs text-slate-500 hover:underline font-medium">Clear</button>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-2 max-h-64 overflow-y-auto space-y-1">
                  {getPopupUsers().length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-8">No users found</p>
                  ) : getPopupUsers().map(user => {
                    const checked = selectedUsers.includes(user.id);
                    return (
                      <label key={user.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition
                          ${checked ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50 border border-transparent"}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleUserSelection(user.id)}
                          className="accent-indigo-600 w-3.5 h-3.5 rounded" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {(user.name || user.username || "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{user.name || user.username}</p>
                            <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
                          </div>
                        </div>
                        {checked && <span className="text-[10px] font-semibold text-indigo-500 shrink-0">✓</span>}
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100">
                  <button onClick={() => setPopup(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">
                    Cancel
                  </button>
                  <button onClick={confirmPopup} disabled={selectedUsers.length === 0}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition">
                    Confirm ({selectedUsers.length})
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header row */}
      <div className={`hidden md:grid gap-4 p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 ${isHRUser ? "md:grid-cols-6" : "md:grid-cols-5"}`}>
        <div className="font-semibold text-slate-700 text-sm">Name</div>
        <div className="font-semibold text-slate-700 text-sm">Type</div>
        <div className="font-semibold text-slate-700 text-sm">Duration</div>
        <div className="font-semibold text-slate-700 text-sm">Status</div>
        <div className="font-semibold text-slate-700 text-sm">Response & Rating</div>
        {isHRUser && <div className="font-semibold text-slate-700 text-sm text-right">Actions</div>}
      </div>

      {cycles.map((cycle, index) => {
        const p = pending[cycle.id] || {};
        const dirty = isDirty(cycle.id);
        const isSaving = saving[cycle.id];

        // ✅ Check if toggle is currently ON and has a valid expiry (for showing "add days" input)
        const empIsLive = p.employeeEnabled && cycle.employeeResponseExpiry && !isExpired(cycle.employeeResponseExpiry);
        const mgrIsLive = p.managerEnabled && cycle.managerResponseExpiry && !isExpired(cycle.managerResponseExpiry);

        return (
          <motion.div
            key={cycle.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm grid gap-4 ${isHRUser
              ? "md:grid-cols-[1.2fr_0.9fr_1.2fr_0.9fr_2fr_0.7fr]"
              : "md:grid-cols-[1.2fr_0.9fr_1.2fr_0.9fr_2fr]"
              }`}
          >
            {/* Name */}
            <div>
              <p className="md:hidden text-[11px] uppercase tracking-wide text-slate-500 mb-1">Name</p>
              <p className="font-semibold text-slate-800">{cycle.name}</p>
            </div>

            {/* Type */}
            <div>
              <p className="md:hidden text-[11px] uppercase tracking-wide text-slate-500 mb-1">Type</p>
              <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
                {cycle.type}
              </span>
            </div>

            {/* Duration */}
            <div>
              <p className="md:hidden text-[11px] uppercase tracking-wide text-slate-500 mb-1">Duration</p>
              <div className="text-sm text-slate-600 inline-flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{formatDate(cycle.start)} to {formatDate(cycle.end)}</span>
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="md:hidden text-[11px] uppercase tracking-wide text-slate-500 mb-1">Status</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(cycle.status)}`}>
                <span className={`w-2 h-2 rounded-full mr-2 ${cycle.status === "Active" ? "bg-green-500" : cycle.status === "Upcoming" ? "bg-blue-500" : "bg-gray-500"}`} />
                {cycle.status}
              </span>
            </div>

            {/* Response & Rating + Save */}
            <div>
              <p className="md:hidden text-[11px] uppercase tracking-wide text-slate-500 mb-2">Response & Rating</p>
              <div className="space-y-2">

                {/* Employee Row */}
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-600">Employee</span>
                    {isHRUser ? (
                      <button
                        onClick={() => handleToggleClick(
                          cycle.id, "employee", p.employeeEnabled,
                          p.employeeDuration === "custom"
                            ? Number(p.employeeCustomDuration || 7)
                            : Number(p.employeeDuration || 7)
                        )}
                        className={`w-12 h-6 rounded-full relative transition ${p.employeeEnabled ? "bg-green-600" : "bg-gray-300"}`}
                      >
                        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${p.employeeEnabled ? "translate-x-6" : ""}`} />
                      </button>
                    ) : (
                      <span className={`text-xs font-medium ${p.employeeEnabled ? "text-green-600" : "text-gray-400"}`}>
                        {p.employeeEnabled ? "Enabled" : "Disabled"}
                      </span>
                    )}
                  </div>

                  {isHRUser && p.employeeEnabled && p.selectedEmployees?.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedUsers(p.selectedEmployees || []);
                        setPopupSearch("");
                        setPopup({ cycleId: cycle.id, roleType: "employee", desiredEnabled: true });
                      }}
                      className="mt-1 text-[10px] text-indigo-600 hover:underline font-medium"
                    >
                      {p.selectedEmployees.length} employee(s) selected ✏️
                    </button>
                  )}

                  {isHRUser && (
                    <div className="mt-2 flex items-center gap-2">
                      {empIsLive ? (
                        // ✅ Timer is live → show "Add extra days" input instead of duration select
                        <>
                          <span className="text-xs text-slate-500 shrink-0">Add days:</span>
                          <input
                            type="number"
                            min={1}
                            placeholder="0"
                            value={extraDays[`${cycle.id}-employee`] ?? ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              setExtraDays(prev => ({ ...prev, [`${cycle.id}-employee`]: val }));
                            }}
                            className="w-16 text-xs border border-amber-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <span className="text-[10px] text-amber-600">added to current timer</span>
                        </>
                      ) : (
                        // ✅ Timer is OFF or expired → show normal duration select
                        <>
                          <select
                            value={p.employeeDuration ?? "7"}
                            onChange={(e) => updatePending(cycle.id, { employeeDuration: e.target.value })}
                            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                          >
                            <option value="7">7 days</option>
                            <option value="15">15 days</option>
                            <option value="30">30 days</option>
                            <option value="60">60 days</option>
                            <option value="90">90 days</option>
                            <option value="custom">Custom</option>
                          </select>
                          {p.employeeDuration === "custom" && (
                            <input
                              type="number"
                              min={1}
                              placeholder="Days"
                              value={p.employeeCustomDuration ?? ""}
                              onChange={(e) => updatePending(cycle.id, { employeeCustomDuration: e.target.value.replace(/\D/g, "") })}
                              className="w-16 text-xs border border-slate-300 rounded px-2 py-1"
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {p.employeeEnabled && cycle.employeeResponseExpiry && (
                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                      <div>Till {formatDate(cycle.employeeResponseExpiry)}</div>
                      {remainingTimes?.[`${cycle.id}-employee`] && (
                        <div className="inline-flex items-center gap-1 text-orange-600">
                          <Clock className="w-3 h-3" />
                          {remainingTimes[`${cycle.id}-employee`]}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Manager Row */}
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-600">Manager/HR</span>
                    {isHRUser ? (
                      <button
                        onClick={() => handleToggleClick(
                          cycle.id, "manager", p.managerEnabled,
                          p.managerDuration === "custom"
                            ? Number(p.managerCustomDuration || 7)
                            : Number(p.managerDuration || 7)
                        )}
                        className={`w-12 h-6 rounded-full relative transition ${p.managerEnabled ? "bg-green-600" : "bg-gray-300"}`}
                      >
                        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${p.managerEnabled ? "translate-x-6" : ""}`} />
                      </button>
                    ) : (
                      <span className={`text-xs font-medium ${p.managerEnabled ? "text-green-600" : "text-gray-400"}`}>
                        {p.managerEnabled ? "Enabled" : "Disabled"}
                      </span>
                    )}
                  </div>

                  {isHRUser && p.managerEnabled && p.selectedManagers?.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedUsers(p.selectedManagers || []);
                        setPopupSearch("");
                        setPopup({ cycleId: cycle.id, roleType: "manager", desiredEnabled: true });
                      }}
                      className="mt-1 text-[10px] text-indigo-600 hover:underline font-medium"
                    >
                      {p.selectedManagers.length} manager(s) selected ✏️
                    </button>
                  )}

                  {isHRUser && (
                    <div className="mt-2 flex items-center gap-2">
                      {mgrIsLive ? (
                        // ✅ Timer is live → show "Add extra days" input instead of duration select
                        <>
                          <span className="text-xs text-slate-500 shrink-0">Add days:</span>
                          <input
                            type="number"
                            min={1}
                            placeholder="0"
                            value={extraDays[`${cycle.id}-manager`] ?? ""}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              setExtraDays(prev => ({ ...prev, [`${cycle.id}-manager`]: val }));
                            }}
                            className="w-16 text-xs border border-amber-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                          <span className="text-[10px] text-amber-600">added to current timer</span>
                        </>
                      ) : (
                        // ✅ Timer is OFF or expired → show normal duration select
                        <>
                          <select
                            value={p.managerDuration ?? "7"}
                            onChange={(e) => updatePending(cycle.id, { managerDuration: e.target.value })}
                            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                          >
                            <option value="7">7 days</option>
                            <option value="15">15 days</option>
                            <option value="30">30 days</option>
                            <option value="60">60 days</option>
                            <option value="90">90 days</option>
                            <option value="custom">Custom</option>
                          </select>
                          {p.managerDuration === "custom" && (
                            <input
                              type="number"
                              min={1}
                              placeholder="Days"
                              value={p.managerCustomDuration ?? ""}
                              onChange={(e) => updatePending(cycle.id, { managerCustomDuration: e.target.value.replace(/\D/g, "") })}
                              className="w-16 text-xs border border-slate-300 rounded px-2 py-1"
                            />
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {p.managerEnabled && cycle.managerResponseExpiry && (
                    <div className="mt-2 text-xs text-slate-500 space-y-1">
                      <div>Till {formatDate(cycle.managerResponseExpiry)}</div>
                      {remainingTimes?.[`${cycle.id}-manager`] && (
                        <div className="inline-flex items-center gap-1 text-orange-600">
                          <Clock className="w-3 h-3" />
                          {remainingTimes[`${cycle.id}-manager`]}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Save Button */}
                {isHRUser && dirty && (
                  <motion.button
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleSave(cycle)}
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </motion.button>
                )}

              </div>
            </div>

            {/* Actions */}
            {isHRUser && (
              <div>
                <p className="md:hidden text-[11px] uppercase tracking-wide text-slate-500 mb-1">Actions</p>
                <div className="flex items-center md:justify-end gap-2">
                  <motion.button
                    onClick={() => onEdit(cycle)}
                    title="Edit"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                  >
                    <Edit className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      Swal.fire({
                        title: "Delete Cycle?",
                        text: "This action cannot be undone.",
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonColor: "#ef4444",
                        cancelButtonColor: "#64748b",
                        confirmButtonText: "Yes, delete it",
                      }).then((result) => {
                        if (result.isConfirmed) onDelete(cycle.id);
                      });
                    }}
                    title="Delete"
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}