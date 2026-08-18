import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { employeesApi } from "../hrmsApi";
// Role & Access editing now goes through the super-admin-gated Manage /
// Access Grants pages instead of this per-employee tab — see hrmsrolecheck's
// hasManageAccess. Left commented (not deleted) in case it's reinstated.
// import ProjectRoleAssignmentPanel from "../components/ProjectRoleAssignmentPanel";
// import ModuleRolesPanel from "../components/ModuleRolesPanel";

const STATUS_OPTIONS = ["active", "on_leave", "terminated"];

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ department: "", designation: "", joiningDate: "", employmentStatus: "active" });

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    employeesApi
      .byId(id)
      .then((res) => {
        setEmployee(res.data.employee);
        setForm({
          department: res.data.employee.department || "",
          designation: res.data.employee.designation || "",
          joiningDate: res.data.employee.joiningDate ? res.data.employee.joiningDate.slice(0, 10) : "",
          employmentStatus: res.data.employee.employmentStatus || "active",
        });
      })
      .catch((err) => {
        const message = err.response?.data?.message || "Failed to load employee";
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await employeesApi.updateHrFields(id, form);
      toast.success("Employee updated");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="max-w-4xl mx-auto px-6 py-8 text-center text-slate-500">Loading...</main>;
  }

  if (loadError || !employee) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-8 text-center">
        <p className="text-sm text-slate-500 mb-4">{loadError || "Employee not found."}</p>
        <button onClick={() => navigate("/hrms/employees")} className="flex items-center gap-1.5 mx-auto text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-[18px] h-[18px]" /> Back to Employees
        </button>
      </main>
    );
  }

  const input = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm";
  const label = "text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1";

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <button onClick={() => navigate("/hrms/employees")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-[18px] h-[18px]" /> Back to Employees
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
        <h1 className="text-xl font-bold text-slate-900">{employee.name}</h1>
        <p className="text-sm text-slate-500">{employee.email}</p>
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab("overview")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "overview" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
          Overview
        </button>
        {/* Role & Access tab disabled — editing now happens via Manage / Access Grants (super-admin gated). */}
        {/* <button onClick={() => setTab("access")} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "access" ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
          Role & Access
        </button> */}
      </div>

      {tab === "overview" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Department</label>
              <input className={input} value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
            </div>
            <div>
              <label className={label}>Designation</label>
              <input className={input} value={form.designation} onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))} />
            </div>
            <div>
              <label className={label}>Joining date</label>
              <input type="date" className={input} value={form.joiningDate} onChange={(e) => setForm((p) => ({ ...p, joiningDate: e.target.value }))} />
            </div>
            <div>
              <label className={label}>Employment status</label>
              <select className={input} value={form.employmentStatus} onChange={(e) => setForm((p) => ({ ...p, employmentStatus: e.target.value }))}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Reporting manager</label>
              <p className="text-sm text-slate-700 px-3 py-2">{employee.managerId?.name || "—"}</p>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-sm font-semibold shadow disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {/* Role & Access panel disabled — editing now happens via Manage / Access Grants (super-admin gated).
      {tab === "access" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-bold text-slate-900 mb-1">Platform access</h2>
            <p className="text-xs text-slate-500 mb-3">This employee's role in each module.</p>
            <ModuleRolesPanel employee={employee} onChanged={load} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-bold text-slate-900 mb-1">Project roles</h2>
            <p className="text-xs text-slate-500 mb-3">Which projects this employee has access to, and their role on each.</p>
            <ProjectRoleAssignmentPanel userId={employee._id} canEdit />
          </div>
        </div>
      )}
      */}
    </main>
  );
}
