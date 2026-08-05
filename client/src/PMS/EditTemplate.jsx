import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Save, Plus, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import Loader from "./components/Loader";

// This file's original fetch() calls sent no Authorization header (the old
// app served frontend+backend from one origin). Ours are separate origins
// behind a JWT, so every request needs the token attached.
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export default function EditTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({
    kraTotal: "",
    kraTotalSuccess: "",
    kpiTotals: {},
  });

  // Load existing template
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/templates/single/${id}`, { headers: authHeaders() });
        if (!res.ok) throw new Error("Failed to fetch template");
        const data = await res.json();
        setTemplate(data);
      } catch (err) {
        alert("Error loading template");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSave = async () => {
    if (hasErrors) return;

    const finalTemplate = {
      ...template,
      kras: template.kras.map((kra) => ({
        ...kra,
        kpis: kra.kpis.map((kpi) => ({
          ...kpi,
          actualWeight: Number(((kra.weight * kpi.weight) / 100).toFixed(2)),
        })),
      })),
    };

    const res = await fetch(`/api/templates/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(finalTemplate),
    });

    if (!res.ok) return alert("Update failed");

    navigate("/PMS-template");
  };

  const isAnyKRAZero = template?.kras?.some(
    (kra) => !kra.weight || Number(kra.weight) === 0
  );

  const hasErrors =
    errors.kraTotal || Object.keys(errors.kpiTotals).length > 0;

  const validateTemplate = (data) => {
    const newErrors = {
      kraTotal: "",
      kpiTotals: {},
    };

    const totalKRA = data.kras.reduce(
      (s, k) => s + Number(k.weight || 0),
      0
    );

    if (totalKRA > 100) {
      newErrors.kraTotal = `Total KRA weight is ${totalKRA}%. Must be ≤ 100%.`;
    } else if (totalKRA === 100) {
      newErrors.kraTotalSuccess = "Total KRA weight is exactly 100%. ✔";
    }

    data.kras.forEach((kra, i) => {
      const totalKPI = kra.kpis.reduce(
        (s, k) => s + Number(k.weight || 0),
        0
      );

      if (totalKPI !== 100) {
        newErrors.kpiTotals[i] = `KPI total is ${totalKPI}%. Must be exactly 100%.`;
      }
    });

    return newErrors;
  };

  useEffect(() => {
    if (template) {
      setErrors(validateTemplate(template));
    }
  }, [template]);

  if (loading) {
    return (
      <Loader containerClass="flex flex-col h-[100vh] items-center justify-center gap-3" />
    );
  }

  if (!template)
    return (
      <p className="p-4 text-red-500">Template not found</p>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <motion.button
            onClick={() => navigate("/PMS-template")}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-gray-700 font-medium"
            whileHover={{ scale: 1.05, x: -4 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={20} />
            <span>Back</span>
          </motion.button>

          <h1 className="text-xl font-extrabold text-slate-900">
            Edit Template
          </h1>

          <motion.button
            onClick={handleSave}
            disabled={hasErrors || isAnyKRAZero}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold shadow-lg transition-all duration-300
              ${hasErrors || isAnyKRAZero
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 hover:shadow-xl"
              }
            `}
            whileHover={!hasErrors && !isAnyKRAZero ? { scale: 1.05 } : {}}
            whileTap={!hasErrors && !isAnyKRAZero ? { scale: 0.95 } : {}}
          >
            <Save size={18} />
            <span>Save Changes</span>
          </motion.button>
        </motion.div>

        {/* Validation Summary */}
        <AnimatePresence>
          {errors.kraTotal && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{errors.kraTotal}</p>
            </motion.div>
          )}

          {errors.kraTotalSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700 font-medium">
                {errors.kraTotalSuccess}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KRAs List */}
        <div className="space-y-4">
          {template.kras?.map((kra, i) => {
            const totalKPI = kra.kpis.reduce(
              (s, k) => s + Number(k.weight || 0),
              0
            );

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300"
              >
                {/* KRA Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        KRA Name
                      </label>
                      <input
                        placeholder="KRA Name"
                        value={kra.name}
                        onChange={(e) => {
                          const updated = [...template.kras];
                          updated[i].name = e.target.value;
                          setTemplate({ ...template, kras: updated });
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        KRA Weight (%)
                      </label>
                      <input
                        type="number"
                        placeholder="KRA Weight (%)"
                        value={kra.weight}
                        onChange={(e) => {
                          const updated = [...template.kras];
                          updated[i].weight = Number(e.target.value);
                          setTemplate({ ...template, kras: updated });
                        }}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 ${errors.kraTotal
                            ? "border-red-500 focus:ring-red-500"
                            : errors.kraTotalSuccess
                              ? "border-green-500 focus:ring-green-500"
                              : "border-gray-300 focus:ring-violet-500 focus:border-violet-500"
                          }`}
                      />
                    </div>
                  </div>
                </div>

                {/* KPIs Section */}
                {(!kra.weight || kra.weight <= 0 || !kra.name) ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Please enter KRA name and weight to add KPIs
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">
                          Key Performance Indicators (KPIs)
                        </h3>
                        <div className="text-xs text-gray-600">
                          Total: <span className="font-bold">{totalKPI}%</span> / 100%
                        </div>
                      </div>

                      {/* KPI List */}
                      <div className="space-y-3 mb-4">
                        {kra.kpis.map((kpi, j) => (
                          <motion.div
                            key={j}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex-1">
                              <input
                                placeholder="KPI Name"
                                value={kpi.title}
                                onChange={(e) => {
                                  const u = [...template.kras];
                                  u[i].kpis[j].title = e.target.value;
                                  setTemplate({ ...template, kras: u });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                              />
                            </div>

                            <div className="w-32">
                              <input
                                type="number"
                                placeholder="Weight %"
                                value={kpi.weight}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  const usedWeight =
                                    totalKPI - Number(kpi.weight || 0);
                                  const remaining = 100 - usedWeight;

                                  if (value > remaining) return;

                                  const u = [...template.kras];
                                  u[i].kpis[j].weight = value;
                                  setTemplate({ ...template, kras: u });
                                }}
                                className={`w-full px-3 py-2 border rounded-lg text-sm text-right focus:ring-2 transition-all ${errors.kpiTotals[i]
                                    ? "border-red-500 focus:ring-red-500"
                                    : "border-gray-300 focus:ring-violet-500 focus:border-violet-500"
                                  }`}
                              />
                            </div>

                            <motion.button
                              onClick={() => {
                                const u = [...template.kras];
                                u[i].kpis = u[i].kpis.filter((_, idx) => idx !== j);
                                setTemplate({ ...template, kras: u });
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Trash2 size={16} />
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>

                      {/* KPI Error */}
                      {errors.kpiTotals[i] && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
                        >
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-red-700">
                            {errors.kpiTotals[i]}
                          </p>
                        </motion.div>
                      )}

                      {/* Add KPI Button */}
                      <div className="flex justify-end">
                        {totalKPI < 100 ? (
                          <motion.button
                            onClick={() => {
                              const updated = [...template.kras];
                              updated[i].kpis.push({
                                title: "",
                                target: "",
                                weight: 0,
                              });
                              setTemplate({ ...template, kras: updated });
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all duration-300"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Plus size={16} />
                            <span>Add KPI</span>
                          </motion.button>
                        ) : (
                          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
                            <CheckCircle2 size={16} />
                            <span>KPI weight reached 100%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Add KRA Button */}
        <motion.div
          className="mt-6 p-6 bg-white rounded-xl shadow-lg border border-gray-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex-1">
              {errors.kraTotal && (
                <p className="text-xs text-red-600 font-medium mb-2">
                  {errors.kraTotal}
                </p>
              )}

              <p className="text-sm text-gray-700 mb-2">
                Remaining KRA Weight:{" "}
                <span className="font-bold text-violet-600">
                  {100 -
                    template.kras.reduce(
                      (s, k) => s + Number(k.weight || 0),
                      0
                    )}
                  %
                </span>
              </p>
            </div>

            <motion.button
              onClick={() => {
                const totalKRA = template.kras.reduce(
                  (sum, k) => sum + Number(k.weight || 0),
                  0
                );

                if (totalKRA >= 100) return;

                setTemplate((prev) => ({
                  ...prev,
                  kras: [...prev.kras, { name: "", weight: 0, kpis: [] }],
                }));
              }}
              disabled={
                100 -
                template.kras.reduce(
                  (s, k) => s + Number(k.weight || 0),
                  0
                ) <=
                0
              }
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium shadow-md transition-all duration-300
                ${100 -
                  template.kras.reduce(
                    (s, k) => s + Number(k.weight || 0),
                    0
                  ) <=
                  0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 hover:shadow-lg"
                }
              `}
              whileHover={
                100 -
                  template.kras.reduce(
                    (s, k) => s + Number(k.weight || 0),
                    0
                  ) >
                  0
                  ? { scale: 1.05 }
                  : {}
              }
              whileTap={
                100 -
                  template.kras.reduce(
                    (s, k) => s + Number(k.weight || 0),
                    0
                  ) >
                  0
                  ? { scale: 0.95 }
                  : {}
              }
            >
              <Plus size={18} />
              <span>Add New KRA</span>
            </motion.button>
          </div>

          {isAnyKRAZero && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-red-600 font-medium mt-3"
            >
              ⚠️ All KRA weights must be greater than 0% before saving.
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
