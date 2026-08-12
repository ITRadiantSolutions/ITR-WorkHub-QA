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
  const [targetId, setTargetId] = useState("");
  const [weights, setWeights] = useState({}); // kraId -> weight string

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
        const initialWeights = {};
        (tRes.data.kras || []).forEach((k) => {
          initialWeights[k._id] = "";
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

  const submit = async () => {
    if (!cycleId) return toast.error("Select a cycle");
    if (!targetId) return toast.error(mode === "user" ? "Select a person" : "Select a group");

    const kras = (template.kras || []).map((k) => ({
      defRef: k._id,
      name: k.name,
      type: k.type,
      weight: Number(weights[k._id]) || 0,
      kpis: k.kpis,
    }));

    setSaving(true);
    try {
      if (mode === "user") {
        await API.post("/pms/kra/assignments/user", { cycleId, templateId: id, userId: targetId, kras });
      } else {
        await API.post("/pms/kra/assignments/group", { cycleId, templateId: id, groupId: targetId, kras });
      }
      toast.success("KRAs assigned");
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
                onClick={() => { setMode("user"); setTargetId(""); }}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${mode === "user" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500"}`}
              >
                Individual
              </button>
              <button
                onClick={() => { setMode("group"); setTargetId(""); }}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${mode === "group" ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500"}`}
              >
                Group
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                {mode === "user" ? "Person" : "Group"}
              </label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                <option value="">Select...</option>
                {mode === "user"
                  ? users.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                    ))
                  : groups.map((g) => (
                      <option key={g._id} value={g._id}>{g.name} ({g.members?.length || 0} members)</option>
                    ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">KRA weights</label>
                <span className={`text-xs font-semibold ${totalWeight === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                  Total: {totalWeight}%
                </span>
              </div>
              <div className="space-y-1.5">
                {(template.kras || []).map((k) => (
                  <div key={k._id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2">
                    <span className="flex-1 text-sm text-slate-800">{k.name}</span>
                    <input
                      type="number"
                      value={weights[k._id] || ""}
                      onChange={(e) => setWeights((prev) => ({ ...prev, [k._id]: e.target.value }))}
                      placeholder="0"
                      className="w-20 rounded-lg border border-slate-200 text-sm px-2 py-1 text-right"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                ))}
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
