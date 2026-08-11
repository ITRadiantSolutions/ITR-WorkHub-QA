import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Mail } from "lucide-react";
import { employeesApi } from "../hrmsApi";
import getInitials from "../../utils/getInitials";

// Shades of the HRMS module's own theme color (cyan) instead of a mixed
// rainbow palette, so avatars still vary but stay on-brand.
const AVATAR_GRADIENTS = [
  "from-cyan-950 to-cyan-800",
  "from-cyan-900 to-cyan-700",
  "from-cyan-800 to-cyan-600",
  "from-cyan-700 to-cyan-500",
  "from-cyan-600 to-cyan-400",
  "from-cyan-950 to-cyan-700",
];

// Stable per-person color regardless of sort order.
const avatarGradient = (key) => {
  const hash = [...(key || "")].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

export default function MyTeam() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeesApi
      .myReports()
      .then((res) => setReports(res.data?.data || []))
      .catch(() => toast.error("Failed to load your team"))
      .finally(() => setLoading(false));
  }, []);

  const sortedReports = [...reports].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-cyan-700" /> My Team
        </h1>
        <p className="text-sm text-slate-500 mt-1">Your direct reports.</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading...</div>
      ) : sortedReports.length === 0 ? (
        <p className="text-sm text-slate-400 italic">You have no direct reports.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedReports.map((r) => (
            <div
              key={r._id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center transition hover:shadow-md hover:-translate-y-0.5"
            >
              <div className={`w-14 h-14 mx-auto rounded-full bg-gradient-to-br ${avatarGradient(r.email || r.name)} text-white font-bold flex items-center justify-center text-lg shadow-sm`}>
                {getInitials(r.name)}
              </div>
              <p className="mt-3 font-semibold text-slate-800 truncate">{r.name}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold truncate max-w-full">
                {r.designation || "Employee"}
              </span>
              <p className="text-xs text-slate-400 truncate mt-2 flex items-center justify-center gap-1">
                <Mail className="w-3 h-3 shrink-0" /> {r.email}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
