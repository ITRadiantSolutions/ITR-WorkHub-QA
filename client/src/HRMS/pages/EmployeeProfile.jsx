import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Download } from "lucide-react";
import { employeesApi, leaveRequestsApi, salaryStructuresApi, assetsApi, documentsApi, attendanceApi } from "../hrmsApi";
// Role & Access editing now goes through the super-admin-gated Manage /
// Access Grants pages instead of this per-employee tab — see hrmsrolecheck's
// hasManageAccess. Left commented (not deleted) in case it's reinstated.
// import ProjectRoleAssignmentPanel from "../components/ProjectRoleAssignmentPanel";
// import ModuleRolesPanel from "../components/ModuleRolesPanel";

const STATUS_OPTIONS = ["active", "on_leave", "terminated"];

const DOCUMENT_CATEGORY_LABELS = {
  offer_letter: "Offer Letter",
  id_proof: "ID Proof",
  education_certificate: "Education Certificate",
  experience_letter: "Experience Letter",
  policy_acknowledgement: "Policy Acknowledgement",
  other: "Other",
};

const money = (n) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");

const LEAVE_STATUS_LABELS = {
  pending_manager: "Pending manager",
  pending_skip_level: "Pending final approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
const LEAVE_STATUS_TONE = {
  pending_manager: "bg-amber-50 text-amber-700",
  pending_skip_level: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function LeaveTab({ balance, history }) {
  return (
    <div className="space-y-4">
      {balance.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No leave types configured yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {balance.map((b) => (
            <div key={b.leaveType._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-slate-500 truncate">{b.leaveType.name}</p>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{b.remaining}</p>
              <p className="text-[11px] text-slate-400">
                of {b.allocated} days{b.carriedForward > 0 && ` (incl. ${b.carriedForward} carried forward)`}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Dates</th><th className="text-left px-4 py-3">Days</th><th className="text-left px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No leave history yet.</td></tr>}
            {history.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-3 font-semibold text-slate-800">{r.leaveType?.name}</td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(r.startDate)}{r.startDate !== r.endDate && ` – ${fmtDate(r.endDate)}`}</td>
                <td className="px-4 py-3">{r.totalDays}{r.lopDays > 0 && <span className="text-red-600 text-xs font-semibold"> ({r.lopDays} LOP)</span>}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${LEAVE_STATUS_TONE[r.status] || "bg-slate-100 text-slate-600"}`}>
                    {LEAVE_STATUS_LABELS[r.status] || r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ATTENDANCE_STATUS_LABELS = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  on_leave: "On leave",
  holiday: "Holiday",
  weekend: "Weekend",
};
const ATTENDANCE_STATUS_TONE = {
  present: "bg-emerald-50 text-emerald-700",
  half_day: "bg-amber-50 text-amber-700",
  absent: "bg-red-50 text-red-700",
  on_leave: "bg-blue-50 text-blue-700",
  holiday: "bg-purple-50 text-purple-700",
  weekend: "bg-slate-100 text-slate-500",
};
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtHours = (secs) => (secs > 0 ? `${(secs / 3600).toFixed(1)}h` : "—");

function AttendanceTab({ records }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <p className="px-4 pt-4 text-xs font-semibold text-slate-500">This month</p>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">First in</th>
            <th className="text-left px-4 py-3">Last out</th>
            <th className="text-left px-4 py-3">Worked</th>
            <th className="text-left px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No attendance recorded this month yet.</td></tr>}
          {records.map((r) => (
            <tr key={r._id}>
              <td className="px-4 py-3 text-slate-700 font-medium">{fmtDate(r.date)}</td>
              <td className="px-4 py-3 text-slate-600">{fmtTime(r.firstIn)}</td>
              <td className="px-4 py-3 text-slate-600">{fmtTime(r.lastOut)}</td>
              <td className="px-4 py-3 text-slate-600">{fmtHours(r.workedSeconds)}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${ATTENDANCE_STATUS_TONE[r.status] || "bg-slate-100 text-slate-600"}`}>
                  {ATTENDANCE_STATUS_LABELS[r.status] || r.status}
                </span>
                {r.isLate && <span className="ml-2 text-[11px] font-semibold text-amber-600">Late</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayrollTab({ salaryStructure, navigate }) {
  if (!salaryStructure) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
        <p className="text-sm text-slate-500 mb-3">No salary structure set up yet.</p>
        <button onClick={() => navigate("/hrms/payroll")} className="text-cyan-700 font-semibold text-sm hover:underline">
          Set up in Payroll → Salary Structures
        </button>
      </div>
    );
  }

  const gross = salaryStructure.components.filter((c) => c.type === "earning").reduce((s, c) => s + c.amount, 0);
  const deductions = salaryStructure.components.filter((c) => c.type === "deduction").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden mb-4">
        {salaryStructure.components.map((c, i) => (
          <div key={i} className="flex justify-between px-4 py-2 text-sm">
            <span className="text-slate-600">{c.name}</span>
            <span className={c.type === "deduction" ? "text-red-600" : "text-slate-800"}>{c.type === "deduction" ? "−" : ""}{money(c.amount)}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm text-slate-500"><span>Gross earnings</span><span>{money(gross)}</span></div>
      <div className="flex justify-between text-sm text-slate-500"><span>Total deductions</span><span>−{money(deductions)}</span></div>
      <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-100 mt-1"><span>Net pay</span><span>{money(gross - deductions)}</span></div>
      <button onClick={() => navigate("/hrms/payroll")} className="mt-4 text-cyan-700 font-semibold text-xs hover:underline">
        Edit in Payroll → Salary Structures
      </button>
    </div>
  );
}

function AssetsTab({ assignments }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr><th className="text-left px-4 py-3">Asset</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Assigned on</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assignments.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No assets currently assigned.</td></tr>}
          {assignments.map((a) => (
            <tr key={a._id}>
              <td className="px-4 py-3 font-semibold text-slate-800">{a.asset?.name} <span className="text-slate-400 font-normal">({a.asset?.assetTag})</span></td>
              <td className="px-4 py-3 text-slate-600 capitalize">{a.asset?.category}</td>
              <td className="px-4 py-3 text-slate-600">{fmtDate(a.assignedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTab({ employeeId, documents, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!title.trim() || !file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("employeeId", employeeId);
      formData.append("title", title);
      formData.append("category", category);
      formData.append("file", file);
      await documentsApi.upload(formData);
      toast.success("Document uploaded");
      setTitle("");
      setFile(null);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await documentsApi.url(doc._id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to open document");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-2 items-center">
        <input placeholder="Title" className="flex-1 min-w-[140px] rounded-xl border border-slate-200 px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer border border-dashed border-slate-300 rounded-xl px-3 py-2">
          <Plus className="w-4 h-4" />{file ? file.name : "Choose file"}
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <button disabled={uploading || !title.trim() || !file} onClick={handleUpload} className="px-4 py-2 rounded-xl bg-cyan-700 text-white text-sm font-semibold disabled:opacity-60">
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="text-left px-4 py-3">Title</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Uploaded</th><th className="text-left px-4 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No documents yet.</td></tr>}
            {documents.map((d) => (
              <tr key={d._id}>
                <td className="px-4 py-3 font-semibold text-slate-800">{d.title}</td>
                <td className="px-4 py-3 text-slate-600">{DOCUMENT_CATEGORY_LABELS[d.category] || d.category}</td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(d.createdAt)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDownload(d)} className="text-cyan-700 font-semibold hover:underline text-xs flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ department: "", designation: "", joiningDate: "", employmentStatus: "active" });

  const [balance, setBalance] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [salaryStructure, setSalaryStructure] = useState(null);
  const [assetAssignments, setAssetAssignments] = useState([]);
  const [documents, setDocuments] = useState([]);

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

  const loadSummary = useCallback(() => {
    leaveRequestsApi.balanceFor(id).then((r) => setBalance(r.data || [])).catch(() => setBalance([]));
    leaveRequestsApi.all({ employee: id }).then((r) => setLeaveHistory(r.data || [])).catch(() => setLeaveHistory([]));
    const monthNow = new Date();
    const monthFrom = `${monthNow.getFullYear()}-${String(monthNow.getMonth() + 1).padStart(2, "0")}-01`;
    const monthTo = `${monthNow.getFullYear()}-${String(monthNow.getMonth() + 1).padStart(2, "0")}-${String(new Date(monthNow.getFullYear(), monthNow.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
    attendanceApi.list({ employeeId: id, from: monthFrom, to: monthTo }).then((r) => setAttendanceRecords(r.data || [])).catch(() => setAttendanceRecords([]));
    salaryStructuresApi.get(id).then((r) => setSalaryStructure(r.data)).catch(() => setSalaryStructure(null));
    assetsApi.assignments({ employee: id, status: "active" }).then((r) => setAssetAssignments(r.data || [])).catch(() => setAssetAssignments([]));
    documentsApi.forEmployee(id).then((r) => setDocuments(r.data || [])).catch(() => setDocuments([]));
  }, [id]);

  useEffect(() => {
    load();
    loadSummary();
  }, [load, loadSummary]);

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

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "attendance", label: "Attendance" },
    { key: "leave", label: "Leave" },
    { key: "payroll", label: "Payroll" },
    { key: "assets", label: "Assets" },
    { key: "documents", label: "Documents" },
  ];

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <button onClick={() => navigate("/hrms/employees")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="w-[18px] h-[18px]" /> Back to Employees
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4">
        <h1 className="text-xl font-bold text-slate-900">{employee.name}</h1>
        <p className="text-sm text-slate-500">{employee.email}</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === t.key ? "bg-cyan-700 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            {t.label}
          </button>
        ))}
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

      {tab === "attendance" && <AttendanceTab records={attendanceRecords} />}
      {tab === "leave" && <LeaveTab balance={balance} history={leaveHistory} />}
      {tab === "payroll" && <PayrollTab salaryStructure={salaryStructure} navigate={navigate} />}
      {tab === "assets" && <AssetsTab assignments={assetAssignments} />}
      {tab === "documents" && <DocumentsTab employeeId={id} documents={documents} onChanged={loadSummary} />}

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
