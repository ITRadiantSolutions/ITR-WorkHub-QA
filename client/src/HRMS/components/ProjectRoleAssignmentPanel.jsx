import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { API } from "../../services/api";
import { projectRolesApi } from "../hrmsApi";

const ROLES = ["employee", "manager", "hr"];

// Shared by EmployeeProfile (HR, any employee) and MyTeam (Manager, direct
// reports only) — the backend enforces the actual authorization either way.
export default function ProjectRoleAssignmentPanel({ userId, canEdit = true }) {
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newProjectId, setNewProjectId] = useState("");
  const [newRole, setNewRole] = useState("employee");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assignRes, projectsRes] = await Promise.all([
        projectRolesApi.forUser(userId),
        API.get("/projects"),
      ]);
      setAssignments(assignRes.data || []);
      setProjects(projectsRes.data || []);
    } catch {
      toast.error("Failed to load project roles");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async () => {
    if (!newProjectId) return;
    setSaving(true);
    try {
      await projectRolesApi.upsert(userId, newProjectId, newRole);
      toast.success("Project role assigned");
      setNewProjectId("");
      setNewRole("employee");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign role");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (assignment) => {
    try {
      await projectRolesApi.remove(assignment._id);
      toast.success("Removed");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove");
    }
  };

  const assignedProjectIds = new Set(assignments.map((a) => a.project?._id));
  const availableProjects = projects.filter((p) => !assignedProjectIds.has(p._id));

  if (loading) return <p className="text-sm text-slate-400">Loading project roles...</p>;

  return (
    <div className="space-y-3">
      {assignments.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No project roles assigned yet.</p>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
          {assignments.map((a) => (
            <div key={a._id} className="flex items-center justify-between px-4 py-2.5 bg-white">
              <div>
                <p className="text-sm font-semibold text-slate-800">{a.project?.name || "Unknown project"}</p>
                <p className="text-xs text-slate-400 capitalize">{a.role}</p>
              </div>
              {canEdit && (
                <button onClick={() => remove(a)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 items-center">
          <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Select a project...</option>
            {availableProjects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm capitalize">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={assign} disabled={saving || !newProjectId} className="p-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white disabled:opacity-50 shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
