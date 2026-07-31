import mongoose from "mongoose";

// Company-wide default holiday calendar. Individual projects can opt a
// client out of a specific date via Project.excludedHolidays (e.g. a US
// client that doesn't observe an India public holiday).
const companyHolidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // "YYYY-MM-DD"
    label: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export default mongoose.model("CompanyHoliday", companyHolidaySchema);
