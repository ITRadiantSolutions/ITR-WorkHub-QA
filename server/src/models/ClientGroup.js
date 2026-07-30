import mongoose from "mongoose";

const clientGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    status: { type: String, enum: ["Planning", "Active", "Done"], required: true, default: "Active" },
    projects: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true }],
      required: true,
      validate: {
        validator: (projects) => Array.isArray(projects) && projects.length > 0,
        message: "Select at least one project",
      },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  // Explicit name: Mongoose's default pluralization ("clientgroups") doesn't
  // match the "client_groups" collection the data migration wrote to.
  { timestamps: true, collection: "client_groups" },
);

clientGroupSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export default mongoose.model("ClientGroup", clientGroupSchema);
