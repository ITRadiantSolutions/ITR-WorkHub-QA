import xlsx from "xlsx";
import Skill from "../models/Skill.js";
import SkillCategory from "../models/SkillCategory.js";
import Course from "../models/Course.js";

// Ported from the standalone LMS project's skillController.js. Bulk import
// uses multer memoryStorage (see routes/lms/skill.routes.js) instead of the
// source's disk storage, so the workbook is parsed straight from the
// buffer — no temp file to clean up afterward.

const isManager = (user) => ["manager", "admin"].includes(user.roles.lms);

const DEFAULT_CATEGORIES = [
  "Frontend", "Backend", "Full Stack", "Mobile Development", "Programming Language", "Database",
  "Cloud", "DevOps", "AI / ML", "Data Science", "Cyber Security", "Testing / QA", "UI / UX",
  "Soft Skills", "App Development", "AI/ML", "AI Tools", "Data Analytics", "Ethical Hacking",
  "UI UX Designing", "Web Development", "Others",
];

const normalizeCategoryName = (value) => value?.toString().trim();

const ensureCategory = async (name, createdBy = null) => {
  const cleanName = normalizeCategoryName(name);
  if (!cleanName) return null;
  return SkillCategory.findOneAndUpdate(
    { normalizedName: cleanName.toLowerCase() },
    { $setOnInsert: { name: cleanName, normalizedName: cleanName.toLowerCase(), createdBy } },
    { new: true, upsert: true },
  );
};

export const getSkillCategories = async (req, res) => {
  const [skillNames, courseNames] = await Promise.all([Skill.distinct("category"), Course.distinct("category")]);
  const names = [...new Set([...DEFAULT_CATEGORIES, ...skillNames, ...courseNames].filter(Boolean))];
  await Promise.all(names.map((name) => ensureCategory(name)));
  res.json(await SkillCategory.find().sort({ name: 1 }));
};

export const createSkillCategory = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const name = normalizeCategoryName(req.body?.name);
  if (!name) return res.status(400).json({ message: "Category name is required." });

  const existing = await SkillCategory.findOne({ normalizedName: name.toLowerCase() });
  if (existing) return res.status(400).json({ message: "Category already exists." });

  const category = await SkillCategory.create({ name, normalizedName: name.toLowerCase(), createdBy: req.user._id });
  res.status(201).json(category);
};

export const bulkCreateSkillCategories = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const input = Array.isArray(req.body?.categories) ? req.body.categories : (req.body?.categories || "").split(/[\n,]/);
  const names = [...new Set(input.map(normalizeCategoryName).filter(Boolean))];
  if (!names.length) return res.status(400).json({ message: "Add at least one category." });

  let inserted = 0;
  let skipped = 0;
  for (const name of names) {
    const exists = await SkillCategory.exists({ normalizedName: name.toLowerCase() });
    if (exists) {
      skipped += 1;
    } else {
      await SkillCategory.create({ name, normalizedName: name.toLowerCase(), createdBy: req.user._id });
      inserted += 1;
    }
  }
  res.json({ inserted, skipped });
};

export const deleteSkillCategory = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const category = await SkillCategory.findById(req.params.id);
  if (!category) return res.status(404).json({ message: "Category not found." });

  const [usedBySkill, usedByCourse] = await Promise.all([
    Skill.exists({ category: category.name }),
    Course.exists({ category: category.name }),
  ]);
  if (usedBySkill || usedByCourse) return res.status(409).json({ message: "This category is in use and cannot be deleted." });

  await category.deleteOne();
  res.json({ message: "Category deleted." });
};

export const createSkill = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { name, category, description } = req.body;
  if (!name || !category) return res.status(400).json({ message: "Skill name and category are required." });

  const exists = await Skill.findOne({ name: name.trim() });
  if (exists) return res.status(400).json({ message: "Skill already exists." });

  await ensureCategory(category, req.user._id);
  const skill = await Skill.create({ name, category, description, createdBy: req.user._id });
  res.status(201).json(skill);
};

export const getSkills = async (req, res) => {
  const skills = await Skill.find().populate("createdBy", "name email").sort({ createdAt: -1 });
  res.json(skills);
};

export const getSkillById = async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) return res.status(404).json({ message: "Skill not found" });
  res.json(skill);
};

export const updateSkill = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const { name, category, description, status } = req.body;

  const skill = await Skill.findById(req.params.id);
  if (!skill) return res.status(404).json({ message: "Skill not found" });

  await ensureCategory(category, req.user._id);
  skill.name = name;
  skill.category = category;
  skill.description = description;
  skill.status = status;
  await skill.save();

  res.json(skill);
};

export const deleteSkill = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const skill = await Skill.findById(req.params.id);
  if (!skill) return res.status(404).json({ message: "Skill not found" });

  await skill.deleteOne();
  res.json({ message: "Skill deleted successfully." });
};

export const changeSkillStatus = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  const skill = await Skill.findById(req.params.id);
  if (!skill) return res.status(404).json({ message: "Skill not found" });

  skill.status = skill.status === "Active" ? "Inactive" : "Active";
  await skill.save();
  res.json(skill);
};

export const bulkImportSkills = async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ message: "Manager/Admin access required" });
  if (!req.file) return res.status(400).json({ message: "Excel file is required." });

  const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) return res.status(400).json({ message: "Excel sheet is empty." });

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "No data found in Excel." });

  const errors = [];
  let inserted = 0;
  let updated = 0;

  const normalizedNames = rows
    .map((row) => (row.name ?? row.Name ?? "").toString().trim().toLowerCase())
    .filter(Boolean);
  const uniqueLowerNames = [...new Set(normalizedNames)];
  const existing = uniqueLowerNames.length
    ? (await Skill.find({}).select("name category description status")).filter((skill) => uniqueLowerNames.includes(skill.name.toLowerCase()))
    : [];
  const existingByLower = new Map(existing.map((skill) => [skill.name.toLowerCase(), skill]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    const name = (row.name ?? row.Name ?? "").toString().trim();
    const category = (row.category ?? row.Category ?? "").toString().trim();
    const description = (row.description ?? row.Description ?? "").toString().trim();
    const status = (row.status ?? row.Status ?? "").toString().trim() || "Active";

    if (!name) {
      errors.push({ row: rowNumber, message: "name is required" });
      continue;
    }
    if (!category) {
      errors.push({ row: rowNumber, message: "category is required" });
      continue;
    }
    if (!["Active", "Inactive"].includes(status)) {
      errors.push({ row: rowNumber, message: `Invalid status: ${status}. Use Active or Inactive.` });
      continue;
    }

    await ensureCategory(category, req.user._id);
    const existingSkill = existingByLower.get(name.toLowerCase());

    if (!existingSkill) {
      try {
        await Skill.create({ name, category, description, status, createdBy: req.user._id });
        inserted += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error.message || "Create failed" });
      }
    } else {
      try {
        existingSkill.category = category;
        existingSkill.description = description;
        existingSkill.status = status;
        await existingSkill.save();
        updated += 1;
      } catch (error) {
        errors.push({ row: rowNumber, message: error.message || "Update failed" });
      }
    }
  }

  res.json({ inserted, updated, skipped: 0, errors });
};
