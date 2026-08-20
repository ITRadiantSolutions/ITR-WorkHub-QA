import mongoose from "mongoose";

export const ASSET_CATEGORIES = ["laptop", "monitor", "mobile", "sim", "keyboard", "mouse", "other"];

const assetSchema = new mongoose.Schema(
  {
    assetTag: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ASSET_CATEGORIES, required: true },
    serialNumber: { type: String, trim: true, default: "" },
    condition: { type: String, enum: ["new", "good", "fair", "damaged"], default: "new" },
    // Derived from AssetAssignment, but mirrored here for cheap list-view
    // filtering — kept in sync by the assign/return controllers, not by hand.
    status: { type: String, enum: ["available", "assigned", "retired"], default: "available" },
    purchaseDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("Asset", assetSchema);
