import UserIssue from "../models/UserIssue.js";

export const listUserIssues = async (req, res) => {
  const filter = req.user.roles.tracker === "ADMIN" ? {} : { submittedBy: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  res.json(await UserIssue.find(filter).populate("submittedBy", "name email").sort({ createdAt: -1 }));
};

export const createUserIssue = async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ message: "message is required" });

  const issue = await UserIssue.create({
    message,
    submittedBy: req.user._id,
    role: req.user.roles.tracker,
  });
  res.status(201).json(issue);
};

export const resolveUserIssue = async (req, res) => {
  if (req.user.roles.tracker !== "ADMIN") return res.status(403).json({ message: "Admin access required" });

  const issue = await UserIssue.findByIdAndUpdate(req.params.id, { $set: { status: "RESOLVED" } }, { new: true });
  if (!issue) return res.status(404).json({ message: "Issue not found" });
  res.json(issue);
};
