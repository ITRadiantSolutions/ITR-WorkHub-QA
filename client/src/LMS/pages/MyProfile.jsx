import { useEffect, useState } from "react";
import { toast } from "sonner";
import { profileApi, skillsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const EMPTY_EXPERIENCE = { company: "", role: "", start: "", end: "", description: "" };

export default function MyProfile() {
  const [profile, setProfile] = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addSkillId, setAddSkillId] = useState("");
  const [addSkillLevel, setAddSkillLevel] = useState("Beginner");
  const [savingSkill, setSavingSkill] = useState(false);

  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [description, setDescription] = useState("");
  const [experiences, setExperiences] = useState([]);
  const [savingDetails, setSavingDetails] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([profileApi.me(), skillsApi.all(), skillsApi.categories()])
      .then(([profileRes, skillsRes, categoriesRes]) => {
        setProfile(profileRes.data);
        setDescription(profileRes.data.description || "");
        setExperiences(profileRes.data.experiences?.length ? profileRes.data.experiences : [{ ...EMPTY_EXPERIENCE }]);
        setAllSkills(skillsRes.data);
        setCategories(categoriesRes.data);
      })
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const addSkill = async (e) => {
    e.preventDefault();
    if (!addSkillId) return toast.error("Select a skill");
    setSavingSkill(true);
    try {
      const { data } = await profileApi.upsertSkill({ skillId: addSkillId, level: addSkillLevel });
      setProfile((p) => ({ ...p, skills: data.skills, totalSkills: data.totalSkills, profileCompletionPercent: data.profileCompletionPercent }));
      setAddSkillId("");
      setAddSkillLevel("Beginner");
      toast.success("Skill added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add skill");
    } finally {
      setSavingSkill(false);
    }
  };

  const removeSkill = async (skillId) => {
    try {
      const { data } = await profileApi.removeSkill(skillId);
      setProfile((p) => ({ ...p, skills: data.skills, totalSkills: data.totalSkills, profileCompletionPercent: data.profileCompletionPercent }));
    } catch {
      toast.error("Failed to remove skill");
    }
  };

  const uploadResume = async () => {
    if (!resumeFile) return;
    setUploadingResume(true);
    try {
      const formData = new FormData();
      formData.append("file", resumeFile);
      const { data } = await profileApi.uploadResume(formData);
      setProfile((p) => ({ ...p, resume: data.resume, hasResume: true, profileCompletionPercent: data.profileCompletionPercent }));
      setResumeFile(null);
      toast.success("Resume uploaded");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload resume");
    } finally {
      setUploadingResume(false);
    }
  };

  const updateExperience = (index, field, value) => {
    setExperiences((prev) => prev.map((exp, i) => (i === index ? { ...exp, [field]: value } : exp)));
  };

  const addExperienceRow = () => setExperiences((prev) => [...prev, { ...EMPTY_EXPERIENCE }]);
  const removeExperienceRow = (index) => setExperiences((prev) => prev.filter((_, i) => i !== index));

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      const cleanedExperiences = experiences.filter((exp) => exp.company.trim() || exp.role.trim());
      const { data } = await profileApi.update({ description, experiences: cleanedExperiences });
      setProfile((p) => ({ ...p, description: data.description, experiences: data.experiences, profileCompletionPercent: data.profileCompletionPercent }));
      setExperiences(data.experiences?.length ? data.experiences : [{ ...EMPTY_EXPERIENCE }]);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save profile");
    } finally {
      setSavingDetails(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>;

  const percent = profile?.profileCompletionPercent ?? 0;
  const profileSkillIds = new Set((profile?.skills || []).map((item) => String(item.skill?._id || item.skill)));
  const availableSkills = allSkills.filter((s) => s.status === "Active" && !profileSkillIds.has(String(s._id)));
  const skillsByCategory = categories.map((cat) => ({
    ...cat,
    skills: availableSkills.filter((s) => s.category === cat.name),
  }));

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Profile</h1>
        <p className="text-xs text-slate-500 mt-0.5">Add your skills and resume — courses can only be assigned once your profile is at least 50% complete.</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-700">Profile completion</p>
          <p className="text-xs font-bold text-amber-600">{percent}%</p>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full ${percent >= 50 ? "bg-emerald-500" : "bg-amber-500"} transition-all`} style={{ width: `${percent}%` }} />
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Skills + resume gets you to 50%. Add a description and work experience to reach 100%.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 items-start">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-700">Resume {!profile?.hasResume && <span className="text-red-500 font-normal">(required)</span>}</p>
          {profile?.hasResume && (
            <a href={profile.resume} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-amber-600 hover:underline flex items-center gap-1 w-fit">
              <Icons.Download /> View current resume
            </a>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer border border-dashed border-slate-300 rounded-xl px-3 py-2">
              <Icons.Plus />
              {resumeFile ? resumeFile.name : "Choose file"}
              <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
            </label>
            <button disabled={!resumeFile || uploadingResume} onClick={uploadResume} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-60">
              {uploadingResume ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
          <p className="text-xs font-bold text-slate-700">Description</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="A short summary about yourself"
            className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
        <p className="text-xs font-bold text-slate-700">Skills</p>

        <div className="rounded-2xl border border-slate-100 bg-white divide-y divide-slate-50">
          {(profile?.skills || []).length === 0 && <p className="text-xs text-slate-400 p-3">No skills added yet.</p>}
          {(profile?.skills || []).map((item) => (
            <div key={item.skill?._id || item.skill} className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-xs font-bold text-slate-800">{item.skill?.name || "Unknown skill"}</p>
                <p className="text-[10px] text-slate-400">
                  {item.skill?.category} · {item.level} · {item.status}
                </p>
              </div>
              <button onClick={() => removeSkill(item.skill?._id || item.skill)} className="text-red-500">
                <Icons.Trash />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addSkill} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={addSkillId} onChange={(e) => setAddSkillId(e.target.value)} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5">
            <option value="">Select a skill</option>
            {skillsByCategory.map((cat) =>
              cat.skills.length ? (
                <optgroup key={cat._id} label={cat.name}>
                  {cat.skills.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
          <select value={addSkillLevel} onChange={(e) => setAddSkillLevel(e.target.value)} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5">
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <button type="submit" disabled={savingSkill} className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-60">
            + Add skill
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">Work experience</p>
          <button onClick={addExperienceRow} className="text-xs font-semibold text-amber-600 hover:underline">
            + Add role
          </button>
        </div>

        {experiences.map((exp, index) => (
          <div key={index} className="rounded-xl border border-slate-100 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
            <input placeholder="Company" value={exp.company} onChange={(e) => updateExperience(index, "company", e.target.value)} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5" />
            <input placeholder="Role" value={exp.role} onChange={(e) => updateExperience(index, "role", e.target.value)} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5" />
            <input placeholder="Start (e.g. Jan 2022)" value={exp.start} onChange={(e) => updateExperience(index, "start", e.target.value)} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5" />
            <input placeholder="End (e.g. Present)" value={exp.end} onChange={(e) => updateExperience(index, "end", e.target.value)} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5" />
            <textarea
              placeholder="What did you work on?"
              value={exp.description}
              onChange={(e) => updateExperience(index, "description", e.target.value)}
              rows={2}
              className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 sm:col-span-2"
            />
            {experiences.length > 1 && (
              <button onClick={() => removeExperienceRow(index)} className="absolute top-2 right-2 text-red-500">
                <Icons.Trash />
              </button>
            )}
          </div>
        ))}
      </div>

      <button disabled={savingDetails} onClick={saveDetails} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow disabled:opacity-60">
        <Icons.Save /> {savingDetails ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
