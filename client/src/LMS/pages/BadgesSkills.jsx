import { useEffect, useState } from "react";
import { toast } from "sonner";
import { badgesApi, skillsApi, assignmentsApi, employeeSkillsApi } from "../lmsApi.js";
import Icons from "../../components/Icons.jsx";

const TABS = [
  { key: "badges", label: "Badges" },
  { key: "skills", label: "Skills" },
  { key: "employee-skills", label: "Employee Skills" },
];

export default function BadgesSkills() {
  const [tab, setTab] = useState("badges");

  return (
    <div className="p-6 sm:p-8 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Badges & Skills</h1>
        <p className="text-xs text-slate-500 mt-0.5">Manage what learners can earn, and edit an employee's skill set directly.</p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-semibold rounded-lg px-3.5 py-1.5 ${
              tab === t.key ? "bg-amber-600 text-white" : "bg-white border border-slate-200 text-slate-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "badges" ? <BadgesTab /> : tab === "skills" ? <SkillsTab /> : <EmployeeSkillsTab />}
    </div>
  );
}

function BadgesTab() {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const load = () =>
    badgesApi
      .allAdmin()
      .then((res) => setBadges(res.data))
      .catch(() => toast.error("Failed to load badges"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      ["name", "description", "category", "color"].forEach((key) => data.append(key, form[key] || ""));
      if (form.image) data.append("image", form.image);
      if (form._id) await badgesApi.update(form._id, data);
      else await badgesApi.create(data);
      toast.success("Badge saved");
      setForm(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save badge");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this badge?")) return;
    try {
      await badgesApi.remove(id);
      toast.success("Badge deleted");
      load();
    } catch {
      toast.error("Failed to delete badge");
    }
  };

  if (loading) return <div className="text-sm text-slate-400">Loading…</div>;

  return (
    <div className="space-y-3">
      <button onClick={() => setForm({ name: "", description: "", category: "General", color: "#7C3AED", image: null })} className="text-xs font-semibold text-amber-600 hover:underline">
        + Add Badge
      </button>

      {form && (
        <form onSubmit={submit} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="text-xs rounded-lg border border-slate-200 px-3 py-1.5" />
          <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category" className="text-xs rounded-lg border border-slate-200 px-3 py-1.5" />
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 sm:col-span-2"
          />
          <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-8 w-16" />
          <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, image: e.target.files[0] }))} className="text-xs" />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
              Save
            </button>
            <button type="button" onClick={() => setForm(null)} className="text-xs font-semibold text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {badges.map((badge) => (
          <div key={badge._id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-3 text-center">
            <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-white mb-2" style={{ backgroundColor: badge.color }}>
              <Icons.Award />
            </div>
            <p className="text-xs font-bold text-slate-800">{badge.name}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <button onClick={() => setForm({ ...badge, image: null })} className="text-[10px] font-semibold text-amber-600 hover:underline">
                Edit
              </button>
              <button onClick={() => remove(badge._id)} className="text-red-500">
                <Icons.Trash />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillsTab() {
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [newCategory, setNewCategory] = useState("");

  const load = () =>
    skillsApi
      .all()
      .then((res) => setSkills(res.data))
      .catch(() => toast.error("Failed to load skills"))
      .finally(() => setLoading(false));

  const loadCategories = () =>
    skillsApi
      .categories()
      .then((res) => setCategories(res.data))
      .catch(() => toast.error("Failed to load categories"));

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  const addCategory = async (e) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    try {
      await skillsApi.createCategory(name);
      toast.success("Category added");
      setNewCategory("");
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add category");
    }
  };

  const removeCategory = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await skillsApi.deleteCategory(id);
      toast.success("Category deleted");
      loadCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete category");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form._id) await skillsApi.update(form._id, form);
      else await skillsApi.create(form);
      toast.success("Skill saved");
      setForm(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save skill");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this skill?")) return;
    try {
      await skillsApi.remove(id);
      toast.success("Skill deleted");
      load();
    } catch {
      toast.error("Failed to delete skill");
    }
  };

  if (loading) return <div className="text-sm text-slate-400">Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 space-y-3">
        <p className="text-xs font-bold text-slate-700">Categories</p>
        <form onSubmit={addCategory} className="flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name"
            className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 flex-1"
          />
          <button type="submit" className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
            Add
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span key={cat._id} className="inline-flex items-center gap-1.5 text-[10px] font-semibold rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
              {cat.name}
              <button onClick={() => removeCategory(cat._id)} className="text-red-500 hover:text-red-600">
                <Icons.Trash />
              </button>
            </span>
          ))}
          {categories.length === 0 && <p className="text-xs text-slate-400">No categories yet.</p>}
        </div>
      </div>

      <button onClick={() => setForm({ name: "", category: "", description: "", status: "Active" })} className="text-xs font-semibold text-amber-600 hover:underline">
        + Add Skill
      </button>

      {form && (
        <form onSubmit={submit} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="text-xs rounded-lg border border-slate-200 px-3 py-1.5" />
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5">
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            className="text-xs rounded-lg border border-slate-200 px-3 py-1.5 sm:col-span-2"
          />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
              Save
            </button>
            <button type="button" onClick={() => setForm(null)} className="text-xs font-semibold text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-50">
        {skills.map((skill) => (
          <div key={skill._id} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className="text-xs font-bold text-slate-800">{skill.name}</p>
              <p className="text-[10px] text-slate-400">{skill.category}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${skill.status === "Active" ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"}`}>
                {skill.status}
              </span>
              <button onClick={() => setForm(skill)} className="text-[10px] font-semibold text-amber-600 hover:underline">
                Edit
              </button>
              <button onClick={() => remove(skill._id)} className="text-red-500">
                <Icons.Trash />
              </button>
            </div>
          </div>
        ))}
        {skills.length === 0 && <p className="text-xs text-slate-400 p-4">No skills yet.</p>}
      </div>
    </div>
  );
}

const LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const STATUSES = ["Learning", "Completed", "Verified"];

function EmployeeSkillsTab() {
  const [employees, setEmployees] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [profileSkills, setProfileSkills] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [form, setForm] = useState({ skillId: "", level: "Beginner", status: "Learning" });

  useEffect(() => {
    Promise.all([assignmentsApi.employees(), skillsApi.all()])
      .then(([employeesRes, skillsRes]) => {
        setEmployees(employeesRes.data);
        setAllSkills(skillsRes.data);
      })
      .catch(() => toast.error("Failed to load employees/skills"));
  }, []);

  const loadProfile = (employee) => {
    setSelectedEmployee(employee);
    setLoadingProfile(true);
    employeeSkillsApi
      .get(employee._id)
      .then((res) => setProfileSkills(res.data.skills || []))
      .catch(() => toast.error("Failed to load employee skills"))
      .finally(() => setLoadingProfile(false));
  };

  const addOrUpdateSkill = async (e) => {
    e.preventDefault();
    if (!form.skillId) return toast.error("Select a skill");
    try {
      const { data } = await employeeSkillsApi.upsert(selectedEmployee._id, form);
      setProfileSkills(data.skills || []);
      setForm({ skillId: "", level: "Beginner", status: "Learning" });
      toast.success("Skill saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save skill");
    }
  };

  const removeSkill = async (skillId) => {
    try {
      const { data } = await employeeSkillsApi.remove(selectedEmployee._id, skillId);
      setProfileSkills(data.skills || []);
    } catch {
      toast.error("Failed to remove skill");
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-50 sm:col-span-1 max-h-[70vh] overflow-y-auto">
        {employees.map((employee) => (
          <button
            key={employee._id}
            onClick={() => loadProfile(employee)}
            className={`w-full text-left px-4 py-2.5 ${selectedEmployee?._id === employee._id ? "bg-amber-50" : "hover:bg-slate-50"}`}
          >
            <p className="text-xs font-bold text-slate-800">{employee.name}</p>
            <p className="text-[10px] text-slate-400">{employee.email}</p>
          </button>
        ))}
        {employees.length === 0 && <p className="text-xs text-slate-400 p-4">No employees found.</p>}
      </div>

      <div className="sm:col-span-2 space-y-3">
        {!selectedEmployee ? (
          <p className="text-xs text-slate-400">Select an employee to view and edit their skills.</p>
        ) : loadingProfile ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          <>
            <p className="text-xs font-bold text-slate-700">{selectedEmployee.name}'s skills</p>

            <form onSubmit={addOrUpdateSkill} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={form.skillId} onChange={(e) => setForm((f) => ({ ...f, skillId: e.target.value }))} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5">
                <option value="">Select skill</option>
                {allSkills.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5">
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="text-xs rounded-lg border border-slate-200 px-3 py-1.5">
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button type="submit" className="sm:col-span-3 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
                Add / Update Skill
              </button>
            </form>

            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-50">
              {profileSkills.map((item) => (
                <div key={item.skill?._id || item.skill} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{item.skill?.name || "Unknown skill"}</p>
                    <p className="text-[10px] text-slate-400">
                      {item.level} · {item.status}
                    </p>
                  </div>
                  <button onClick={() => removeSkill(item.skill?._id || item.skill)} className="text-red-500">
                    <Icons.Trash />
                  </button>
                </div>
              ))}
              {profileSkills.length === 0 && <p className="text-xs text-slate-400 p-4">No skills assigned yet.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
