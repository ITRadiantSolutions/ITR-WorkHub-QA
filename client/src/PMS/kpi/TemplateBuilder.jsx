import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../../services/api";
import Icons from "../../components/Icons";

const TYPES = [
  { value: "functional", label: "Functional" },
  { value: "organizational", label: "Organizational" },
];

const emptyKpiForm = () => ({ title: "", description: "", weight: "" });

function AddLibraryKraForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("functional");
  const [name, setName] = useState("");
  const [kpis, setKpis] = useState([emptyKpiForm()]);
  const [saving, setSaving] = useState(false);

  const updateKpi = (i, field, value) =>
    setKpis((prev) => prev.map((k, idx) => (idx === i ? { ...k, [field]: value } : k)));

  const namedKpis = kpis.filter((k) => k.title.trim());
  const totalKpiWeight = namedKpis.reduce((sum, k) => sum + (Number(k.weight) || 0), 0);
  const kpiWeightsValid = namedKpis.length === 0 || (namedKpis.every((k) => Number(k.weight) > 0) && totalKpiWeight === 100);

  const submit = async () => {
    if (!name.trim()) return toast.error("KRA name is required");
    if (namedKpis.some((k) => !(Number(k.weight) > 0))) {
      return toast.error("Every KPI needs a weight greater than 0");
    }
    if (namedKpis.length > 0 && totalKpiWeight !== 100) {
      return toast.error(`KPI weights must add up to 100% (currently ${totalKpiWeight}%)`);
    }
    setSaving(true);
    try {
      await API.post("/pms/kra/library", {
        type,
        name: name.trim(),
        kpis: namedKpis.map((k) => ({ title: k.title.trim(), description: k.description.trim(), weight: Number(k.weight) || 0 })),
      });
      toast.success("Added to library");
      setName("");
      setKpis([emptyKpiForm()]);
      setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add KRA");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 text-xs font-semibold py-2.5 hover:border-violet-300 hover:text-violet-600"
      >
        <Icons.Plus /> Add new KRA to library
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 text-xs px-2 py-1.5 bg-white">
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="KRA name"
          className="flex-1 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5"
        />
      </div>

      {kpis.map((k, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={k.title}
            onChange={(e) => updateKpi(i, "title", e.target.value)}
            placeholder="KPI title"
            className="flex-1 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5"
          />
          <input
            value={k.weight}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "" && (Number(v) < 0 || Number(v) > 100)) return;
              updateKpi(i, "weight", v);
            }}
            placeholder="Weight %"
            type="number"
            min={0}
            max={100}
            className="w-20 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5"
          />
        </div>
      ))}
      <button onClick={() => setKpis((prev) => [...prev, emptyKpiForm()])} className="text-[11px] font-semibold text-violet-600">
        + Add KPI row
      </button>

      {namedKpis.length > 0 && (
        <p className={`text-[11px] font-semibold ${totalKpiWeight === 100 ? "text-emerald-600" : "text-amber-600"}`}>
          KPI weight total: {totalKpiWeight}% {totalKpiWeight !== 100 && "(must equal 100%)"}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={submit}
          disabled={saving || !kpiWeightsValid}
          title={!kpiWeightsValid ? "Give every KPI a weight greater than 0 that adds up to 100%" : undefined}
          className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save to library"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-slate-500 text-xs font-semibold">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function TemplateBuilder() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [library, setLibrary] = useState([]);
  // key `${type}:${kraId}` -> { libraryType, kraId, name, weight }. `weight`
  // is this KRA's suggested share of the template (string, "" = unset) —
  // carried through to pre-fill AssignTemplate.jsx instead of leaving every
  // KRA's weight blank there regardless of what the template specifies.
  const [selected, setSelected] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Local, per-KRA edits to that KRA's own KPI weights (title/description/weight),
  // key `${type}:${kraId}` -> array of kpi objects. Lazily seeded from the
  // library entry's current kpis the first time a row is expanded; cleared
  // once saved so it re-syncs from the refreshed library data.
  const [kpiEdits, setKpiEdits] = useState({});
  const [savingKpisKey, setSavingKpisKey] = useState(null);

  const loadLibrary = () => API.get("/pms/kra/library").then((res) => setLibrary(res.data || []));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const tasks = [loadLibrary()];
    if (isEdit) {
      tasks.push(
        API.get(`/pms/kra/templates/${id}`).then((res) => {
          if (cancelled) return;
          setName(res.data.name || "");
          const preselected = new Map();
          (res.data.kras || []).forEach((k) => {
            if (!k.originalId) return;
            preselected.set(`${k.type}:${k.originalId}`, {
              libraryType: k.type,
              kraId: k.originalId,
              name: k.name,
              weight: k.weight != null ? String(k.weight) : "",
            });
          });
          setSelected(preselected);
        }),
      );
    }
    Promise.all(tasks)
      .catch(() => toast.error("Failed to load"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const toggle = (type, entry) => {
    const key = `${type}:${entry._id}`;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, { libraryType: type, kraId: entry._id, name: entry.name, weight: "" });
      return next;
    });
  };

  const setKraWeight = (key, value) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(key);
      if (entry) next.set(key, { ...entry, weight: value });
      return next;
    });
  };

  // Caps a single KRA's weight input so the running total across every
  // selected KRA (Web Development + SAP + Test + ...) can never exceed
  // 100% — previously each field independently allowed up to 100 with no
  // cross-KRA constraint, so three KRAs could each sit at 100 (300% total).
  const onKraWeightChange = (key, value) => {
    if (value === "") return setKraWeight(key, value);
    const n = Number(value);
    if (n < 0) return;
    const othersTotal = Array.from(selected.entries()).reduce(
      (sum, [k, e]) => (k === key ? sum : sum + (Number(e.weight) || 0)),
      0,
    );
    if (n > 100 - othersTotal) return;
    setKraWeight(key, value);
  };

  const getKpiEdit = (key, entry) => kpiEdits[key] || (entry.kpis || []).map((k) => ({ ...k, weight: k.weight != null ? String(k.weight) : "" }));

  const updateKpiEditField = (key, entry, idx, field, value) => {
    setKpiEdits((prev) => {
      const rows = (prev[key] || getKpiEdit(key, entry)).map((k, i) => (i === idx ? { ...k, [field]: value } : k));
      return { ...prev, [key]: rows };
    });
  };

  const addKpiEditRow = (key, entry) => {
    setKpiEdits((prev) => ({ ...prev, [key]: [...(prev[key] || getKpiEdit(key, entry)), { title: "", description: "", weight: "" }] }));
  };

  // One button for the whole page instead of one per KRA — saves every KRA
  // that actually has pending KPI edits (kpiEdits only gets an entry once
  // you've touched a row), validating each independently before writing any
  // of them.
  const pendingKpiKeys = Object.keys(kpiEdits);

  const saveAllKpiWeights = async () => {
    if (!pendingKpiKeys.length) return;
    for (const key of pendingKpiKeys) {
      const rows = kpiEdits[key];
      const named = rows.filter((k) => k.title.trim());
      const kraName = selected.get(key)?.name || "a KRA";
      if (named.some((k) => !(Number(k.weight) > 0))) {
        return toast.error(`Every KPI needs a weight greater than 0 (${kraName})`);
      }
      const total = named.reduce((sum, k) => sum + (Number(k.weight) || 0), 0);
      if (named.length > 0 && total !== 100) {
        return toast.error(`KPI weights must add up to 100% for ${kraName} (currently ${total}%)`);
      }
    }
    setSavingKpisKey("all");
    try {
      for (const key of pendingKpiKeys) {
        const { libraryType, kraId } = selected.get(key) || {};
        const named = kpiEdits[key].filter((k) => k.title.trim());
        await API.put(`/pms/kra/library/${libraryType}/${kraId}`, {
          kpis: named.map((k) => ({ title: k.title.trim(), description: k.description.trim(), weight: Number(k.weight) })),
        });
      }
      toast.success("KPI weights updated");
      setKpiEdits({});
      await loadLibrary();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update KPI weights");
    } finally {
      setSavingKpisKey(null);
    }
  };

  const selectedWeightTotal = useMemo(
    () => Array.from(selected.values()).reduce((sum, e) => sum + (Number(e.weight) || 0), 0),
    [selected],
  );

  const submit = async () => {
    if (!name.trim()) return toast.error("Template name is required");
    if (!selected.size) return toast.error("Select at least one KRA");
    setSaving(true);
    const kraRefs = Array.from(selected.values()).map(({ libraryType, kraId, weight }) => ({
      libraryType,
      kraId,
      weight: weight !== "" && weight != null ? Number(weight) : null,
    }));
    try {
      if (isEdit) await API.put(`/pms/kra/templates/${id}`, { name: name.trim(), kraRefs });
      else await API.post("/pms/kra/templates", { name: name.trim(), kraRefs });
      toast.success(isEdit ? "Template updated" : "Template created");
      navigate("/pms/templates");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const byType = useMemo(() => {
    const map = {};
    TYPES.forEach((t) => (map[t.value] = library.find((d) => d.type === t.value)?.kras || []));
    return map;
  }, [library]);

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <main className="max-w-3xl mx-auto px-6 py-8">
        <button onClick={() => navigate("/pms/templates")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
          <Icons.Back /> KPI Templates
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-6">{isEdit ? "Edit template" : "New template"}</h2>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Template name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Software Engineer — Standard"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
              />
            </div>

            {TYPES.map((t) => (
              <div key={t.value}>
                <h3 className="text-sm font-bold text-slate-800 mb-2">{t.label} KRAs</h3>
                <div className="space-y-1.5 mb-2">
                  {!byType[t.value].length ? (
                    <p className="text-xs text-slate-400">No {t.label.toLowerCase()} KRAs in the library yet.</p>
                  ) : (
                    byType[t.value].map((entry) => {
                      const key = `${t.value}:${entry._id}`;
                      const checked = selected.has(key);
                      const kpiRows = checked ? getKpiEdit(key, entry) : null;
                      const namedKpiRows = kpiRows ? kpiRows.filter((k) => k.title.trim()) : [];
                      const kpiTotal = namedKpiRows.reduce((sum, k) => sum + (Number(k.weight) || 0), 0);
                      return (
                        <div key={entry._id} className="space-y-1.5">
                          <div
                            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${
                              checked ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                              <input type="checkbox" checked={checked} onChange={() => toggle(t.value, entry)} className="accent-violet-600 shrink-0" />
                              <span className="font-medium text-slate-800 truncate">{entry.name}</span>
                            </label>
                            {checked && (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={selected.get(key)?.weight || ""}
                                onChange={(e) => onKraWeightChange(key, e.target.value)}
                                placeholder="Weight %"
                                className="w-24 rounded-lg border border-slate-200 text-xs px-2 py-1.5 text-right shrink-0"
                              />
                            )}
                            <span className="text-xs text-slate-400 shrink-0">{entry.kpis?.length || 0} KPIs</span>
                          </div>

                          {checked && (
                            <div className="ml-6 rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">KPI weights for {entry.name}</p>
                              {kpiRows.map((k, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <input
                                    value={k.title}
                                    onChange={(e) => updateKpiEditField(key, entry, i, "title", e.target.value)}
                                    placeholder="KPI title"
                                    className="flex-1 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5 bg-white"
                                  />
                                  <input
                                    value={k.weight}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      if (v !== "" && (Number(v) < 0 || Number(v) > 100)) return;
                                      updateKpiEditField(key, entry, i, "weight", v);
                                    }}
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder="Weight %"
                                    className="w-20 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5 bg-white"
                                  />
                                </div>
                              ))}
                              <button onClick={() => addKpiEditRow(key, entry)} className="text-[11px] font-semibold text-violet-600">
                                + Add KPI row
                              </button>
                              {namedKpiRows.length > 0 && (
                                <p className={`text-[11px] font-semibold ${kpiTotal === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                                  KPI weight total: {kpiTotal}% {kpiTotal !== 100 && "(must equal 100%)"}
                                  {kpiEdits[key] === undefined && " — unchanged"}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <AddLibraryKraForm onAdded={loadLibrary} />
              </div>
            ))}

            {selected.size > 0 && (
              <p className={`text-xs font-semibold -mt-2 ${selectedWeightTotal === 100 ? "text-emerald-600" : "text-slate-400"}`}>
                Suggested KRA weight total: {selectedWeightTotal}%{selectedWeightTotal !== 100 && " (optional — weight is finalized when assigning to a person)"}
              </p>
            )}

            {pendingKpiKeys.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={saveAllKpiWeights}
                  disabled={savingKpisKey === "all"}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow disabled:opacity-50"
                >
                  <Icons.Save /> {savingKpisKey === "all" ? "Saving..." : "Save KPI weights"}
                </button>
                <span className="text-xs text-slate-400">
                  {pendingKpiKeys.length} KRA{pendingKpiKeys.length === 1 ? "" : "s"} with unsaved KPI changes
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={submit}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow"
              >
                <Icons.Save /> {saving ? "Saving..." : isEdit ? "Save changes" : "Create template"}
              </button>
              <span className="text-xs text-slate-400">{selected.size} KRA{selected.size === 1 ? "" : "s"} selected</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
