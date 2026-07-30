import { useEffect, useMemo, useState } from "react";
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

const normalizeCycle = (cycle) => ({
  id: cycle.id || cycle._id,
  name: cycle.name,
  type: cycle.type,
  start: cycle.start?.split("T")[0],
  end: cycle.end?.split("T")[0],
  status: getStatus(cycle),   // ← was getStatus(cycle.start, cycle.end)

  employeeResponseEnabled: cycle.employeeResponseEnabled ?? false,
  employeeResponseExpiry: cycle.employeeResponseExpiry ?? null,
  employeeResponseDurationDays: cycle.employeeResponseDurationDays ?? 7,

  managerResponseEnabled: cycle.managerResponseEnabled ?? false,
  managerResponseExpiry: cycle.managerResponseExpiry ?? null,
  managerResponseDurationDays: cycle.managerResponseDurationDays ?? 7,
  reportVisibility: cycle.reportVisibility ?? "none",
  selectedEmployees: cycle.selectedEmployees ?? [],
  selectedManagers: cycle.selectedManagers ?? [],
  reportVisibleTo: cycle.reportVisibleTo ?? [],
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
      activeColor: "border-indigo-500 bg-indigo-50 text-indigo-700",
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
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-indigo-600" />
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
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-700"
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
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                {/* Select/Clear All */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">
                    {selectedUsers.length} selected of {filteredUsers.length}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline font-medium">
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
                            ${checked ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50 border border-transparent"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUser(user.id)}
                            className="accent-indigo-600 w-3.5 h-3.5 rounded"
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {(user.name || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>
                              <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
                            </div>
                          </div>
                          {checked && (
                            <span className="text-[10px] font-semibold text-indigo-500 shrink-0">✓</span>
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
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition flex items-center gap-2"
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

  useEffect(() => {
    setLoggedInUser(JSON.parse(localStorage.getItem("user")));
  }, []);

  const loadCycles = async () => {
    try {
      const api = await getAuthAxios();
      const res = await api.get("/cycles/");
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
    setForm({ name: "", type: "Half-Yearly", start: "", end: "" });
    setShowModal(true);
  };

  const openEdit = (cycle) => {
    setEditingId(cycle.id);
    setErrors({});
    setApiError("");
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
        ? await api.put(`/cycles/${editingId}`, form)
        : await api.post("/cycles/", form);
      const data = normalizeCycle(res.data);
      setCycles((prev) =>
        editingId ? prev.map((c) => (c.id === editingId ? data : c)) : [...prev, data]
      );
      closeModal();
    } catch {
      setApiError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteCycle = async (id) => {
    try {
      const api = await getAuthAxios();
      await api.delete(`/cycles/${id}`);
      setCycles((p) => p.filter((c) => c.id !== id));
    } catch {
      setApiError("Failed to delete cycle");
    }
  };

  const toggleResponse = async (cycleId, roleType, desiredEnabled, duration, selectedUserIds = [], extraDays = 0) => {
    try {
      const api = await getAuthAxios();
      await api.patch(`/cycles/${cycleId}/toggle-response`, {
        role: roleType,
        enabled: desiredEnabled,
        durationDays: desiredEnabled ? (duration ?? 7) : null,
        extraDays: extraDays,
        selectedUsers: desiredEnabled ? selectedUserIds : [],
      });
      await loadCycles();
    } catch {
      setApiError("Failed to toggle response");
    }
  };

  const updateReportVisibility = async (cycleId, value, selectedUserIds = []) => {
    try {
      const api = await getAuthAxios();
      await api.patch(`/cycles/${cycleId}/report-visibility`, {
        reportVisibility: value,
        selectedUsers: selectedUserIds,
      });
      await loadCycles();
    } catch {
      setApiError("Failed to update report visibility");
    }
  };

  const toggleUserReportAccess = async (cycleId, userId) => {
    try {
      const api = await getAuthAxios();
      await api.patch(`/cycles/${cycleId}/report-visibility-toggle-user`, { userId });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-200"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Performance Cycles
              </h2>
              <p className="text-gray-600">
                Manage performance review cycles and timelines
              </p>
            </div>

            {loggedInUser && isPMS_HR(loggedInUser) && (
              <div className="flex items-center gap-3">
                {/* ── Publish Report Button ── */}
                <motion.button
                  onClick={() => setShowPublishPopup(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-indigo-500 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FileText className="w-4 h-4" />
                  <span>Publish Report</span>
                </motion.button>

                {/* ── Create Cycle Button ── */}
                <motion.button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Plus className="w-5 h-5" />
                  <span>Create Cycle</span>
                </motion.button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {apiError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
            >
              {apiError}
            </motion.div>
          )}

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
        </motion.div>
      </div>
    </div>
  );
}