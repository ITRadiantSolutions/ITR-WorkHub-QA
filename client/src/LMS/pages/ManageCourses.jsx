import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { coursesApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const EMPTY_FORM = { title: "", subTitle: "", description: "", category: "", level: "Beginner", isPublished: false, thumbnail: null };

export default function ManageCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () =>
    coursesApi
      .allAdmin()
      .then((res) => setCourses(res.data))
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const createCourse = async (e) => {
    e.preventDefault();
    if (!form.title || !form.category) return toast.error("Title and category are required");
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") data.append(key, value);
      });
      await coursesApi.create(data);
      toast.success("Course created");
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create course");
    } finally {
      setSaving(false);
    }
  };

  const removeCourse = async (courseId) => {
    if (!window.confirm("Delete this course? This removes all its lectures too.")) return;
    try {
      await coursesApi.remove(courseId);
      toast.success("Course removed");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove course");
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Manage Courses</h1>
          <p className="text-xs text-slate-500 mt-0.5">Create and edit courses, lectures and assessments.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3.5 py-2"
        >
          <Icons.Plus /> New Course
        </button>
      </div>

      {showForm && (
        <form onSubmit={createCourse} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="text-xs rounded-lg border border-slate-200 px-3 py-2"
          />
          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="text-xs rounded-lg border border-slate-200 px-3 py-2"
          />
          <input
            placeholder="Subtitle"
            value={form.subTitle}
            onChange={(e) => setForm((f) => ({ ...f, subTitle: e.target.value }))}
            className="text-xs rounded-lg border border-slate-200 px-3 py-2 sm:col-span-2"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="text-xs rounded-lg border border-slate-200 px-3 py-2 sm:col-span-2"
            rows={2}
          />
          <select
            value={form.level}
            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            className="text-xs rounded-lg border border-slate-200 px-3 py-2"
          >
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.files[0] }))} className="text-xs" />
          <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            Publish immediately
          </label>
          <button
            disabled={saving}
            type="submit"
            className="sm:col-span-2 justify-self-end text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-5 py-2 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create Course"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <div key={course._id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                {course.category}
              </span>
              {course.isPublished ? (
                <span className="text-[10px] font-bold text-emerald-600">Published</span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400">Draft</span>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900">{course.title}</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {course.lectureCount || 0} lectures · {course.quizCount || 0} quiz · {course.assignmentCount || 0} assignment
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => navigate(`/lms/manage/${course._id}`)}
                className="flex-1 text-xs font-semibold rounded-lg py-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                Edit
              </button>
              <button onClick={() => removeCourse(course._id)} className="text-xs font-semibold rounded-lg py-1.5 px-3 border border-red-200 text-red-600 hover:bg-red-50">
                <Icons.Trash />
              </button>
            </div>
          </div>
        ))}
        {courses.length === 0 && <p className="text-xs text-slate-400">No courses yet — create one above.</p>}
      </div>
    </div>
  );
}
