import { useState } from "react";
import { Save, X, AlertCircle } from "lucide-react";

export default function EmployeeKPIForm({ kra, onSave, onCancel, setError }) {
  const [kpi, setKpi] = useState({
    title: "",
    description: "",
    weight: "",
  });

  const used = kra.kpis.reduce((s, k) => s + Number(k.weight), 0);
  const remaining = 100 - used;

  const save = () => {
    if (!kpi.title || !kpi.weight) {
      return setError("All KPI fields are required.");
    }

    const w = Number(kpi.weight);

    if (w <= 0) return setError("Weight must be greater than 0%.");
    if (w > remaining) {
      return setError(
        `❌ Invalid KPI weight! Max remaining: ${remaining}%. Total must be 100%.`
      );
    }

    onSave(kpi);
    setKpi({ title: "", description: "", weight: "" });
  };

  return (
    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 shadow-inner">
      {/* Remaining weight indicator */}
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle size={14} className="text-indigo-500" />
        <p className="text-xs font-semibold text-gray-600">
          Remaining weight for this KRA:{" "}
          <span
            className={`font-bold ${
              remaining <= 0 ? "text-red-500" : "text-indigo-600"
            }`}
          >
            {remaining}%
          </span>
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-3 mb-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">
            KPI Name
          </label>
          <input
            placeholder="e.g. Code Review Quality"
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-white border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            value={kpi.title}
            onChange={(e) => setKpi({ ...kpi, title: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">
            Weight %
          </label>
          <input
            type="number"
            placeholder="%"
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-white border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            value={kpi.weight}
            onChange={(e) => setKpi({ ...kpi, weight: e.target.value })}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition shadow-sm"
        >
          <X size={13} />
          Cancel
        </button>
        <button
          onClick={save}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:from-indigo-700 hover:to-indigo-800 transition shadow-md"
        >
          <Save size={13} />
          Add KPI
        </button>
      </div>
    </div>
  );
}
