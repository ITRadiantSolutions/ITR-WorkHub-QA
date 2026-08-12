import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Icons from "../../components/Icons";
import TemplateCard from "../TemplateCard";

// The employee-facing "My KRAs" page — one card per KraAssignment the
// caller was assigned, each backed by its own Submission (self-review +
// PIP). Replaces the old Template.jsx orchestrator, which drove this same
// view (plus an HR/manager KRA-library-authoring mode superseded by
// /pms/templates) through a much larger, legacy-shaped state tree.
export default function MyTemplate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [cyclesById, setCyclesById] = useState({});
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([API.get("/pms/kra/assignments"), API.get("/pms/cycles")])
      .then(([aRes, cRes]) => {
        setAssignments(aRes.data || []);
        setCyclesById(Object.fromEntries((cRes.data || []).map((c) => [c._id, c])));
      })
      .catch(() => toast.error("Failed to load your KRAs"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <main className="w-[92%] max-w-[1400px] mx-auto px-2 py-8">
        <button onClick={() => navigate("/pms")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
          <Icons.Back /> Overview
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">My KRAs &amp; PIP</h1>
          <p className="text-sm text-slate-500">Your assigned KRAs for the current cycle, plus any active PIP.</p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
            No KRAs assigned to you yet — check back once HR or your manager assigns a template.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            {assignments.map((a, i) => (
              <TemplateCard key={a._id} assignment={a} cycle={cyclesById[a.cycleId]} loggedInUser={user} tIndex={i} onChanged={load} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
