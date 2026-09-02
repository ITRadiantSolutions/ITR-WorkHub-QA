import mongoose from "mongoose";
 
const companyHolidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // "YYYY-MM-DD"
    label: { type: String, trim: true, default: "" },
    isFloater: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("CompanyHoliday", companyHolidaySchema);
