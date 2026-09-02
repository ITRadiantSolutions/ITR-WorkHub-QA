import mongoose from "mongoose";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Absent for SSO-only accounts that have never set a local password.
    password: { type: String, minlength: 6, default: null },

    authProvider: { type: String, enum: ["local", "azure"], default: "local" },
    azureAdId: { type: String, default: null, index: true, sparse: true },

    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    shift: { type: String, default: null },
    isSuperAdmin: { type: Boolean, default: false },
    manageAccessModules: { type: [String], default: [] },
    department: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: "Designation", default: null },
    gradeId: { type: mongoose.Schema.Types.ObjectId, ref: "Grade", default: null },
    locationId: { type: mongoose.Schema.Types.ObjectId, ref: "Location", default: null },
    employeeId: { type: String, trim: true, default: "" },
    joiningDate: { type: Date, default: null },
    dateOfBirth: { type: Date, default: null },
    panNumber: { type: String, trim: true, default: "" },
    employmentStatus: {
      type: String,
      enum: ["active", "on_leave", "terminated"],
      default: "active",
    },
    managerName: { type: String, trim: true, default: "" },
    roles: {
      timesheet: { type: String, enum: ["employee", "manager", "hr"], default: "employee" },
      pms: { type: String, enum: ["employee", "manager", "hr"], default: "employee" },
      tracker: {
        type: String,
        enum: ["ADMIN", "PM", "DEVELOPER", "QA", "BUSINESS_USER"],
        default: "BUSINESS_USER",
      },

      vms: { type: String, enum: ["host", "receptionist", "admin"], default: "host" },
      lms: { type: String, enum: ["employee", "manager", "admin"], default: "employee" },
      hrms: { type: String, enum: ["employee", "manager", "hr", "recruiter"], default: "employee" },
    },

    archived: {
      timesheet: { type: Boolean, default: false },
      pms: { type: Boolean, default: false },
      tracker: { type: Boolean, default: false },
      vms: { type: Boolean, default: false },
      lms: { type: Boolean, default: false },
      hrms: { type: Boolean, default: false },
      account: { type: Boolean, default: false },
    },

    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    editedAt: { type: Date, default: null },
    isEdited: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index({ "roles.timesheet": 1 });
userSchema.index({ "roles.pms": 1 });
userSchema.index({ "roles.tracker": 1 });
userSchema.index({ "roles.vms": 1 });
userSchema.index({ "roles.lms": 1 });
userSchema.index({ "roles.hrms": 1 });

// Keep password hashing in one place so every creation/update path is safe.
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  if (BCRYPT_HASH_PATTERN.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  if (BCRYPT_HASH_PATTERN.test(this.password)) {
    return bcrypt.compare(candidate, this.password);
  }
  return candidate === this.password;
};

userSchema.methods.hasLegacyPlaintextPassword = function () {
  return Boolean(this.password) && !BCRYPT_HASH_PATTERN.test(this.password);
};

export default mongoose.model("User", userSchema);
