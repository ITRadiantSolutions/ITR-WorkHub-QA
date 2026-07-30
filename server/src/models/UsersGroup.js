import mongoose from "mongoose";

const usersGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  // Explicit name: Mongoose's default pluralization ("usersgroups") doesn't
  // match the "users_group" collection the data migration wrote to.
  { timestamps: true, collection: "users_group" },
);

export default mongoose.model("UsersGroup", usersGroupSchema);
