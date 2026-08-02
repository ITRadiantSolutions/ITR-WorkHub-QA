import TimesheetFaq from "../models/TimesheetFaq.js";

const requireHr = (req, res) => {
  if (req.user.roles.timesheet !== "hr") {
    res.status(403).json({ message: "HR access required" });
    return false;
  }
  return true;
};

// Readable by anyone authenticated — every timesheet user sees the Guide's FAQ tab.
export const listFaqs = async (req, res) => {
  const faqs = await TimesheetFaq.find().sort({ order: 1, createdAt: 1 });
  res.json(faqs);
};

export const createFaq = async (req, res) => {
  if (!requireHr(req, res)) return;
  const { question, answer, order } = req.body;
  if (!question?.trim() || !answer?.trim()) {
    return res.status(400).json({ message: "Question and answer are required" });
  }
  const faq = await TimesheetFaq.create({
    question: question.trim(),
    answer: answer.trim(),
    order: Number.isFinite(order) ? order : 0,
    createdBy: req.user._id,
  });
  res.status(201).json(faq);
};

export const updateFaq = async (req, res) => {
  if (!requireHr(req, res)) return;
  const { question, answer, order } = req.body;
  const update = {};
  if (question !== undefined) {
    if (!question.trim()) return res.status(400).json({ message: "Question cannot be empty" });
    update.question = question.trim();
  }
  if (answer !== undefined) {
    if (!answer.trim()) return res.status(400).json({ message: "Answer cannot be empty" });
    update.answer = answer.trim();
  }
  if (order !== undefined) update.order = order;

  const faq = await TimesheetFaq.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!faq) return res.status(404).json({ message: "FAQ not found" });
  res.json(faq);
};

export const deleteFaq = async (req, res) => {
  if (!requireHr(req, res)) return;
  await TimesheetFaq.findByIdAndDelete(req.params.id);
  res.status(204).send();
};
