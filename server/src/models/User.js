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

    // Independent per-module roles — a user can be e.g. a timesheet "manager"
    // and a tracker "DEVELOPER" at the same time.
    roles: {
      timesheet: { type: String, enum: ["employee", "manager", "hr"], default: "employee" },
      pms: { type: String, enum: ["employee", "manager", "hr"], default: "employee" },
      tracker: {
        type: String,
        enum: ["ADMIN", "PM", "DEVELOPER", "QA", "BUSINESS_USER"],
        default: "BUSINESS_USER",
      },
    },

    // Independent per-module archive flags, plus a full-account deactivation flag.
    archived: {
      timesheet: { type: Boolean, default: false },
      pms: { type: Boolean, default: false },
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

// Keep password hashing in one place so every creation/update path is safe.
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  if (BCRYPT_HASH_PATTERN.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

// Both source systems have pre-existing plaintext-password accounts. Verify
// against either shape here; callers re-save the user after a successful
// legacy match so it gets hashed and never compared as plaintext again.
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
