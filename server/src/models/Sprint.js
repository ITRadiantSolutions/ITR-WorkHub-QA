import mongoose from "mongoose";

const sprintSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },

    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > this.startDate;
        },
        message: "End date must be after start date",
      },
    },

    goal: { type: String, trim: true },
    status: { type: String, enum: ["Planning", "Active", "Completed"], default: "Planning" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    comments: [
      {
        text: { type: String, required: true, trim: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

sprintSchema.index({ projectId: 1, createdAt: -1 });
sprintSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Sprint", sprintSchema);
