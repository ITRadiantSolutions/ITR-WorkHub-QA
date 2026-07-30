import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { projectAPI } from "../services/projectApi";
import { toast } from "sonner";
import Icons from "./Icons";



// ── Input style ───────────────────────────────────────────────────────────────
const inputCls =
  "w-full border border-slate-200 bg-slate-50 px-3 py-2.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent focus:bg-white placeholder-slate-400 transition-all hover:border-slate-300 hover:bg-white";

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
          <Icons.Info />
          {hint}
        </p>
      )}
      {error && (
        <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>
      )}
    </div>
  );
}

// ── Toggle card ───────────────────────────────────────────────────────────────
function ToggleCard({
  icon: Ic,
  label,
  sublabel,
  count,
  checked,
  onChange,
  disabled,
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
        checked
          ? "border-slate-900 bg-slate-900 text-white shadow-md"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${checked ? "bg-white/20" : "bg-slate-100"}`}
      >
        <span className={checked ? "text-white" : "text-slate-500"}>
          <Ic />
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-bold ${checked ? "text-white" : "text-slate-800"}`}
        >
          {label}
        </p>
        <p
          className={`text-[11px] mt-0.5 ${checked ? "text-white/70" : "text-slate-400"}`}
        >
          {sublabel}
        </p>
      </div>
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
          checked ? "bg-white border-white" : "border-slate-300 bg-white"
        }`}
      >
        {checked && (
          <span className="text-slate-900">
            <Icons.Check />
          </span>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CloneProjectModal({
  isOpen,
  onClose,
  sourceProject,
  onSuccess,
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: `Copy of ${sourceProject?.name || ""}`,
    startDate: "",
    endDate: "",
    copySprints: true,
    copyTasks: true,
    copyMembers: true,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [cloned, setCloned] = useState(null); // { sprints, tasks } on success

  const canClone = user?.role === "ADMIN" || user?.role === "PM";

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Project name is required";
    if (
      form.startDate &&
      form.endDate &&
      new Date(form.startDate) >= new Date(form.endDate)
    )
      e.endDate = "End date must be after start date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleClone = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await projectAPI.cloneProject(sourceProject._id, form);
      setCloned(result.clonedCounts);
      toast.success(`"${form.name}" cloned successfully!`);
      onSuccess?.();
      setTimeout(onClose, 2000);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to clone project";
      toast.error(msg);
      setErrors({ submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setErrors({});
      setCloned(null);
      onClose();
    }
  };

  if (!isOpen || !sourceProject || !canClone) return null;

  const sourceStats = [
    { label: "Members", value: sourceProject.teamMembers?.length || 0 },
    { label: "Sprints", value: sourceProject.sprints?.length || 0 },
    { label: "Tasks", value: sourceProject.tasks?.length || 0 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-[460px] shadow-2xl overflow-hidden"
        style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="relative px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-4">
            {/* Icons */}
            <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0">
              <Icons.Copy />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900">
                Clone Project
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                From:{" "}
                <span className="font-semibold text-slate-700">
                  {sourceProject.name}
                </span>
              </p>
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <Icons.X />
            </button>
          </div>

          {/* Source project quick stats */}
          <div className="flex items-center gap-2 mt-4">
            {/* No counts display in header per user request */}

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 ml-auto">
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                  sourceProject.status === "Active"
                    ? "bg-emerald-100 text-emerald-700"
                    : sourceProject.status === "Planning"
                      ? "bg-violet-100 text-violet-700"
                      : "bg-slate-200 text-slate-600"
                }`}
              >
                {sourceProject.status}
              </span>
            </div>
          </div>
        </div>

        {/* ── Form body ───────────────────────────────────────────────── */}
        {cloned ? (
          /* Success state */
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center text-emerald-600 mb-4">
              <Icons.CheckCircle />
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1">
              Cloned Successfully!
            </h4>
            <p className="text-sm text-slate-500 mb-4">
              <span className="font-semibold text-slate-800">
                "{form.name}"
              </span>{" "}
              is ready
            </p>
            <div className="flex items-center gap-3">
              {[
                { label: "Sprints copied", value: cloned.sprints },
                { label: "Tasks copied", value: cloned.tasks },
              ].map((d, i) => (
                <div
                  key={i}
                  className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center"
                >
                  <p className="text-2xl font-bold text-emerald-700">
                    {d.value}
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    {d.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-5">
              Closing automatically…
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
            {/* New project name */}
            <Field
              label="New Project Name"
              error={errors.name}
              hint="Give the clone a distinct name to avoid confusion"
            >
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Q3 Website Redesign (Clone)"
              />
            </Field>

            {/* Date range */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Date Range{" "}
                <span className="font-normal normal-case text-slate-400">
                  (optional — leave blank to keep original)
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icons.Calendar />
                  </div>
                  <input
                    type="date"
                    className={`${inputCls} pl-9`}
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Icons.Calendar />
                  </div>
                  <input
                    type="date"
                    className={`${inputCls} pl-9 ${errors.endDate ? "border-red-300 ring-1 ring-red-300" : ""}`}
                    value={form.endDate}
                    onChange={(e) =>
                      setForm({ ...form, endDate: e.target.value })
                    }
                  />
                </div>
              </div>
              {errors.endDate && (
                <p className="text-[11px] text-red-500 mt-1 font-medium">
                  {errors.endDate}
                </p>
              )}
            </div>

            {/* What to copy */}
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                What to copy
              </p>
              <div className="space-y-2">
                <ToggleCard
                  icon={Icons.Users}
                  label="Team Members & Lead"
                  sublabel="Team members and project lead"
                  checked={form.copyMembers}
                  onChange={(v) => setForm({ ...form, copyMembers: v })}
                />
                <ToggleCard
                  icon={Icons.Zap}
                  label="Sprints"
                  sublabel="All sprint cycles and timelines"
                  checked={form.copySprints}
                  onChange={(v) => setForm({ ...form, copySprints: v })}
                />
                <ToggleCard
                  icon={Icons.Tasks}
                  label="Tasks"
                  sublabel="All tasks with details & priorities"
                  checked={form.copyTasks}
                  onChange={(v) => setForm({ ...form, copyTasks: v })}
                />
              </div>

              {/* Selection summary */}
              <div className="mt-2.5 flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                <Icons.Info />
                <p className="text-[11px] text-blue-700">
                  {[
                    form.copyMembers && "members",
                    form.copySprints && "sprints",
                    form.copyTasks && "tasks",
                  ]
                    .filter(Boolean)
                    .join(", ") || "Nothing"}{" "}
                  will be copied. All tasks reset to{" "}
                  <span className="font-semibold">TODO</span>.
                </p>
              </div>
            </div>

            {/* Submit error */}
            {errors.submit && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                <span className="shrink-0 mt-0.5 font-bold">!</span>
                <span>{errors.submit}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {!cloned && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
            <button
              onClick={handleClone}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-60 text-sm active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Cloning project…
                </>
              ) : (
                <>
                  <Icons.Copy />
                  Clone Project
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
