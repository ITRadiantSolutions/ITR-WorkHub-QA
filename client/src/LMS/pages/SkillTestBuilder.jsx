import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { skillTestsApi, skillsApi, badgesApi, skillGroupsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

const EMPTY_MCQ_QUESTION = () => ({ type: "mcq", prompt: "", options: [{ text: "" }, { text: "" }], correctOptionIndex: 0, acceptableAnswers: [] });
const EMPTY_FILL_BLANK_QUESTION = () => ({ type: "fill_blank", prompt: "", options: [], acceptableAnswers: [""] });

const EMPTY_FORM = {
  title: "",
  description: "",
  durationMinutes: 30,
  attemptSize: 5,
  maxAttempts: 3,
  passingPercentage: 80,
  skill: "",
  badge: "",
  isPublished: false,
  questionPool: [],
  skillGroups: [],
};

export default function SkillTestBuilder() {
  const { testId } = useParams();
  const isNew = !testId;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [skills, setSkills] = useState([]);
  const [badges, setBadges] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([skillsApi.all(), badgesApi.allAdmin(), skillGroupsApi.all()])
      .then(([skillsRes, badgesRes, groupsRes]) => {
        setSkills(skillsRes.data);
        setBadges(badgesRes.data);
        setGroups(groupsRes.data);
      })
      .catch(() => toast.error("Failed to load skills/badges/groups"));

    if (!isNew) {
      skillTestsApi
        .byIdAdmin(testId)
        .then(({ data }) =>
          setForm({
            ...data,
            skill: data.skill?._id || data.skill || "",
            badge: data.badge?._id || data.badge || "",
            skillGroups: (data.skillGroups || []).map((g) => (typeof g === "string" ? g : g._id)),
          }),
        )
        .catch(() => toast.error("Failed to load test"))
        .finally(() => setLoading(false));
    }
  }, [testId, isNew]);

  const updateQuestion = (qIdx, patch) => {
    setForm((f) => ({ ...f, questionPool: f.questionPool.map((q, i) => (i === qIdx ? { ...q, ...patch } : q)) }));
  };

  const removeQuestion = (qIdx) => setForm((f) => ({ ...f, questionPool: f.questionPool.filter((_, i) => i !== qIdx) }));

  const toggleGroup = (groupId) => {
    setForm((f) => ({
      ...f,
      skillGroups: f.skillGroups.includes(groupId) ? f.skillGroups.filter((id) => id !== groupId) : [...f.skillGroups, groupId],
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.durationMinutes || form.durationMinutes < 1) return toast.error("Duration must be at least 1 minute");
    const size = Number(form.attemptSize);
    if (!size || size < 1) return toast.error("Questions per attempt must be at least 1");
    if (size > form.questionPool.length) return toast.error("Questions per attempt cannot exceed the question pool size");
    for (const q of form.questionPool) {
      if (!q.prompt.trim()) return toast.error("Every question needs a prompt");
      if (q.type === "mcq" && q.options.filter((o) => o.text.trim()).length < 2) return toast.error("Every MCQ question needs at least 2 options");
      if (q.type === "fill_blank" && !q.acceptableAnswers.filter((a) => a.trim()).length) {
        return toast.error("Every fill-in-the-blank question needs at least one acceptable answer");
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        durationMinutes: Number(form.durationMinutes),
        attemptSize: size,
        maxAttempts: Number(form.maxAttempts),
        passingPercentage: Number(form.passingPercentage),
        skill: form.skill || null,
        badge: form.badge || null,
        isPublished: form.isPublished,
        questionPool: form.questionPool,
      };
      let saved;
      if (isNew) {
        const { data } = await skillTestsApi.create(payload);
        saved = data;
      } else {
        const { data } = await skillTestsApi.update(testId, payload);
        saved = data;
      }

      // Reconcile skill-group assignment against whatever the server already has.
      const currentGroupIds = new Set((saved.skillGroups || []).map((g) => (typeof g === "string" ? g : g._id)));
      const toAdd = form.skillGroups.filter((id) => !currentGroupIds.has(id));
      const toRemove = [...currentGroupIds].filter((id) => !form.skillGroups.includes(id));
      if (toAdd.length) await skillTestsApi.assignGroups(saved._id, toAdd);
      for (const groupId of toRemove) await skillTestsApi.unassignGroup(saved._id, groupId);

      toast.success("Test saved");
      if (isNew) navigate(`/lms/manage-skill-tests/${saved._id}`, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save test");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-3xl">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/lms/manage-skill-tests")} className="text-slate-400 hover:text-slate-600">
          <Icons.Back />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{isNew ? "New Test" : "Edit Test"}</h1>
          <p className="text-xs text-slate-500 mt-0.5">MCQ and fill-in-the-blank question pool — each attempt samples a random subset.</p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            rows={2}
            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <LabeledNumber label="Duration (min)" value={form.durationMinutes} min={1} onChange={(v) => setForm((f) => ({ ...f, durationMinutes: v }))} />
            <LabeledNumber label="Questions/attempt" value={form.attemptSize} min={1} onChange={(v) => setForm((f) => ({ ...f, attemptSize: v }))} />
            <LabeledNumber label="Max attempts" value={form.maxAttempts} min={1} onChange={(v) => setForm((f) => ({ ...f, maxAttempts: v }))} />
            <LabeledNumber label="Pass %" value={form.passingPercentage} min={0} max={100} onChange={(v) => setForm((f) => ({ ...f, passingPercentage: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} className="text-xs rounded-lg border border-slate-200 px-3 py-2">
              <option value="">No badge</option>
              {badges.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select value={form.skill} onChange={(e) => setForm((f) => ({ ...f, skill: e.target.value }))} className="text-xs rounded-lg border border-slate-200 px-3 py-2">
              <option value="">No skill</option>
              {skills.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} />
            Published (visible to eligible employees)
          </label>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">Question pool ({form.questionPool.length})</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, questionPool: [...f.questionPool, EMPTY_MCQ_QUESTION()] }))}
                className="text-[11px] font-semibold text-amber-600 hover:underline"
              >
                + MCQ
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, questionPool: [...f.questionPool, EMPTY_FILL_BLANK_QUESTION()] }))}
                className="text-[11px] font-semibold text-amber-600 hover:underline"
              >
                + Fill in the blank
              </button>
            </div>
          </div>

          {form.questionPool.map((question, qIdx) => (
            <div key={qIdx} className="rounded-lg border border-slate-200 bg-slate-50/40 p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">{question.type === "mcq" ? "MCQ" : "Fill blank"}</span>
                <input
                  value={question.prompt}
                  onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                  placeholder={`Question ${qIdx + 1}`}
                  className="flex-1 text-[11px] rounded border border-slate-200 px-2 py-1"
                />
                <button type="button" onClick={() => removeQuestion(qIdx)} className="text-red-500 shrink-0">
                  <Icons.Trash />
                </button>
              </div>

              {question.type === "mcq" ? (
                <>
                  {question.options.map((option, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2 pl-6">
                      <input type="radio" checked={question.correctOptionIndex === oIdx} onChange={() => updateQuestion(qIdx, { correctOptionIndex: oIdx })} />
                      <input
                        value={option.text}
                        onChange={(e) => updateQuestion(qIdx, { options: question.options.map((o, oi) => (oi === oIdx ? { text: e.target.value } : o)) })}
                        placeholder={`Option ${oIdx + 1}`}
                        className="flex-1 text-[11px] rounded border border-slate-200 px-2 py-1"
                      />
                      {question.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => updateQuestion(qIdx, { options: question.options.filter((_, oi) => oi !== oIdx) })}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Icons.X />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateQuestion(qIdx, { options: [...question.options, { text: "" }] })}
                    className="text-[10px] font-semibold text-amber-600 hover:underline pl-6"
                  >
                    + Add option
                  </button>
                </>
              ) : (
                <>
                  {question.acceptableAnswers.map((answer, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-2 pl-6">
                      <input
                        value={answer}
                        onChange={(e) => updateQuestion(qIdx, { acceptableAnswers: question.acceptableAnswers.map((a, ai) => (ai === aIdx ? e.target.value : a)) })}
                        placeholder="Acceptable answer"
                        className="flex-1 text-[11px] rounded border border-slate-200 px-2 py-1"
                      />
                      {question.acceptableAnswers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => updateQuestion(qIdx, { acceptableAnswers: question.acceptableAnswers.filter((_, ai) => ai !== aIdx) })}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Icons.X />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateQuestion(qIdx, { acceptableAnswers: [...question.acceptableAnswers, ""] })}
                    className="text-[10px] font-semibold text-amber-600 hover:underline pl-6"
                  >
                    + Add acceptable answer
                  </button>
                  <p className="text-[10px] text-slate-400 pl-6">Matched case-insensitively, trimmed.</p>
                </>
              )}
            </div>
          ))}
          {form.questionPool.length === 0 && <p className="text-xs text-slate-400">No questions yet — add MCQ or fill-in-the-blank above.</p>}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-2">
          <p className="text-xs font-bold text-slate-700">Assigned skill groups</p>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => {
              const active = form.skillGroups.includes(group._id);
              return (
                <button
                  key={group._id}
                  type="button"
                  onClick={() => toggleGroup(group._id)}
                  className={`text-[11px] font-semibold rounded-full px-3 py-1 border ${
                    active ? "bg-amber-600 border-amber-600 text-white" : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  {group.name}
                </button>
              );
            })}
            {groups.length === 0 && <p className="text-xs text-slate-400">No skill groups yet — create one under Skill Groups first.</p>}
          </div>
        </div>

        <button disabled={saving} type="submit" className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2 disabled:opacity-60">
          {saving ? "Saving…" : "Save Test"}
        </button>
      </form>
    </div>
  );
}

function LabeledNumber({ label, value, min, max, onChange }) {
  return (
    <label className="text-[10px] font-semibold text-slate-500 space-y-1 block">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 mt-0.5"
      />
    </label>
  );
}
