import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Network, Search, ChevronRight, Users, Home } from "lucide-react";
import { orgChartApi } from "../hrmsApi";
import getInitials from "../../utils/getInitials";

// Same on-brand palette as MyTeam.jsx.
const AVATAR_GRADIENTS = [
  "from-cyan-950 to-cyan-800",
  "from-cyan-900 to-cyan-700",
  "from-cyan-800 to-cyan-600",
  "from-cyan-700 to-cyan-500",
  "from-cyan-600 to-cyan-400",
  "from-cyan-950 to-cyan-700",
];
const avatarGradient = (key) => {
  const hash = [...(key || "")].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

// The API returns a flat roster; the tree (multiple roots possible — e.g.
// more than one department head with no manager) is built client-side.
function buildTree(employees) {
  const byId = new Map(employees.map((e) => [e._id, { ...e, children: [] }]));
  const roots = [];
  for (const emp of byId.values()) {
    const managerId = emp.managerId?._id || emp.managerId || null;
    const manager = managerId ? byId.get(managerId) : null;
    if (manager) manager.children.push(emp);
    else roots.push(emp);
  }
  const sortChildren = (node) => {
    node.children.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    node.children.forEach(sortChildren);
  };
  roots.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  roots.forEach(sortChildren);
  return { roots, byId };
}

// Root-to-target chain of ids, walking up via managerId — used to jump the
// column view straight to a search result.
function ancestorPath(employees, targetId) {
  const byId = new Map(employees.map((e) => [e._id, e]));
  const path = [];
  let current = byId.get(targetId);
  while (current) {
    path.unshift(current._id);
    const managerId = current.managerId?._id || current.managerId || null;
    current = managerId ? byId.get(managerId) : null;
  }
  return path;
}

// Columns are generations, left to right — column 0 is the roots, column N
// is the children of whatever's selected in column N-1 (`path[N-1]`). A
// Miller-column / Finder-style drill-down reads far better than a fan-out
// diagram once any node has more than a handful of reports (some here have
// 20+), which a connector-line chart can't show without becoming unreadably
// wide.
function computeColumns(roots, path, byId) {
  const columns = [roots];
  for (const id of path) {
    const node = byId.get(id);
    if (!node || node.children.length === 0) break;
    columns.push(node.children);
  }
  return columns;
}

function PersonRow({ node, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition ${
        active ? "bg-cyan-50" : "hover:bg-slate-50"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(node.email || node.name)} text-white font-bold flex items-center justify-center text-xs shadow-sm shrink-0`}
      >
        {getInitials(node.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${active ? "text-cyan-800" : "text-slate-800"}`}>{node.name}</p>
        <p className="text-xs text-slate-400 truncate">{node.designation || "Employee"}</p>
      </div>
      {node.children.length > 0 && (
        <span className="shrink-0 flex items-center gap-1 text-slate-300">
          {node.children.length > 1 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
              <Users className="w-2.5 h-2.5" /> {node.children.length}
            </span>
          )}
          <ChevronRight className="w-4 h-4" />
        </span>
      )}
    </button>
  );
}

export default function OrgChart() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [path, setPath] = useState([]);

  useEffect(() => {
    orgChartApi
      .list()
      .then((res) => setEmployees(res.data || []))
      .catch(() => toast.error("Failed to load org chart"))
      .finally(() => setLoading(false));
  }, []);

  const { roots, byId } = useMemo(() => buildTree(employees), [employees]);
  const columns = useMemo(() => computeColumns(roots, path, byId), [roots, path, byId]);
  const breadcrumb = path.map((id) => byId.get(id)).filter(Boolean);

  const selectAt = (colIdx, nodeId) => setPath((prev) => [...prev.slice(0, colIdx), nodeId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = search.trim().toLowerCase();
    if (!query) return;
    const match = employees.find(
      (emp) =>
        (emp.name || "").toLowerCase().includes(query) ||
        (emp.designation || "").toLowerCase().includes(query) ||
        (emp.department || "").toLowerCase().includes(query),
    );
    if (!match) {
      toast.error("No match found");
      return;
    }
    setPath(ancestorPath(employees, match._id));
  };

  return (
    // No max-w cap here (unlike other HRMS pages) — the whole point of the
    // column view is horizontal room, and drilling a few levels deep easily
    // needs more than the usual 6xl content width before columns should
    // start scrolling internally.
    <main className="px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Network className="w-6 h-6 text-cyan-700" /> Org Chart
          </h1>
          <p className="text-sm text-slate-500 mt-1">Reporting hierarchy across the organization.</p>
        </div>
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, or department"
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          />
        </form>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : roots.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No employees to display.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-100 text-xs font-medium text-slate-500 overflow-x-auto whitespace-nowrap">
              <button onClick={() => setPath([])} className="flex items-center gap-1 hover:text-cyan-700 shrink-0">
                <Home className="w-3.5 h-3.5" />
              </button>
              {breadcrumb.map((node, i) => (
                <span key={node._id} className="flex items-center gap-1.5 shrink-0">
                  <ChevronRight className="w-3 h-3 text-slate-300" />
                  <button onClick={() => setPath(path.slice(0, i + 1))} className="hover:text-cyan-700 hover:underline">
                    {node.name}
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex overflow-x-auto">
            {columns.map((col, colIdx) => (
              <div key={colIdx} className="w-72 shrink-0 border-r border-slate-100 last:border-r-0 max-h-[65vh] overflow-y-auto divide-y divide-slate-50">
                {col.map((node) => (
                  <PersonRow key={node._id} node={node} active={node._id === path[colIdx]} onClick={() => selectAt(colIdx, node._id)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
