import { useEffect, useState } from "react";
import Icons from "./Icons";

const DEFAULT_STATE = {
  open: false,
  title: "Are you sure?",
  text: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  danger: false,
};

let setDialogState = null;
let resolvePromise = null;

// Imperative confirm dialog — mirrors the ergonomics of the Swal.fire()
// confirm pattern it replaces: `const ok = await confirmDialog({...})`.
export function confirmDialog(options = {}) {
  return new Promise((resolve) => {
    resolvePromise = resolve;
    setDialogState?.({ ...DEFAULT_STATE, ...options, open: true });
  });
}

function close(result) {
  setDialogState?.(DEFAULT_STATE);
  resolvePromise?.(result);
  resolvePromise = null;
}

// Mounted once in App.jsx, next to <Toaster />.
export function ConfirmDialogHost() {
  const [state, setState] = useState(DEFAULT_STATE);

  useEffect(() => {
    setDialogState = setState;
    return () => {
      setDialogState = null;
    };
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const onKeyDown = (e) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.open]);

  if (!state.open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              state.danger ? "bg-red-50 text-red-600" : "bg-violet-50 text-violet-700"
            }`}
          >
            <Icons.AlertCircle />
          </div>
          <div className="min-w-0 pt-1">
            <h2 className="text-sm font-bold text-slate-900">{state.title}</h2>
            {state.text && <p className="mt-1.5 text-sm text-slate-500">{state.text}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            {state.cancelText}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              state.danger ? "bg-red-600 hover:bg-red-700" : "bg-violet-700 hover:bg-violet-800"
            }`}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
