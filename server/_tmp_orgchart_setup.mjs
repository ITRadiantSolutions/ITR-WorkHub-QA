import mongoose from "mongoose";
import "dotenv/config";

const User = (await import("./src/models/User.js")).default;

await mongoose.connect(process.env.MONGO_URI);

const EMAIL_HR = "orgchart-qa-hr@itradiant-test.local";
const EMAIL_EMP = "orgchart-qa-emp@itradiant-test.local";
const PASSWORD = "OrgChartQA#2026";

await User.deleteMany({ email: { $in: [EMAIL_HR, EMAIL_EMP] } });

const hr = await User.create({
  name: "OrgChart QA HR",
  email: EMAIL_HR,
  password: PASSWORD,
  authProvider: "local",
  roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", hrms: "hr" },
  approvalStatus: "Approved",
  approvedAt: new Date(),
  department: "Human Resources",
  designation: "HR Manager",
});

const emp = await User.create({
  name: "OrgChart QA Employee",
  email: EMAIL_EMP,
  password: PASSWORD,
  authProvider: "local",
  roles: { timesheet: "employee", pms: "employee", tracker: "BUSINESS_USER", hrms: "employee" },
  approvalStatus: "Approved",
  approvedAt: new Date(),
  department: "Engineering",
  designation: "Software Engineer",
  managerId: hr._id,
});

console.log("CREATED", hr._id.toString(), emp._id.toString());
await mongoose.disconnect();
