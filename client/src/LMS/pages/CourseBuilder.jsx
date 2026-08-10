import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { coursesApi, lecturesApi, assessmentsApi, badgesApi, skillsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const EMPTY_QUESTION = () => ({ type: "mcq", prompt: "", options: [{ text: "" }, { text: "" }], correctOptionIndex: 0 });
const EMPTY_MATERIAL = () => ({ type: "pdf", title: "", videoLink: "", file: null });

export default function CourseBuilder() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [badges, setBadges] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCourse, setSavingCourse] = useState(false);
  const [lectureForm, setLectureForm] = useState(null);
  const [assessmentForm, setAssessmentForm] = useState(null);

  const load = useCallback(async () => {
    try {
      const [courseRes, assessmentsRes, badgesRes, skillsRes] = await Promise.all([
        coursesApi.byId(courseId),
        assessmentsApi.forCourse(courseId),
        badgesApi.allAdmin(),
        skillsApi.all(),
      ]);
      setCourse(courseRes.data);
      setAssessments(assessmentsRes.data);
      setBadges(badgesRes.data);
      setSkills(skillsRes.data);
    } catch {
      toast.error("Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveCourseDetails = async (e) => {
    e.preventDefault();
    setSavingCourse(true);
    try {
      const data = new FormData();
      ["title", "subTitle", "description", "category", "level"].forEach((key) => data.append(key, course[key] || ""));
      data.append("isPublished", course.isPublished);
      if (course._thumbnailFile) data.append("thumbnail", course._thumbnailFile);
      await coursesApi.update(courseId, data);
      toast.success("Course updated");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update course");
    } finally {
      setSavingCourse(false);
    }
  };

  const removeLecture = async (lectureId) => {
    if (!window.confirm("Remove this lecture?")) return;
    try {
      await lecturesApi.remove(lectureId);
      toast.success("Lecture removed");
      load();
    } catch {
      toast.error("Failed to remove lecture");
    }
  };

  const submitLecture = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append("chapterTitle", lectureForm.chapterTitle || "");
      data.append("lectureTitle", lectureForm.lectureTitle || "");
      data.append("isPreviewFree", lectureForm.isPreviewFree);

      const materials = [];
      lectureForm.materials.forEach((material) => {
        if (material.type === "videoLink") {
          materials.push({ type: "videoLink", title: material.title, videoLink: material.videoLink });
        } else {
          materials.push({ type: material.type, title: material.title, fileUrl: "" });
          if (material.file) data.append(material.type === "pdf" ? "pdfFiles" : "videoFiles", material.file);
        }
      });
      data.append("materials", JSON.stringify(materials));

      await lecturesApi.create(courseId, data);
      toast.success("Lecture added");
      setLectureForm(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add lecture");
    }
  };

  const submitAssessment = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        assessmentType: assessmentForm.assessmentType,
        title: assessmentForm.title,
        durationMinutes: Number(assessmentForm.durationMinutes),
        maxAttempts: Number(assessmentForm.maxAttempts),
        passingPercentage: Number(assessmentForm.passingPercentage),
        isPublished: assessmentForm.isPublished,
        badge: assessmentForm.badge || undefined,
        skill: assessmentForm.skill || undefined,
        questions: assessmentForm.questions,
      };
      if (assessmentForm._id) {
        await assessmentsApi.update(assessmentForm._id, payload);
        toast.success("Assessment updated");
      } else {
        await assessmentsApi.create(courseId, payload);
        toast.success("Assessment created");
      }
      setAssessmentForm(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save assessment");
    }
  };

  const removeAssessment = async (assessmentId) => {
    if (!window.confirm("Delete this assessment?")) return;
    try {
      await assessmentsApi.remove(assessmentId);
      toast.success("Assessment deleted");
      load();
    } catch {
      toast.error("Failed to delete assessment");
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  if (!course) return <div className="p-8 text-sm text-slate-400">Course not found.</div>;

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate("/lms/manage")} className="text-xs font-semibold text-slate-500 hover:text-amber-600 flex items-center gap-1">
        <Icons.Back /> Back to Manage Courses
      </button>

      <form onSubmit={saveCourseDetails} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <p className="sm:col-span-2 text-sm font-bold text-slate-900">Course Details</p>
        <input
          value={course.title || ""}
          onChange={(e) => setCourse((c) => ({ ...c, title: e.target.value }))}
          placeholder="Title"
          className="text-xs rounded-lg border border-slate-200 px-3 py-2"
        />
        <input
          value={course.category || ""}
          onChange={(e) => setCourse((c) => ({ ...c, category: e.target.value }))}
          placeholder="Category"
          className="text-xs rounded-lg border border-slate-200 px-3 py-2"
        />
        <input
          value={course.subTitle || ""}
          onChange={(e) => setCourse((c) => ({ ...c, subTitle: e.target.value }))}
          placeholder="Subtitle"
          className="text-xs rounded-lg border border-slate-200 px-3 py-2 sm:col-span-2"
        />
        <textarea
          value={course.description || ""}
          onChange={(e) => setCourse((c) => ({ ...c, description: e.target.value }))}
          placeholder="Description"
          rows={2}
          className="text-xs rounded-lg border border-slate-200 px-3 py-2 sm:col-span-2"
        />
        <select
          value={course.level || "Beginner"}
          onChange={(e) => setCourse((c) => ({ ...c, level: e.target.value }))}
          className="text-xs rounded-lg border border-slate-200 px-3 py-2"
        >
          {LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <input type="file" accept="image/*" onChange={(e) => setCourse((c) => ({ ...c, _thumbnailFile: e.target.files[0] }))} className="text-xs" />
        <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
          <input type="checkbox" checked={!!course.isPublished} onChange={(e) => setCourse((c) => ({ ...c, isPublished: e.target.checked }))} />
          Published
        </label>
        <button disabled={savingCourse} type="submit" className="sm:col-span-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg py-2">
          {savingCourse ? "Saving…" : "Save Details"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-900">Lectures</p>
          <button onClick={() => setLectureForm({ chapterTitle: "", lectureTitle: "", isPreviewFree: false, materials: [] })} className="text-xs font-semibold text-amber-600 hover:underline">
            + Add Lecture
          </button>
        </div>

        {lectureForm && (
          <form onSubmit={submitLecture} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 mb-3 space-y-2">
            <input
              value={lectureForm.chapterTitle}
              onChange={(e) => setLectureForm((f) => ({ ...f, chapterTitle: e.target.value }))}
              placeholder="Chapter title (optional)"
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5"
            />
            <input
              value={lectureForm.lectureTitle}
              onChange={(e) => setLectureForm((f) => ({ ...f, lectureTitle: e.target.value }))}
              placeholder="Lecture title"
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={lectureForm.isPreviewFree} onChange={(e) => setLectureForm((f) => ({ ...f, isPreviewFree: e.target.checked }))} />
              Free preview
            </label>

            {lectureForm.materials.map((material, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-2">
                <select
                  value={material.type}
                  onChange={(e) =>
                    setLectureForm((f) => ({ ...f, materials: f.materials.map((m, i) => (i === idx ? { ...m, type: e.target.value } : m)) }))
                  }
                  className="text-[11px] rounded border border-slate-200 px-1.5 py-1"
                >
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="videoLink">Video Link</option>
                </select>
                <input
                  value={material.title}
                  onChange={(e) => setLectureForm((f) => ({ ...f, materials: f.materials.map((m, i) => (i === idx ? { ...m, title: e.target.value } : m)) }))}
                  placeholder="Title"
                  className="flex-1 text-[11px] rounded border border-slate-200 px-2 py-1"
                />
                {material.type === "videoLink" ? (
                  <input
                    value={material.videoLink}
                    onChange={(e) => setLectureForm((f) => ({ ...f, materials: f.materials.map((m, i) => (i === idx ? { ...m, videoLink: e.target.value } : m)) }))}
                    placeholder="https://…"
                    className="flex-1 text-[11px] rounded border border-slate-200 px-2 py-1"
                  />
                ) : (
                  <input
                    type="file"
                    onChange={(e) => setLectureForm((f) => ({ ...f, materials: f.materials.map((m, i) => (i === idx ? { ...m, file: e.target.files[0] } : m)) }))}
                    className="flex-1 text-[10px]"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setLectureForm((f) => ({ ...f, materials: f.materials.filter((_, i) => i !== idx) }))}
                  className="text-red-500 shrink-0"
                >
                  <Icons.Trash />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLectureForm((f) => ({ ...f, materials: [...f.materials, EMPTY_MATERIAL()] }))}
              className="text-[11px] font-semibold text-amber-600 hover:underline"
            >
              + Add material
            </button>

            <div className="flex items-center gap-2 pt-1">
              <button type="submit" className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
                Save Lecture
              </button>
              <button type="button" onClick={() => setLectureForm(null)} className="text-xs font-semibold text-slate-500">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {(course.lectures || []).map((lecture) => (
            <div key={lecture._id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
              <div>
                <p className="text-xs font-bold text-slate-800">{lecture.lectureTitle}</p>
                <p className="text-[10px] text-slate-400">{(lecture.materials || []).length} materials</p>
              </div>
              <button onClick={() => removeLecture(lecture._id)} className="text-red-500">
                <Icons.Trash />
              </button>
            </div>
          ))}
          {(course.lectures || []).length === 0 && <p className="text-xs text-slate-400">No lectures yet.</p>}
        </div>
      </div>

      {["quiz", "assignment"].map((assessmentType) => (
        <div key={assessmentType} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-slate-900 capitalize">{assessmentType === "quiz" ? "Quiz" : "Final Assignment"}</p>
            <button
              onClick={() =>
                setAssessmentForm({
                  assessmentType,
                  title: "",
                  durationMinutes: 15,
                  maxAttempts: 3,
                  passingPercentage: 80,
                  isPublished: true,
                  badge: "",
                  skill: "",
                  questions: [EMPTY_QUESTION()],
                })
              }
              className="text-xs font-semibold text-amber-600 hover:underline"
            >
              + Add
            </button>
          </div>

          <div className="space-y-2">
            {assessments
              .filter((a) => a.assessmentType === assessmentType)
              .map((a) => (
                <div key={a._id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {a.title} {a.isPublished ? <span className="text-emerald-600">· Published</span> : <span className="text-slate-400">· Draft</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {a.questions.length} questions · {a.durationMinutes}min · pass {a.passingPercentage}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setAssessmentForm({
                          _id: a._id,
                          assessmentType: a.assessmentType,
                          title: a.title,
                          durationMinutes: a.durationMinutes,
                          maxAttempts: a.maxAttempts,
                          passingPercentage: a.passingPercentage,
                          isPublished: a.isPublished,
                          badge: a.badge?._id || "",
                          skill: a.skill?._id || "",
                          questions: a.questions,
                        })
                      }
                      className="text-xs font-semibold text-amber-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button onClick={() => removeAssessment(a._id)} className="text-red-500">
                      <Icons.Trash />
                    </button>
                  </div>
                </div>
              ))}
            {assessments.filter((a) => a.assessmentType === assessmentType).length === 0 && (
              <p className="text-xs text-slate-400">None configured yet.</p>
            )}
          </div>

          {assessmentForm?.assessmentType === assessmentType && (
            <form onSubmit={submitAssessment} className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 mt-3 space-y-2">
              <input
                value={assessmentForm.title}
                onChange={(e) => setAssessmentForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  value={assessmentForm.durationMinutes}
                  onChange={(e) => setAssessmentForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                  placeholder="Minutes"
                  className="text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                />
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={assessmentForm.maxAttempts}
                  onChange={(e) => setAssessmentForm((f) => ({ ...f, maxAttempts: e.target.value }))}
                  placeholder="Max attempts"
                  className="text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={assessmentForm.passingPercentage}
                  onChange={(e) => setAssessmentForm((f) => ({ ...f, passingPercentage: e.target.value }))}
                  placeholder="Pass %"
                  className="text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={assessmentForm.badge}
                  onChange={(e) => setAssessmentForm((f) => ({ ...f, badge: e.target.value }))}
                  className="text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                >
                  <option value="">No badge</option>
                  {badges.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select
                  value={assessmentForm.skill}
                  onChange={(e) => setAssessmentForm((f) => ({ ...f, skill: e.target.value }))}
                  className="text-xs rounded-lg border border-slate-200 px-3 py-1.5"
                >
                  <option value="">No skill</option>
                  {skills.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={assessmentForm.isPublished} onChange={(e) => setAssessmentForm((f) => ({ ...f, isPublished: e.target.checked }))} />
                Published
              </label>

              <p className="text-xs font-bold text-slate-700 pt-1">Questions</p>
              {assessmentForm.questions.map((question, qIdx) => (
                <div key={qIdx} className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={question.prompt}
                      onChange={(e) =>
                        setAssessmentForm((f) => ({
                          ...f,
                          questions: f.questions.map((q, i) => (i === qIdx ? { ...q, prompt: e.target.value } : q)),
                        }))
                      }
                      placeholder={`Question ${qIdx + 1}`}
                      className="flex-1 text-[11px] rounded border border-slate-200 px-2 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => setAssessmentForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== qIdx) }))}
                      className="text-red-500 shrink-0"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                  {question.options.map((option, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2 pl-2">
                      <input
                        type="radio"
                        checked={question.correctOptionIndex === oIdx}
                        onChange={() =>
                          setAssessmentForm((f) => ({
                            ...f,
                            questions: f.questions.map((q, i) => (i === qIdx ? { ...q, correctOptionIndex: oIdx } : q)),
                          }))
                        }
                      />
                      <input
                        value={option.text}
                        onChange={(e) =>
                          setAssessmentForm((f) => ({
                            ...f,
                            questions: f.questions.map((q, i) =>
                              i === qIdx ? { ...q, options: q.options.map((o, oi) => (oi === oIdx ? { text: e.target.value } : o)) } : q,
                            ),
                          }))
                        }
                        placeholder={`Option ${oIdx + 1}`}
                        className="flex-1 text-[11px] rounded border border-slate-200 px-2 py-1"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setAssessmentForm((f) => ({
                        ...f,
                        questions: f.questions.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, { text: "" }] } : q)),
                      }))
                    }
                    className="text-[10px] font-semibold text-amber-600 hover:underline pl-2"
                  >
                    + Add option
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAssessmentForm((f) => ({ ...f, questions: [...f.questions, EMPTY_QUESTION()] }))}
                className="text-[11px] font-semibold text-amber-600 hover:underline"
              >
                + Add question
              </button>

              <div className="flex items-center gap-2 pt-1">
                <button type="submit" className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
                  Save
                </button>
                <button type="button" onClick={() => setAssessmentForm(null)} className="text-xs font-semibold text-slate-500">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
