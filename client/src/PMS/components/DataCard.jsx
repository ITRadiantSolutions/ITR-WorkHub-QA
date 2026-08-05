export default function DataCard({ avatarLabel, avatarClass, title, subtitle, topRight, dateLine, meta, actionLabel, onAction, actionIcon: ActionIcon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col hover:shadow-md hover:border-violet-200 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarClass || "bg-violet-100 text-violet-700"}`}>
            {avatarLabel}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-800 text-sm truncate">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
        {topRight && <div className="shrink-0">{topRight}</div>}
      </div>

      {dateLine && <span className="flex items-center gap-1.5 text-xs text-gray-400 mt-3">{dateLine}</span>}

      {meta && meta.length > 0 && (
        <div className="grid gap-2 mt-3 pt-3 border-t border-gray-100" style={{ gridTemplateColumns: `repeat(${meta.length}, minmax(0, 1fr))` }}>
          {meta.map((m, i) => (
            <div key={i} className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{m.label}</p>
              <div className="mt-1">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {onAction && (
        <button
          onClick={onAction}
          className="mt-3 w-full py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition flex items-center justify-center gap-1.5"
        >
          {actionLabel}
          {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
