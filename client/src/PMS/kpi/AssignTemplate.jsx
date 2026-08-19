import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../../services/api";
import Icons from "../../components/Icons";

export default function AssignTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState("user"); // "user" | "group"
  const [cycleId, setCycleId] = useState("");
  const [targetId, setTargetId] = useState(""); // group mode — a single group
  const [selectedUserIds, setSelectedUserIds] = useState(new Set()); // user mode — one or more people
  const [targetSearch, setTargetSearch] = useState("");
  const [weights, setWeights] = useState({}); // kraId -> weight string
  const [kpiEdits, setKpiEdits] = useState({}); // kraId -> [{title, description, weight}]
  const [expandedKra, setExpandedKra] = useState(null); // kraId currently showing its KPI editor

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      API.get(`/pms/kra/templates/${id}`),
      API.get("/pms/cycles"),
      API.get("/users"),
      API.get("/pms/users-groups"),
    ])
      .then(([tRes, cRes, uRes, gRes]) => {
        if (cancelled) return;
        setTemplate(tRes.data);
        setCycles(cRes.data || []);
        setUsers(uRes.data || []);
        setGroups(gRes.data || []);
        // Pre-fill from the template's own suggested per-KRA weight (set on
        // the New/Edit Template page) instead of always starting blank —
        // previously every KRA here started at "" regardless of what the
        // template specified, so only whichever field someone happened to
        // type into first ever ended up with a real value.
        const initialWeights = {};
        (tRes.data.kras || []).forEach((k) => {
          initialWeights[k._id] = k.weight != null ? String(k.weight) : "";
        });
        setWeights(initialWeights);
      })
      .catch(() => toast.error("Failed to load assignment data"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const totalWeight = useMemo(
    () => Object.values(weights).reduce((sum, w) => sum + (Number(w) || 0), 0),
    [weights],
  );

  const getKpiEdit = (kraId, k) =>
    kpiEdits[kraId] || (k.kpis || []).map((kpi) => ({ ...kpi, weight: kpi.weight != null ? String(kpi.weight) : "" }));

  const updateKpiField = (kraId, k, idx, field, value) => {
    setKpiEdits((prev) => {
      const rows = (prev[kraId] || getKpiEdit(kraId, k)).map((kpi, i) => (i === idx ? { ...kpi, [field]: value } : kpi));
      return { ...prev, [kraId]: rows };
    });
  };

  const addKpiRow = (kraId, k) => {
    setKpiEdits((prev) => ({ ...prev, [kraId]: [...(prev[kraId] || getKpiEdit(kraId, k)), { title: "", description: "", weight: "" }] }));
  };

  const removeKpiRow = (kraId, k, idx) => {
    setKpiEdits((prev) => ({ ...prev, [kraId]: (prev[kraId] || getKpiEdit(kraId, k)).filter((_, i) => i !== idx) }));
  };

  const filteredUsers = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, targetSearch]);

  const filteredGroups = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name?.toLowerCase().includes(q));
  }, [groups, targetSearch]);

  const submit = async () => {
    if (!cycleId) return toast.error("Select a cycle");
    if (mode === "user" && selectedUserIds.size === 0) return toast.error("Select at least one person");
    if (mode === "group" && !targetId) return toast.error("Select a group");
    if (totalWeight !== 100) return toast.error(`KRA weights must total exactly 100% (currently ${totalWeight}%)`);

    for (const k of template.kras || []) {
      if (!kpiEdits[k._id]) continue; // untouched — keep the template's snapshot as-is
      const named = kpiEdits[k._id].filter((kpi) => kpi.title.trim());
      if (named.some((kpi) => !(Number(kpi.weight) > 0))) {
        return toast.error(`Every KPI needs a weight greater than 0 (${k.name})`);
      }
      const total = named.reduce((sum, kpi) => sum + (Number(kpi.weight) || 0), 0);
      if (named.length > 0 && total !== 100) {
        return toast.error(`KPI weights must add up to 100% for ${k.name} (currently ${total}%)`);
      }
    }

    const kras = (template.kras || []).map((k) => {
      const editedKpis = kpiEdits[k._id];
      return {
        defRef: k._id,
        name: k.name,
        type: k.type,
        weight: Number(weights[k._id]) || 0,
        kpis: editedKpis
          ? editedKpis.filter((kpi) => kpi.title.trim()).map((kpi) => ({ title: kpi.title.trim(), description: (kpi.description || "").trim(), weight: Number(kpi.weight) }))
          : k.kpis,
      };
    });

    setSaving(true);
    try {
      const { data } =
        mode === "user"
          ? await API.post("/pms/kra/assignments/user", { cycleId, templateId: id, userIds: [...selectedUserIds], kras })
          : await API.post("/pms/kra/assignments/group", { cycleId, templateId: id, groupId: targetId, kras });

      const createdCount = data.assignments?.length || 0;
      const skipped = data.skipped || [];
      if (createdCount > 0) {
        toast.success(`KRAs assigned to ${createdCount} ${createdCount === 1 ? "person" : "people"}`);
      }
      if (skipped.length > 0) {
        toast.warning(
          `Already assigned for this cycle — skipped: ${skipped.map((s) => s.name).join(", ")}`,
        );
      }
      if (createdCount === 0 && skipped.length === 0) {
        toast.error("Nothing to assign");
        return;
      }
      navigate("/pms/templates");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <main className="max-w-2xl mx-auto px-6 py-8">
        <button onClick={() => navigate("/pms/templates")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
          <Icons.Back /> KPI Templates
        </button>

        {loading || !template ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Assign "{template.name}"</h2>
              <p className="text-sm text-slate-500">{template.kras?.length || 0} KRAs will be assigned for the selected cycle.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Cycle</label>
              <select value={cycleId} onChange={(e) => setCycleId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                <option value="">Select a cycle...</option>
                {cycles.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setMode("user"); setTargetId(""); setSelectedUserIds(new Set()); setTargetSearch(""); }}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${mode === "user" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500"}`}
              >
                Individual
              </button>
              <button
                onClick={() => { setMode("group"); setTargetId(""); setSelectedUserIds(new Set()); setTargetSearch(""); }}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${mode === "group" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500"}`}
              >
                Group
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {mode === "user" ? "People" : "Group"}
                </label>
                {mode === "user" && selectedUserIds.size > 0 && (
                  <span className="text-xs font-semibold text-violet-600">{selectedUserIds.size} selected</span>
                )}
              </div>
              <input
                type="text"
                value={targetSearch}
                onChange={(e) => setTargetSearch(e.target.value)}
                placeholder={mode === "user" ? "Search by name or email..." : "Search by group name..."}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm mb-2"
              />
              <div className="max-h-56 overflow-y-auto space-y-1 rounded-xl border border-slate-100 p-1">
                {mode === "user" ? (
                  filteredUsers.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-4">No matches</p>
                  ) : (
                    filteredUsers.map((u) => {
                      const checked = selectedUserIds.has(u._id);
                      return (
                        <label
                          key={u._id}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition cursor-pointer ${
                            checked ? "bg-violet-50 border border-violet-200 text-violet-700 font-semibold" : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedUserIds((prev) => {
                                const next = new Set(prev);
                                next.has(u._id) ? next.delete(u._id) : next.add(u._id);
                                return next;
                              })
                            }
                            className="accent-violet-600 shrink-0"
                          />
                          {u.name} <span className="text-xs text-slate-400">({u.email})</span>
                        </label>
                      );
                    })
                  )
                ) : filteredGroups.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-4">No matches</p>
                ) : (
                  filteredGroups.map((g) => (
                    <button
                      key={g._id}
                      type="button"
                      onClick={() => setTargetId(g._id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                        targetId === g._id ? "bg-violet-50 border border-violet-200 text-violet-700 font-semibold" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {g.name} <span className="text-xs text-slate-400">({g.members?.length || 0} members)</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">KRA weights</label>
                <span className={`text-xs font-semibold ${totalWeight === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                  Total: {totalWeight}%
                </span>
              </div>
              <div className="space-y-1.5">
                {(template.kras || []).map((k) => {
                  const isExpanded = expandedKra === k._id;
                  const kpiRows = getKpiEdit(k._id, k);
                  const namedKpiRows = kpiRows.filter((kpi) => kpi.title.trim());
                  const kpiTotal = namedKpiRows.reduce((sum, kpi) => sum + (Number(kpi.weight) || 0), 0);
                  return (
                    <div key={k._id} className="space-y-1.5">
                      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2">
                        <span className="flex-1 text-sm text-slate-800">{k.name}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={weights[k._id] || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") return setWeights((prev) => ({ ...prev, [k._id]: v }));
                            const n = Number(v);
                            if (n < 0) return;
                            // Cap this field so the running total across all KRAs can never exceed 100%.
                            const othersTotal = Object.entries(weights).reduce(
                              (sum, [kraId, w]) => (kraId === k._id ? sum : sum + (Number(w) || 0)),
                              0,
                            );
                            if (n > 100 - othersTotal) return;
                            setWeights((prev) => ({ ...prev, [k._id]: v }));
                          }}
                          placeholder="0"
                          className="w-20 rounded-lg border border-slate-200 text-sm px-2 py-1 text-right"
                        />
                        <span className="text-xs text-slate-400">%</span>
                        <button
                          type="button"
                          onClick={() => setExpandedKra(isExpanded ? null : k._id)}
                          className="text-xs font-semibold text-violet-600 hover:underline shrink-0"
                        >
                          {isExpanded ? "Hide KPIs" : "Edit KPI weights"}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="ml-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">KPI weights for {k.name}</p>
                          {kpiRows.map((kpi, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                value={kpi.title}
                                onChange={(e) => updateKpiField(k._id, k, i, "title", e.target.value)}
                                placeholder="KPI title"
                                className="flex-1 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5 bg-white"
                              />
                              <input
                                value={kpi.weight}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v !== "" && (Number(v) < 0 || Number(v) > 100)) return;
                                  updateKpiField(k._id, k, i, "weight", v);
                                }}
                                type="number"
                                min={0}
                                max={100}
                                placeholder="Weight %"
                                className="w-20 rounded-lg border border-slate-200 text-xs px-2.5 py-1.5 bg-white"
                              />
                              <button type="button" onClick={() => removeKpiRow(k._id, k, i)} className="text-slate-400 hover:text-red-500 shrink-0">
                                <Icons.Trash />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addKpiRow(k._id, k)} className="text-[11px] font-semibold text-violet-600">
                            + Add KPI row
                          </button>
                          {namedKpiRows.length > 0 && (
                            <p className={`text-[11px] font-semibold ${kpiTotal === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                              KPI weight total: {kpiTotal}% {kpiTotal !== 100 && "(must equal 100%)"}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={submit}
              disabled={saving}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow"
            >
              {saving ? "Assigning..." : "Assign KRAs"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
