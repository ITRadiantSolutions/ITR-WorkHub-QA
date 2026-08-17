import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileText, X, Search, Users, Eye, EyeOff, UserCheck } from "lucide-react";
import CycleTable from "./CycleTable";
import CycleModal from "./CycleModal";
import getAuthAxios from "../../utils/authAxios";
import { isPMS_HR } from "../../utils/pmsrolecheck";

// After:
const getStatus = (cycle) => {
  const today = new Date();
  const start = new Date(cycle.start);

  const employeeActive =
    cycle.employeeResponseEnabled &&
    cycle.employeeResponseExpiry &&
    new Date(cycle.employeeResponseExpiry) > today;

  const managerActive =
    cycle.managerResponseEnabled &&
    cycle.managerResponseExpiry &&
    new Date(cycle.managerResponseExpiry) > today;

  // Toggle is genuinely live → Active, regardless of the cycle's own date range
  if (employeeActive || managerActive) return "Active";

  // Not toggled on (or expired) → fall back to date-based state
  if (today < start) return "Upcoming";
  return "Closed";
};

const addMonthsMinusOneDay = (dateStr, months) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};

// The API now returns the unified (nested) Cycle shape — employeeResponse/
// managerResponse/reportVisibility sub-objects — instead of the flat legacy
// fields this component was originally built against. Flatten it back out
// here so the rest of the component (and CycleTable/CycleModal) can stay
// unchanged.
const normalizeCycle = (cycle) => ({
  id: cycle.id || cycle._id,
  name: cycle.name,
  type: cycle.type,
  start: cycle.start?.split("T")[0],
  end: cycle.end?.split("T")[0],
  status: getStatus({
    start: cycle.start,
    employeeResponseEnabled: cycle.employeeResponse?.enabled,
    employeeResponseExpiry: cycle.employeeResponse?.expiry,
    managerResponseEnabled: cycle.managerResponse?.enabled,
    managerResponseExpiry: cycle.managerResponse?.expiry,
  }),

  employeeResponseEnabled: cycle.employeeResponse?.enabled ?? false,
  employeeResponseExpiry: cycle.employeeResponse?.expiry ?? null,
  employeeResponseDurationDays: cycle.employeeResponse?.durationDays ?? 7,

  managerResponseEnabled: cycle.managerResponse?.enabled ?? false,
  managerResponseExpiry: cycle.managerResponse?.expiry ?? null,
  managerResponseDurationDays: cycle.managerResponse?.durationDays ?? 7,
  reportVisibility: cycle.reportVisibility?.mode ?? "none",
  selectedEmployees: cycle.employeeResponse?.selectedUserIds ?? [],
  selectedManagers: cycle.managerResponse?.selectedUserIds ?? [],
  reportVisibleTo: cycle.reportVisibility?.visibleTo ?? [],
});

const getRemainingTime = (expiry) => {
  if (!expiry) return null;
  // ⭐ FIX: expiry is now a proper "...Z" UTC string, so new Date() parses
  // it correctly on its own — no manual IST offset needed (that was
  // double-correcting and throwing the countdown off).
  const diff = new Date(expiry).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${days} days ${hours} hrs ${minutes} mins remaining`;
};

// ── Publish Report Popup ─────────────────────────────────────────────────────
function PublishReportPopup({ cycles, allUsers, onClose, onConfirm }) {
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [visibility, setVisibility] = useState("none");
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  const filteredUsers = allUsers.filter((u) =>
    search.trim()
      ? (u.name || "").toLowerCase().includes(search.toLowerCase())
      : true
  );

  const toggleUser = (id) =>
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const selectAll = () => setSelectedUsers(filteredUsers.map((u) => u.id));
  const clearAll = () => setSelectedUsers([]);

  // Pre-fill when cycle changes
  const handleCycleChange = (cycleId) => {
    setSelectedCycleId(cycleId);
    const cycle = cycles.find((c) => c.id === cycleId);
    if (cycle) {
      setVisibility(cycle.reportVisibility || "none");
      setSelectedUsers(cycle.reportVisibleTo || []);
    } else {
      setVisibility("none");
      setSelectedUsers([]);
    }
  };

  const handleConfirm = async () => {
    if (!selectedCycleId) return;
    setSaving(true);
    await onConfirm(selectedCycleId, visibility, visibility === "selected" ? selectedUsers : []);
    setSaving(false);
    onClose();
  };

  const visibilityOptions = [
    {
      value: "none",
      label: "Hidden from all",
      icon: <EyeOff className="w-4 h-4" />,
      desc: "No one can view the report",
      color: "border-slate-200 text-slate-600",
      activeColor: "border-slate-500 bg-slate-50 text-slate-700",
    },
    {
      value: "all",
      label: "Visible to all",
      icon: <Eye className="w-4 h-4" />,
      desc: "Everyone in the organization can view",
      color: "border-slate-200 text-slate-600",
      activeColor: "border-green-500 bg-green-50 text-green-700",
    },
    {
      value: "selected",
      label: "Selected users",
      icon: <UserCheck className="w-4 h-4" />,
      desc: "Only specific users can view",
      color: "border-slate-200 text-slate-600",
      activeColor: "border-violet-500 bg-violet-50 text-violet-700",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Publish Report</p>
                <p className="text-[11px] text-slate-400">Set report visibility for a cycle</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

            {/* Cycle Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Select Cycle
              </label>
              <select
                value={selectedCycleId}
                onChange={(e) => handleCycleChange(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700"
              >
                <option value="">— Choose a cycle —</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Visibility Options */}
            {selectedCycleId && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Report Visibility
                </label>
                <div className="space-y-2">
                  {visibilityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setVisibility(opt.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition text-left
                        ${visibility === opt.value ? opt.activeColor : "border-slate-200 hover:border-slate-300 text-slate-600"}`}
                    >
                      <span className={visibility === opt.value ? "" : "text-slate-400"}>
                        {opt.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{opt.label}</p>
                        <p className="text-[10px] opacity-70 mt-0.5">{opt.desc}</p>
                      </div>
                      {visibility === opt.value && (
                        <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* User Selection — shown only when "selected" */}
            {selectedCycleId && visibility === "selected" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">
                  Select Users
                </label>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                {/* Select/Clear All */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">
                    {selectedUsers.length} selected of {filteredUsers.length}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-xs text-violet-600 hover:underline font-medium">
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button onClick={clearAll} className="text-xs text-slate-500 hover:underline font-medium">
                      Clear
                    </button>
                  </div>
                </div>

                {/* User List */}
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-slate-100 p-1">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-6">No users found</p>
                  ) : (
                    filteredUsers.map((user) => {
                      const checked = selectedUsers.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition
                            ${checked ? "bg-violet-50 border border-violet-200" : "hover:bg-slate-50 border border-transparent"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUser(user.id)}
                            className="accent-violet-600 w-3.5 h-3.5 rounded"
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {(user.name || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>
                              <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
                            </div>
                          </div>
                          {checked && (
                            <span className="text-[10px] font-semibold text-violet-500 shrink-0">✓</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                !selectedCycleId ||
                saving ||
                (visibility === "selected" && selectedUsers.length === 0)
              }
              className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" />
              {saving ? "Publishing..." : "Publish Report"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Main Cycle Component ─────────────────────────────────────────────────────
export default function Cycle() {
  const [cycles, setCycles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [durationDays, setDurationDays] = useState({});
  const [remainingTimes, setRemainingTimes] = useState({});
  const [showPublishPopup, setShowPublishPopup] = useState(false); // ← NEW

  const [form, setForm] = useState({
    name: "",
    type: "Half-Yearly",
    start: "",
    end: "",
  });

  const [errors, setErrors] = useState({});
  // Set right before openCreate/openEdit programmatically loads `form` so the
  // auto-end-date effect below (which reacts to form.type/form.start) skips
  // that one load instead of immediately overwriting a just-loaded, possibly
  // custom `end` with its own start+type formula.
  const skipAutoEndCalc = useRef(false);

  useEffect(() => {
    setLoggedInUser(JSON.parse(localStorage.getItem("user")));
  }, []);

  const loadCycles = async () => {
    try {
      const api = await getAuthAxios();
      const res = await api.get("/pms/cycles");
      const normalized = res.data.map(normalizeCycle);
      setCycles(normalized);

      const durations = {};
      normalized.forEach((c) => {
        const empDays = c.employeeResponseDurationDays;
        if ([7, 15, 30, 60, 90].includes(empDays)) {
          durations[`${c.id}-employee`] = String(empDays);
        } else {
          durations[`${c.id}-employee`] = "custom";
          durations[`${c.id}-employee-custom`] = String(empDays);
        }
        const mgrDays = c.managerResponseDurationDays;
        if ([7, 15, 30, 60, 90].includes(mgrDays)) {
          durations[`${c.id}-manager`] = String(mgrDays);
        } else {
          durations[`${c.id}-manager`] = "custom";
          durations[`${c.id}-manager-custom`] = String(mgrDays);
        }
      });
      setDurationDays(durations);
    } catch {
      setApiError("Failed to load cycles");
    }
  };

  useEffect(() => {
    loadCycles();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const times = {};
      cycles.forEach((c) => {
        if (c.employeeResponseExpiry)
          times[`${c.id}-employee`] = getRemainingTime(c.employeeResponseExpiry);
        if (c.managerResponseExpiry)
          times[`${c.id}-manager`] = getRemainingTime(c.managerResponseExpiry);
      });
      setRemainingTimes(times);
    }, 1000);
    return () => clearInterval(interval);
  }, [cycles]);

  useEffect(() => {
    if (!form.start) return;
    if (skipAutoEndCalc.current) {
      skipAutoEndCalc.current = false;
      return;
    }
    const months = form.type === "Quarterly" ? 3 : form.type === "Yearly" ? 12 : 6;
    setForm((p) => ({ ...p, end: addMonthsMinusOneDay(form.start, months) }));
  }, [form.type, form.start]);

  const sortedCycles = useMemo(
    () => [...cycles].sort((a, b) => new Date(b.start) - new Date(a.start)),
    [cycles]
  );

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Cycle name is required";
    if (form.name.length < 3) e.name = "Cycle name must be at least 3 characters";
    if (!form.start) e.start = "Start date is required";
    if (!form.end) e.end = "End date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openCreate = () => {
    setEditingId(null);
    setErrors({});
    setApiError("");
    // No skipAutoEndCalc here (unlike openEdit) — start begins empty, so the
    // auto-end-date effect no-ops until the user actually picks a date, and
    // that first pick is exactly when we want it to fire, not skip it.
    setForm({ name: "", type: "Half-Yearly", start: "", end: "" });
    setShowModal(true);
  };

  const openEdit = (cycle) => {
    setEditingId(cycle.id);
    setErrors({});
    setApiError("");
    skipAutoEndCalc.current = true;
    setForm({ name: cycle.name, type: cycle.type, start: cycle.start, end: cycle.end });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const saveCycle = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      const api = await getAuthAxios();
      const res = editingId
        ? await api.put(`/pms/cycles/${editingId}`, form)
        : await api.post("/pms/cycles", form);
      const data = normalizeCycle(res.data);
      setCycles((prev) =>
        editingId ? prev.map((c) => (c.id === editingId ? data : c)) : [...prev, data]
      );
      closeModal();
    } catch (err) {
      setApiError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteCycle = async (id) => {
    try {
      const api = await getAuthAxios();
      await api.delete(`/pms/cycles/${id}`);
      setCycles((p) => p.filter((c) => c.id !== id));
    } catch {
      setApiError("Failed to delete cycle");
    }
  };

  // The new setEmployeeResponseWindow/setManagerResponseWindow endpoints set
  // whatever `expiry` they're given verbatim — unlike the legacy toggle,
  // they don't compute it from durationDays/extraDays server-side, so that
  // math now happens here before the request goes out.
  const toggleResponse = async (cycleId, roleType, desiredEnabled, duration, selectedUserIds = [], extraDays = 0) => {
    try {
      const api = await getAuthAxios();
      const endpoint = roleType === "manager" ? "manager-response" : "employee-response";
      const current = cycles.find((c) => c.id === cycleId);
      const wasEnabled = current?.[`${roleType}ResponseEnabled`];
      const currentExpiry = current?.[`${roleType}ResponseExpiry`];

      let expiry = null;
      if (desiredEnabled) {
        expiry =
          extraDays && wasEnabled && currentExpiry
            ? new Date(new Date(currentExpiry).getTime() + extraDays * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + (duration ?? 7) * 24 * 60 * 60 * 1000);
      }

      await api.patch(`/pms/cycles/${cycleId}/${endpoint}`, {
        enabled: desiredEnabled,
        expiry,
        durationDays: desiredEnabled ? (duration ?? 7) : undefined,
        selectedUserIds: desiredEnabled ? selectedUserIds : [],
      });
      await loadCycles();
    } catch {
      setApiError("Failed to toggle response");
    }
  };

  const updateReportVisibility = async (cycleId, value, selectedUserIds = []) => {
    try {
      const api = await getAuthAxios();
      await api.patch(`/pms/cycles/${cycleId}/report-visibility`, {
        mode: value,
        visibleTo: selectedUserIds,
      });
      await loadCycles();
    } catch {
      setApiError("Failed to update report visibility");
    }
  };

  // No single-user-toggle endpoint on the new system — compute the flipped
  // visibleTo array here and send the full list via setReportVisibility
  // (mode is omitted so the cycle's current visibility mode is untouched).
  const toggleUserReportAccess = async (cycleId, userId) => {
    try {
      const api = await getAuthAxios();
      const current = cycles.find((c) => c.id === cycleId);
      const visibleTo = current?.reportVisibleTo || [];
      const next = visibleTo.includes(userId) ? visibleTo.filter((id) => id !== userId) : [...visibleTo, userId];
      await api.patch(`/pms/cycles/${cycleId}/report-visibility`, { visibleTo: next });
      loadCycles();
    } catch {
      setApiError("Failed to toggle user report access");
    }
  };

  const updateDuration = (cycleId, roleType, value, isCustom = false) => {
    setDurationDays((prev) => {
      const updated = { ...prev };
      if (isCustom) {
        updated[`${cycleId}-${roleType}-custom`] = value;
        updated[`${cycleId}-${roleType}`] = "custom";
      } else {
        updated[`${cycleId}-${roleType}`] = value;
        if (value !== "custom") delete updated[`${cycleId}-${roleType}-custom`];
      }
      return updated;
    });
  };

  const [allUsers, setAllUsers] = useState([]);

useEffect(() => {
  const fetchUsers = async () => {
    const api = await getAuthAxios();
    const res = await api.get("/users");

    setAllUsers(
      res.data.map((u) => ({
        id: u._id || u.id,
        name: u.name,
        role: u.roles?.pms,
      }))
    );
  };

  fetchUsers();
}, []);

  return (
    <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Review Cycles</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage performance review cycles and timelines</p>
        </div>

        {loggedInUser && isPMS_HR(loggedInUser) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPublishPopup(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-violet-200 text-violet-700 text-sm font-semibold rounded-xl hover:bg-violet-50 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Publish Report</span>
            </button>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Cycle</span>
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {apiError && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{apiError}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Cycles Table */}
        <CycleTable
          cycles={sortedCycles}
          loggedInUser={loggedInUser}
          onEdit={openEdit}
          onDelete={deleteCycle}
          onToggleResponseRating={toggleResponse}
          onUpdateDuration={updateDuration}
          durationDays={durationDays}
          remainingTimes={remainingTimes}
          onUpdateReportVisibility={updateReportVisibility}
          onToggleUserReportAccess={toggleUserReportAccess}
          allUsers={allUsers}
        />
      </div>

      {/* Create/Edit Modal */}
      <CycleModal
        isOpen={showModal}
        isEditing={Boolean(editingId)}
        form={form}
        errors={errors}
        loading={loading}
        onChange={setForm}
        onClose={closeModal}
        onSave={saveCycle}
      />

      {/* ── Publish Report Popup ── */}
      <AnimatePresence>
        {showPublishPopup && (
          <PublishReportPopup
            cycles={sortedCycles}
            allUsers={allUsers}
            onClose={() => setShowPublishPopup(false)}
            onConfirm={updateReportVisibility}
          />
        )}
      </AnimatePresence>
    </main>
  );
}