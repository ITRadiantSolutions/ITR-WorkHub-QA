import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Save, X, AlertCircle } from "lucide-react";

const todayISO = () => new Date().toISOString().split("T")[0];

export default function CycleModal({
  isOpen,
  isEditing,
  form,
  errors,
  loading,
  onChange,
  onClose,
  onSave,
  onUpdateReportVisibility,   
  onToggleUserReportAccess,
  allUsers = [],    
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-200">
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-violet-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {isEditing ? "Edit Cycle" : "Create Cycle"}
                  </h3>
                </div>
                <motion.button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </motion.button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Cycle Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cycle Name
                  </label>
                  <input
                    className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-200 focus:ring-2 focus:outline-none ${errors.name
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:ring-violet-500 focus:border-violet-500"
                      }`}
                    value={form.name}
                    onChange={(e) => onChange({ ...form, name: e.target.value })}
                    placeholder="e.g., Q1 2024"
                  />
                  {errors.name && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-600 mt-1.5 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      {errors.name}
                    </motion.p>
                  )}
                </div>

                {/* Cycle Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cycle Type
                  </label>
                  <select
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200"
                    value={form.type}
                    onChange={(e) => onChange({ ...form, type: e.target.value })}
                  >
                    <option>Half-Yearly</option>
                    <option>Quarterly</option>
                    <option>Yearly</option>
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                       className={`w-full px-4 py-2.5 rounded-lg border transition-all duration-200 focus:ring-2 focus:outline-none ${errors.start
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-violet-500 focus:border-violet-500"
                        }`}
                      value={form.start}
                      onChange={(e) =>
                        onChange({ ...form, start: e.target.value })
                      }
                    />
                    {errors.start && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-red-600 mt-1.5 flex items-center gap-1"
                      >
                        <AlertCircle className="w-3 h-3" />
                        {errors.start}
                      </motion.p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed"
                      value={form.end}
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <motion.button
                  onClick={onClose}
                  className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={onSave}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={!loading ? { scale: 1.05 } : {}}
                  whileTap={!loading ? { scale: 0.95 } : {}}
                >
                  <Save size={16} />
                  {loading ? "Saving..." : isEditing ? "Update" : "Create"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
