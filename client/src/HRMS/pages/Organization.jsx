import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Building2, Plus, X, Star } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { departmentsApi, designationsApi, gradesApi, locationsApi, leaveTypesApi } from "../hrmsApi";

// Departments/Designations/Grades/Locations/Leave Types are near-identical
// reference tables (name + a couple of extra fields + active/inactive) — one
// config-driven manager instead of five copies of the same list/form/table.
const ENTITIES = {
  departments: {
    label: "Departments",
    api: departmentsApi,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "code", label: "Code" },
      { key: "description", label: "Description", type: "textarea" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "description", label: "Description" },
    ],
  },
  designations: {
    label: "Designations",
    api: designationsApi,
    fields: (ctx) => [
      { key: "name", label: "Name", required: true },
      {
        key: "department",
        label: "Department",
        type: "select",
        options: [{ value: "", label: "—" }, ...ctx.departments.map((d) => ({ value: d._id, label: d.name }))],
      },
      { key: "level", label: "Level", type: "number" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "departmentName", label: "Department" },
      { key: "level", label: "Level" },
    ],
    toRow: (d) => ({ ...d, departmentName: d.department?.name || "—" }),
    toForm: (d) => ({ ...d, department: d.department?._id || d.department || "" }),
  },
  grades: {
    label: "Grades",
    api: gradesApi,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "level", label: "Level", type: "number" },
      { key: "minSalary", label: "Min salary", type: "number" },
      { key: "maxSalary", label: "Max salary", type: "number" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "level", label: "Level" },
      { key: "band", label: "Salary band" },
    ],
    toRow: (g) => ({
      ...g,
      band: g.minSalary || g.maxSalary ? `${g.minSalary ?? "—"} – ${g.maxSalary ?? "—"}` : "—",
    }),
  },
  locations: {
    label: "Locations",
    api: locationsApi,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "city", label: "City" },
      { key: "country", label: "Country" },
      { key: "address", label: "Address", type: "textarea" },
      { key: "isHeadOffice", label: "Head office", type: "checkbox" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "city", label: "City" },
      { key: "country", label: "Country" },
      { key: "hq", label: "" },
    ],
    toRow: (l) => ({ ...l, hq: l.isHeadOffice ? "HQ" : "" }),
  },
  leaveTypes: {
    label: "Leave Types",
    api: leaveTypesApi,
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "code", label: "Code" },
      {
        key: "accrualType",
        label: "Accrual",
        type: "select",
        options: [
          { value: "monthly", label: "Monthly (pro-rata)" },
          { value: "yearly", label: "Yearly (full quota on Jan 1)" },
        ],
      },
      { key: "defaultDaysPerYear", label: "Days per year", type: "number" },
      {
        key: "carryForwardMode",
        label: "Carry-forward",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "half", label: "Half of remaining days" },
          { value: "all", label: "All remaining days" },
          { value: "fixed_cap", label: "Fixed cap (set below)" },
        ],
      },
      { key: "carryForwardCap", label: "Carry-forward cap (only used for \"Fixed cap\")", type: "number" },
      { key: "requiresDocument", label: "Requires a supporting document to apply", type: "checkbox" },
      {
        key: "allowExcessAsLop",
        label: "Allow requests beyond the balance (extra days become unpaid instead of being blocked)",
        type: "checkbox",
        defaultChecked: true,
      },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "accrualLabel", label: "Accrual" },
      { key: "defaultDaysPerYear", label: "Days/year" },
      { key: "carryForwardLabel", label: "Carry-forward" },
      { key: "capLabel", label: "Beyond balance" },
    ],
    toRow: (t) => ({
      ...t,
      accrualLabel: t.accrualType === "yearly" ? "Yearly" : "Monthly",
      carryForwardLabel: { none: "None", half: "Half", all: "All", fixed_cap: `Up to ${t.carryForwardCap}` }[t.carryForwardMode] || "None",
      capLabel: t.allowExcessAsLop === false ? "Blocked" : "Unpaid (LOP)",
    }),
  },
};

// A select with no blank option (e.g. accrual type) should default to its
// first real choice, not "" — otherwise the form silently submits an empty
// string for a required enum field until the user touches the dropdown.
const emptyForm = (fields) =>
  Object.fromEntries(fields.map((f) => {
    if (f.type === "checkbox") return [f.key, f.defaultChecked ?? false];
    if (f.type === "select") return [f.key, f.options?.[0]?.value ?? ""];
    return [f.key, ""];
  }));

function EntityForm({ config, ctx, initial, onClose, onSubmit, saving }) {
  const fields = typeof config.fields === "function" ? config.fields(ctx) : config.fields;
  const [form, setForm] = useState(() =>
    initial ? { ...emptyForm(fields), ...(config.toForm ? config.toForm(initial) : initial) } : emptyForm(fields),
  );
  const set = (key, type) => (e) =>
    setForm((p) => ({ ...p, [key]: type === "checkbox" ? e.target.checked : e.target.value }));

  const requiredMissing = fields.some((f) => f.required && !String(form[f.key] || "").trim());

  const handleSubmit = () => {
    const payload = { ...form };
    for (const f of fields) {
      if (f.type === "number" && payload[f.key] !== "") payload[f.key] = Number(payload[f.key]);
      if (f.type === "number" && payload[f.key] === "") payload[f.key] = null;
    }
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {initial ? `Edit ${config.label.slice(0, -1).toLowerCase()}` : `Add ${config.label.slice(0, -1).toLowerCase()}`}
          </h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {fields.map((f) => {
          if (f.type === "checkbox") {
            return (
              <label key={f.key} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={Boolean(form[f.key])} onChange={set(f.key, "checkbox")} className="rounded border-slate-300" />
                {f.label}
              </label>
            );
          }
          if (f.type === "select") {
            return (
              <select key={f.key} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form[f.key] || ""} onChange={set(f.key)}>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            );
          }
          if (f.type === "textarea") {
            return (
              <textarea
                key={f.key}
                placeholder={f.label}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={form[f.key] || ""}
                onChange={set(f.key)}
              />
            );
          }
          return (
            <input
              key={f.key}
              type={f.type === "number" ? "number" : "text"}
              placeholder={f.label + (f.required ? " *" : "")}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={form[f.key] ?? ""}
              onChange={set(f.key)}
            />
          );
        })}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          <button
            disabled={saving || requiredMissing}
            onClick={handleSubmit}
            className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : initial ? "Save changes" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntityPanel({ config, ctx, isHr }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    config.api.list({ includeInactive: "true" })
      .then((res) => setRows(res.data || []))
      .catch(() => toast.error(`Failed to load ${config.label.toLowerCase()}`))
      .finally(() => setLoading(false));
  }, [config]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        await config.api.update(editing._id, payload);
        toast.success(`${config.label.slice(0, -1)} updated`);
      } else {
        await config.api.create(payload);
        toast.success(`${config.label.slice(0, -1)} added`);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    try {
      await config.api.setStatus(row._id, !row.isActive);
      toast.success(row.isActive ? "Deactivated" : "Activated");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await config.api.importFromUsers();
      const { imported } = res.data || {};
      toast.success(imported > 0 ? `Imported ${imported} from employee records` : "Already up to date — nothing new to import");
      if (imported > 0) load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const displayRows = rows.map((r) => (config.toRow ? config.toRow(r) : r));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} {config.label.toLowerCase()}</p>
        {isHr && (
          <div className="flex items-center gap-2">
            {config.api.importFromUsers && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-200 text-cyan-700 hover:bg-cyan-50 text-xs font-semibold disabled:opacity-60"
                title="Bootstrap this list from the department/designation values already on employee records"
              >
                {importing ? "Importing..." : "Import from employees"}
              </button>
            )}
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold shadow"
            >
              <Plus className="w-3.5 h-3.5" /> Add {config.label.slice(0, -1).toLowerCase()}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {config.columns.map((c) => <th key={c.key} className="text-left px-4 py-3">{c.label}</th>)}
              <th className="text-left px-4 py-3">Status</th>
              {isHr && <th className="text-left px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={config.columns.length + 2} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            )}
            {!loading && displayRows.length === 0 && (
              <tr><td colSpan={config.columns.length + 2} className="px-4 py-8 text-center text-slate-400 italic">Nothing here yet.</td></tr>
            )}
            {!loading && displayRows.map((row) => (
              <tr key={row._id} className={row.isActive ? "" : "opacity-50"}>
                {config.columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-slate-700">
                    {c.key === "hq" && row.hq ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> HQ</span>
                    ) : (
                      row[c.key] ?? "—"
                    )}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {row.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                {isHr && (
                  <td className="px-4 py-3 flex gap-3">
                    <button onClick={() => { setEditing(row); setShowForm(true); }} className="text-cyan-700 font-semibold hover:underline text-xs">Edit</button>
                    <button onClick={() => toggleStatus(row)} className="text-slate-500 font-semibold hover:underline text-xs">
                      {row.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <EntityForm
          config={config}
          ctx={ctx}
          initial={editing}
          saving={saving}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

export default function Organization() {
  const { user } = useAuth();
  const isHr = user?.roles?.hrms === "hr";
  const [tab, setTab] = useState("departments");
  const [departments, setDepartments] = useState([]);

  // Designations' form needs the active department list for its dropdown,
  // independent of which tab is currently open.
  useEffect(() => {
    departmentsApi.list().then((res) => setDepartments(res.data || [])).catch(() => {});
  }, []);

  const ctx = useMemo(() => ({ departments }), [departments]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-cyan-700" /> Organization
        </h1>
        <p className="text-sm text-slate-500 mt-1">Departments, designations, grades and locations used across HRMS.</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {Object.entries(ENTITIES).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === key ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
          >
            {config.label}
          </button>
        ))}
      </div>

      <EntityPanel key={tab} config={ENTITIES[tab]} ctx={ctx} isHr={isHr} />
    </main>
  );
}
