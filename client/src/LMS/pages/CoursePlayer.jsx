import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { coursesApi, progressApi, reviewsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

const MATERIAL_ICON = { pdf: "File", video: "Play", videoLink: "Play" };

export default function CoursePlayer() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });

  const load = useCallback(async () => {
    try {
      const [courseRes, progressRes, reviewsRes] = await Promise.all([
        coursesApi.byId(courseId),
        progressApi.forCourse(courseId),
        coursesApi.reviews(courseId),
      ]);
      setCourse(courseRes.data);
      setProgress(progressRes.data);
      setReviews(reviewsRes.data);
    } catch {
      toast.error("Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const markComplete = async (lectureId, materialIndex, type) => {
    try {
      await progressApi.markMaterial(courseId, lectureId, materialIndex, type);
      const { data } = await progressApi.forCourse(courseId);
      setProgress(data);
    } catch {
      toast.error("Failed to update progress");
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await reviewsApi.add(courseId, Number(reviewForm.rating), reviewForm.comment);
      toast.success("Review submitted");
      setReviewForm({ rating: 5, comment: "" });
      const { data } = await coursesApi.reviews(courseId);
      setReviews(data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit review");
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  if (!course) return <div className="p-8 text-sm text-slate-400">Course not found.</div>;

  const completedKeys = new Set(progress?.completedMaterialsKeys || []);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate("/lms/courses")} className="text-xs font-semibold text-slate-500 hover:text-amber-600 flex items-center gap-1">
        <Icons.Back /> Back to Courses
      </button>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">{course.title}</h1>
        <p className="text-xs text-slate-500 mt-1">{course.subTitle || course.description}</p>
        <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden max-w-sm">
          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${progress?.percent || 0}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">{progress?.percent || 0}% complete</p>
      </div>

      <div className="space-y-3">
        {(course.lectures || []).map((lecture) => (
          <div key={lecture._id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
            {lecture.chapterTitle && <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-1">{lecture.chapterTitle}</p>}
            <p className="text-sm font-bold text-slate-900 mb-2">{lecture.lectureTitle}</p>
            <div className="space-y-1.5">
              {(lecture.materials || []).map((material, idx) => {
                const key = `${lecture._id}:${idx}:${material.type}`;
                const done = completedKeys.has(key);
                const href = material.type === "videoLink" ? material.videoLink : material.fileUrl;
                const Icon = Icons[MATERIAL_ICON[material.type]] || Icons.File;
                return (
                  <div key={idx} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                    <span className={done ? "text-emerald-500" : "text-slate-400"}>{done ? <Icons.CheckCircle /> : <Icon />}</span>
                    <a href={href} target="_blank" rel="noreferrer" className="flex-1 text-xs font-medium text-slate-700 hover:text-amber-600 truncate">
                      {material.title || `${material.type} material`}
                    </a>
                    {!done && (
                      <button
                        onClick={() => markComplete(lecture._id, idx, material.type)}
                        className="text-[11px] font-semibold text-amber-600 hover:underline shrink-0"
                      >
                        Mark complete
                      </button>
                    )}
                  </div>
                );
              })}
              {(lecture.materials || []).length === 0 && <p className="text-[11px] text-slate-400">No materials in this lecture.</p>}
            </div>
          </div>
        ))}
        {(course.lectures || []).length === 0 && <p className="text-xs text-slate-400">No lectures added yet.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AssessmentCard title="Quiz" data={progress?.quiz} unlocked={progress?.allMaterialsCompleted} onStart={() => navigate(`/lms/courses/${courseId}/assessment/quiz`)} />
        <AssessmentCard
          title="Final Assignment"
          data={progress?.finalAssignment}
          unlocked={progress?.quiz?.exists ? progress?.quiz?.status === "passed" : progress?.allMaterialsCompleted}
          onStart={() => navigate(`/lms/courses/${courseId}/assessment/assignment`)}
        />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
        <p className="text-sm font-bold text-slate-900 mb-3">Reviews</p>
        <form onSubmit={submitReview} className="flex items-center gap-2 mb-4">
          <select
            value={reviewForm.rating}
            onChange={(e) => setReviewForm((f) => ({ ...f, rating: e.target.value }))}
            className="text-xs rounded-lg border border-slate-200 px-2 py-1.5"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
          <input
            value={reviewForm.comment}
            onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
            placeholder="Share your feedback…"
            className="flex-1 text-xs rounded-lg border border-slate-200 px-3 py-1.5"
          />
          <button type="submit" className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
            Submit
          </button>
        </form>
        <div className="space-y-2">
          {reviews.map((review) => (
            <div key={review._id} className="text-xs text-slate-600 border-t border-slate-50 pt-2">
              <span className="font-bold text-amber-600">{"★".repeat(review.rating)}</span> {review.comment}
            </div>
          ))}
          {reviews.length === 0 && <p className="text-[11px] text-slate-400">No reviews yet.</p>}
        </div>
      </div>
    </div>
  );
}

function AssessmentCard({ title, data, unlocked, onStart }) {
  if (!data?.exists) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-xs text-slate-400">{title} not configured for this course.</div>
    );
  }
  const passed = data.status === "passed" || data.status === "submitted";
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {passed && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Passed</span>}
      </div>
      <p className="text-[11px] text-slate-500">
        Attempts: {data.attempts}/{data.maxAttempts} · Score: {data.score}%
      </p>
      <button
        disabled={!unlocked || passed || data.attempts >= data.maxAttempts}
        onClick={onStart}
        className="mt-3 w-full text-xs font-semibold rounded-lg py-2 bg-amber-600 hover:bg-amber-700 text-white disabled:bg-slate-100 disabled:text-slate-400"
      >
        {passed ? "Completed" : unlocked ? "Start" : "Locked"}
      </button>
    </div>
  );
}
