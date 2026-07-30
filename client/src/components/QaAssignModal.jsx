import { useEffect, useMemo, useState } from "react";
import { API } from "../services/api";
import Icons from "./Icons";

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function QaAssignModal({
  isOpen,
  onClose,
  task,
  onAssigned,
  suppressNotify = false,
}) {
  const [qaTesters, setQaTesters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qaTesterId, setQaTesterId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    const load = async () => {
      try {
        setError("");
        setLoading(true);

        if (!task?.projectId?._id && !task?.projectId) {
          throw new Error("Task project not found");
        }

        const projectId =
          typeof task.projectId === "object"
            ? task.projectId._id
            : task.projectId;

        const res = await API.get(`/projects/${projectId}/employees`, {
          signal: controller.signal,
        });

        const list = res?.data?.data || res?.data || [];
        const onlyQa = Array.isArray(list)
          ? list.filter((u) => u?.role === "QA")
          : [];

        setQaTesters(onlyQa);

        // If current task already has a QA assignee, preselect it.
        const existingQa = (task?.assignees || []).find((a) => {
          const aId = typeof a === "object" ? a._id : a;
          return onlyQa.some((q) => q._id?.toString() === aId?.toString());
        });

        const existingId = existingQa
          ? typeof existingQa === "object"
            ? existingQa._id
            : existingQa
          : "";

        setQaTesterId(existingId || onlyQa[0]?._id?.toString() || "");
      } catch (e) {
        if (e?.name === "AbortError") return;
        setQaTesters([]);
        setQaTesterId("");
        setError(
          e?.response?.data?.message || e.message || "Failed to load QA users",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [isOpen, task]);

  const selected = useMemo(
    () => qaTesters.find((q) => q._id?.toString() === qaTesterId?.toString()),
    [qaTesters, qaTesterId],
  );

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!qaTesterId) {
      setError("Select a QA tester");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post(
        `/tasks/${task._id}/qa-assign`,
        { qaTesterId },
        suppressNotify ? { suppressNotify: true } : {},
      );

      const updated = res?.data?.data || res?.data;
      onAssigned?.(updated);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to assign QA tester",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Assign QA Tester
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Move this task to{" "}
              <span className="font-semibold">QA Testing</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <Icons.X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <Field label="QA Tester" required>
            <select
              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-100"
              value={qaTesterId}
              onChange={(e) => setQaTesterId(e.target.value)}
              disabled={loading}
            >
              <option value="">{loading ? "Loading..." : "Select QA"}</option>
              {qaTesters.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </Field>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Task</span>
              <span className="text-slate-500">{task?.title}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Selected QA</span>
              <span className="text-slate-500">
                {selected ? selected.name : "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !qaTesterId}
              className="h-9 px-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-60"
            >
              {loading ? "Assigning..." : "Assign & Move to QA Testing"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
