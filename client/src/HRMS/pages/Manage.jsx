import { useNavigate } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { canManageModule } from "../../utils/hrmsrolecheck";
import { MANAGE_MODULES } from "../moduleAccessConfig";

export default function Manage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Only the modules a super admin has actually granted this person show up
  // here — not the full set just because they hold hr/manager somewhere.
  const visibleModules = MANAGE_MODULES.filter((m) => canManageModule(user, m.key));

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-cyan-700" /> Manage
        </h1>
        <p className="text-sm text-slate-500 mt-1">Pick a module to see who has access and manage their role.</p>
      </div>

      {visibleModules.length === 0 ? (
        <p className="text-sm text-slate-400 italic">You haven't been granted access to manage any module yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {visibleModules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => navigate(`/hrms/manage/${m.key}`)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left hover:border-cyan-200 hover:shadow-md transition"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-bold text-slate-900">{m.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">Manage access &amp; roles</p>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
