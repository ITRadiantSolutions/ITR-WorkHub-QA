import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Task title is required"], trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000, default: "" },

    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },

    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    status: {
      type: String,
      enum: { values: ["TODO", "IN_PROGRESS", "ON_HOLD", "QA_TESTING", "DONE"], message: "{VALUE} is not a valid task status" },
      default: "TODO",
      uppercase: true,
      trim: true,
      index: true,
    },

    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, default: null },
    assignedAt: { type: Date, default: Date.now },

    priority: {
      type: String,
      enum: { values: ["Low", "Medium", "High"], message: "{VALUE} is not a valid priority" },
      default: "Medium",
      trim: true,
      index: true,
    },

    dueDate: { type: Date, required: true, index: true },

    comments: { type: [commentSchema], default: [] },
    bugs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bug" }],
  },
  { timestamps: true, versionKey: false },
);

taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ assignees: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ priority: 1, status: 1 });
taskSchema.index({ createdBy: 1, createdAt: -1 });
taskSchema.index({ projectId: 1, createdAt: -1 });
taskSchema.index({ projectId: 1, priority: 1, status: 1, createdAt: -1 });

export default mongoose.model("Task", taskSchema);
