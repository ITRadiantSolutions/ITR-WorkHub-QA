import { useEffect, useState } from "react";
import { toast } from "sonner";
import { coursesApi, assignmentsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

export default function AssignCourses() {
  const [courses, setCourses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [assignedIds, setAssignedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([coursesApi.allAdmin(), assignmentsApi.employees()])
      .then(([coursesRes, employeesRes]) => {
        setCourses(coursesRes.data);
        setEmployees(employeesRes.data);
        if (coursesRes.data[0]) setCourseId(coursesRes.data[0]._id);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!courseId) return;
    assignmentsApi
      .forCourse(courseId)
      .then(({ data }) => setAssignedIds(new Set(data.assignedTo.map(String))))
      .catch(() => setAssignedIds(new Set()));
    setSelected(new Set());
  }, [courseId]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const assign = async () => {
    if (selected.size === 0) return toast.error("Select at least one employee");
    setSaving(true);
    try {
      await assignmentsApi.assign(courseId, [...selected]);
      toast.success("Course assigned");
      const { data } = await assignmentsApi.forCourse(courseId);
      setAssignedIds(new Set(data.assignedTo.map(String)));
      setSelected(new Set());
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to assign course");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Assign Courses</h1>
        <p className="text-xs text-slate-500 mt-0.5">Assign a course to employees in your team.</p>
      </div>

      <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="text-xs rounded-lg border border-slate-200 px-3 py-2 w-full sm:w-80">
        {courses.map((c) => (
          <option key={c._id} value={c._id}>
            {c.title}
          </option>
        ))}
      </select>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-50">
        {employees.map((employee) => {
          const isAssigned = assignedIds.has(String(employee._id));
          return (
            <label key={employee._id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer">
              <input type="checkbox" disabled={isAssigned} checked={isAssigned || selected.has(employee._id)} onChange={() => toggle(employee._id)} />
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">{employee.name}</p>
                <p className="text-[10px] text-slate-400">{employee.email}</p>
              </div>
              {isAssigned && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Assigned</span>
              )}
            </label>
          );
        })}
        {employees.length === 0 && <p className="text-xs text-slate-400 p-4">No employees in your team.</p>}
      </div>

      <button
        disabled={saving || selected.size === 0}
        onClick={assign}
        className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 disabled:bg-slate-200 disabled:text-slate-400"
      >
        <Icons.Check /> {saving ? "Assigning…" : `Assign to ${selected.size} selected`}
      </button>
    </div>
  );
}
