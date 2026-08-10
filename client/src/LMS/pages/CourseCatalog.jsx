import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { coursesApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

export default function CourseCatalog() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coursesApi
      .published()
      .then((res) => setCourses(res.data))
      .catch(() => toast.error("Failed to load courses"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading courses…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Courses</h1>
        <p className="text-xs text-slate-500 mt-0.5">Browse and start learning.</p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          No courses published yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <button
              key={course._id}
              onClick={() => navigate(`/lms/courses/${course._id}`)}
              className="group text-left rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              <div className="h-32 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center overflow-hidden">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-amber-500">
                    <Icons.Book />
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    {course.category}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">{course.level}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 line-clamp-1">{course.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.subTitle || course.description || "No description."}</p>
                <p className="text-[11px] text-slate-400 mt-2">{course.lectures?.length || 0} lectures</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
