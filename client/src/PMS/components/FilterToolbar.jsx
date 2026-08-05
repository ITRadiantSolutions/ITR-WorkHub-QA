import { Search, Download, RotateCcw } from "lucide-react";

export default function FilterToolbar({ search, children, onExport, exportLabel = "Export", onClearFilters, showClear = false }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-5 flex items-center gap-2 flex-wrap">
      {search && (
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder || "Search..."}
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
          />
        </div>
      )}

      {children}

      <div className="ml-auto flex items-center gap-2">
        {showClear && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-violet-700 hover:bg-violet-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-800 to-violet-600 text-white text-sm font-semibold shadow-sm hover:from-violet-900 hover:to-violet-700 transition"
          >
            <Download className="w-4 h-4" />
            {exportLabel}
          </button>
        )}
      </div>
    </div>
  );
}
