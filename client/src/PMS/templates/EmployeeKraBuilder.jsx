import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Save } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { confirmDialog } from "../../components/ConfirmDialog";

const DRAFT_KEY = "kras_builder";

// This file's original fetch() calls sent no Authorization header (the old
// app served frontend+backend from one origin). Ours are separate origins
// behind a JWT, so every request needs the token attached.
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export default function EmployeeKraBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const { kraId } = useParams();
  const isEditMode = Boolean(kraId);

  const [type, setType] = useState("");
  const [kras, setKras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);


  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.roles?.pms?.toLowerCase();
  if (!["hr", "manager"].includes(role)) {
    return <div className="text-center mt-20 text-red-500">Access Denied</div>;
  }

  useEffect(() => {
    const load = async () => {
      if (!isEditMode) {
        const savedDraft = sessionStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            if (Array.isArray(parsed)) {
              setKras(parsed);
            } else {
              setType(parsed?.type || "");
              setKras(Array.isArray(parsed?.kras) ? parsed.kras : []);
            }
          } catch {
            sessionStorage.removeItem(DRAFT_KEY);
          }
        }
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/kra-library", { headers: authHeaders() });
        if (!res.ok) {
          throw new Error("Failed to fetch KRA library.");
        }

        const data = await res.json();
        const found = (data || []).find((k) => String(k.id) === String(kraId));

        if (!found) {
          toast.warning("Selected KRA could not be found.");
          navigate(-1);
          return;
        }

        setType(found.type || "");
        setKras([
          {
            id: found.id,
            name: found.name || "",
            kpis: (found.kpis || []).map((kpi) => ({
              id: kpi.id || crypto.randomUUID(),
              name: kpi.name || "",
            })),
          },
        ]);
      } catch (err) {
        toast.error(err?.message || "Failed to load KRA.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isEditMode, kraId, navigate]);

  useEffect(() => {
    if (isEditMode) return;
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        type,
        kras,
      })
    );
  }, [type, kras, isEditMode]);

  useEffect(() => {
    if (isEditMode || loading) return;
    if (!type) return;
    if (kras.length === 0) {
      setKras([{ id: crypto.randomUUID(), name: "", kpis: [{ id: crypto.randomUUID(), name: "" }] }]);
    }
  }, [type, isEditMode, loading, kras.length]);

  const addKra = () => {
    if (!type) {
      toast.warning("Please select a KRA type first.");
      return;
    }

    setKras((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", kpis: [{ id: crypto.randomUUID(), name: "" }] },
    ]);
  };

  const updateKraName = (id, value) => {
    setKras((prev) => prev.map((k) => (k.id === id ? { ...k, name: value } : k)));
  };

  const deleteKra = async (id) => {
    const confirmed = await confirmDialog({
      title: "Delete this KRA?",
      text: "This removes all KPIs under it.",
      confirmText: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setKras((prev) => prev.filter((k) => k.id !== id));
  };

  const addKpi = (targetKraId) => {
    setKras((prev) =>
      prev.map((k) =>
        k.id === targetKraId
          ? { ...k, kpis: [...k.kpis, { id: crypto.randomUUID(), name: "" }] }
          : k
      )
    );
  };

  const updateKpi = (targetKraId, kpiId, value) => {
    setKras((prev) =>
      prev.map((k) =>
        k.id === targetKraId
          ? {
            ...k,
            kpis: k.kpis.map((p) => (p.id === kpiId ? { ...p, name: value } : p)),
          }
          : k
      )
    );
  };

  const deleteKpi = (targetKraId, kpiId) => {
    setKras((prev) =>
      prev.map((k) =>
        k.id === targetKraId ? { ...k, kpis: k.kpis.filter((p) => p.id !== kpiId) } : k
      )
    );
  };

  const totalKpis = useMemo(
    () => kras.reduce((count, kra) => count + (kra.kpis?.length || 0), 0),
    [kras]
  );

  const validationErrors = useMemo(() => {
    const errors = [];

    if (!type) {
      errors.push("Select a KRA type.");
    }

    if (!kras.length) {
      errors.push("Add at least one KRA.");
      return errors;
    }

    const kraNames = new Set();

    kras.forEach((kra, kraIndex) => {
      const kraName = (kra.name || "").trim();
      if (!kraName) {
        errors.push(`KRA ${kraIndex + 1}: title is required.`);
      } else {
        const normalized = kraName.toLowerCase();
        if (kraNames.has(normalized)) {
          errors.push(`KRA "${kraName}" is duplicated.`);
        }
        kraNames.add(normalized);
      }

      if (!kra.kpis?.length) {
        errors.push(`KRA ${kraIndex + 1}: add at least one KPI.`);
        return;
      }

      kra.kpis.forEach((kpi, kpiIndex) => {
        if (!(kpi.name || "").trim()) {
          errors.push(`KRA ${kraIndex + 1}, KPI ${kpiIndex + 1}: description is required.`);
        }
      });
    });

    return errors;
  }, [type, kras]);

  const canSave = !loading && !isSaving && validationErrors.length === 0;

  const save = async () => {
    if (validationErrors.length > 0) {
      toast.warning(
        `Fix required fields: ${validationErrors.slice(0, 6).join(", ")}`
      );
      return;
    }

    try {
      setIsSaving(true);

      if (isEditMode) {
        const kra = kras[0];
        const response = await fetch(`/api/kra-library/${kraId}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            name: kra.name.trim(),
            kpis: kra.kpis.map((kpi) => ({ ...kpi, name: (kpi.name || "").trim() })),
            type,
            updatedBy: user?.name || user?.username || user?.fullname || "Unknown User",
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          toast.warning(
            data?.detail ||
              "This KRA is already used in a template and cannot be edited."
          );
          return;
        }

        toast.success("KRA updated successfully");
      } else {
        const response = await fetch("/api/kra-library", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            type,
            kras: kras.map((kra) => ({
              ...kra,
              name: (kra.name || "").trim(),
              kpis: (kra.kpis || []).map((kpi) => ({
                ...kpi,
                name: (kpi.name || "").trim(),
              })),
            })),
            createdBy: user?.name || user?.username || user?.fullname || "Unknown User",
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          toast.error(data?.detail || "Failed to create KRA");
          return;
        }

        toast.success("KRA created successfully");
      }

      sessionStorage.removeItem(DRAFT_KEY);
      if (from === "create_template") {
        navigate("/create_template");
      } else if (from === "assign_individual") {
        navigate("/assign-individual?step=2");
      } else {
        navigate("/employeetemplate");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="text-center mt-20">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-xl bg-white border shadow-sm hover:shadow-md text-sm font-medium"
          >
            {"<-"} Back
          </motion.button>

          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-purple-600 bg-clip-text text-transparent">
            {isEditMode ? "Edit KRA" : "Create KRA"}
          </h2>

          <div className="w-[90px]" />
        </div>

        {["hr", "manager"].includes(role) && (
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
            <label className="block text-sm font-semibold text-slate-600">Select KRA Type</label>

            <div className={`grid gap-3 ${role === "hr" ? "grid-cols-2" : "grid-cols-1"}`}>
              {/* Functional KRA - visible for HR + Manager */}
              <button
                onClick={() => setType("functional")}
                className={`p-3 rounded-xl border text-sm font-semibold transition-all ${type === "functional"
                  ? "bg-purple-100 border-purple-400 text-purple-700"
                  : "bg-white border-slate-300 hover:bg-slate-50"
                  }`}
              >
                Job Specified KRA
              </button>

              {/* Organizational KRA - only HR */}
              <button
                onClick={() => setType("organizational")}
                className={`p-3 rounded-xl border text-sm font-semibold transition-all ${type === "organizational"
                  ? "bg-purple-100 border-purple-400 text-purple-700"
                  : "bg-white border-slate-300 hover:bg-slate-50"
                  }`}
              >
                Organizational KRA
              </button>

            </div>

            <div className="text-xs text-slate-500">
              KRAs: {kras.length} | KPIs: {totalKpis}
            </div>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            {validationErrors.slice(0, 6).map((error, index) => (
              <div key={index}>- {error}</div>
            ))}
          </div>
        )}

        {!kras.length && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500">
            {type ? "KRA section will appear automatically." : "Loading KRA builder..."}
          </div>
        )}

        <AnimatePresence>
          {kras.map((kra, index) => (
            <motion.div
              key={kra.id}
              initial={{ opacity: 0, y: 15, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl p-6 space-y-5 bg-white/80 backdrop-blur-md border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
            >
              <div className="flex items-center gap-3 min-h-[40px]">
                <div className="text-xs font-semibold text-slate-400 w-6">{index + 1}.</div>

                <input
                  value={kra.name}
                  onChange={(e) => updateKraName(kra.id, e.target.value)}
                  placeholder="Enter KRA title"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-sm"
                />

                {!isEditMode && (
                  <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => deleteKra(kra.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </motion.button>
                )}
              </div>

              <div className="space-y-2">
                {(kra.kpis || []).map((kpi, i) => (
                  <motion.div
                    key={kpi.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 ml-8"
                  >
                    <div className="text-xs text-slate-400 w-6 text-right">{i + 1}</div>

                    <input
                      value={kpi.name}
                      onChange={(e) => updateKpi(kra.id, kpi.id, e.target.value)}
                      placeholder={`KPI ${i + 1} description`}
                      className="flex-1 px-3 py-1.5 rounded-md border border-slate-300 focus:ring-2 focus:ring-purple-400 outline-none text-sm"
                    />

                    <button
                      onClick={() => deleteKpi(kra.id, kpi.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </motion.div>
                ))}
              </div>
              <div className="flex justify-end ml-8">
                <button
                  onClick={() => addKpi(kra.id)}
                  className="w-8 h-8 rounded-full border border-purple-300 text-purple-600 hover:bg-purple-50 flex items-center justify-center"
                  title="Add KPI"
                >
                  <Plus size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!isEditMode && type && (
          <div className="flex justify-center">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={addKra}
              className="w-10 h-10 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 flex items-center justify-center"
              title="Add New KRA"
            >
              <Plus size={18} />
            </motion.button>
          </div>
        )}

        {Boolean(kras.length) && (
          <div className="text-center pt-2">
            <motion.button
              whileHover={{ scale: canSave ? 1.07 : 1 }}
              whileTap={{ scale: canSave ? 0.96 : 1 }}
              onClick={save}
              disabled={!canSave}
              className={`inline-flex items-center gap-2 px-8 py-3 rounded-2xl text-white font-semibold shadow-2xl ${canSave
                ? "bg-gradient-to-r from-purple-600 via-purple-600 to-pink-600"
                : "bg-slate-400 cursor-not-allowed"
                }`}
            >
              <Save size={16} />
              {isSaving ? "Saving..." : isEditMode ? "Update KRA" : "Save KRA"}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
