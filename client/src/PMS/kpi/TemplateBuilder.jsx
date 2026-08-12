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

  const submit = async () => {
    if (!name.trim()) return toast.error("KRA name is required");
    setSaving(true);
    try {
      await API.post("/pms/kra/library", {
        type,
        name: name.trim(),
        kpis: kpis
          .filter((k) => k.title.trim())
          .map((k) => ({ title: k.title.trim(), description: k.description.trim(), weight: Number(k.weight) || 0 })),
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
            onChange={(e) => updateKpi(i, "weight", e.target.value)}
            placeholder="Weight %"
            type="number"
            className="w-20 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5"
          />
        </div>
      ))}
      <button onClick={() => setKpis((prev) => [...prev, emptyKpiForm()])} className="text-[11px] font-semibold text-violet-600">
        + Add KPI row
      </button>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={submit} disabled={saving} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold">
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
  const [selected, setSelected] = useState(new Map()); // key `${type}:${kraId}` -> { libraryType, kraId, name }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            preselected.set(`${k.type}:${k.originalId}`, { libraryType: k.type, kraId: k.originalId, name: k.name });
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
      else next.set(key, { libraryType: type, kraId: entry._id, name: entry.name });
      return next;
    });
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("Template name is required");
    if (!selected.size) return toast.error("Select at least one KRA");
    setSaving(true);
    const kraRefs = Array.from(selected.values()).map(({ libraryType, kraId }) => ({ libraryType, kraId }));
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
                      return (
                        <label
                          key={entry._id}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm cursor-pointer transition ${
                            checked ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => toggle(t.value, entry)} className="accent-violet-600" />
                          <span className="font-medium text-slate-800">{entry.name}</span>
                          <span className="text-xs text-slate-400 ml-auto">{entry.kpis?.length || 0} KPIs</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <AddLibraryKraForm onAdded={loadLibrary} />
              </div>
            ))}

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
