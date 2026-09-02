import mongoose from "mongoose";

const usersGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },

  { timestamps: true, collection: "users_group" },
);

export default mongoose.model("UsersGroup", usersGroupSchema);
