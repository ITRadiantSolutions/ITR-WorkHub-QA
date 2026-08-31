import mongoose from "mongoose";

// A short-lived mutex, not a record of anything — submitLeaveRequest reads
// the employee's balance and then creates a new LeaveRequest document as two
// separate steps with no shared row to lock, so two near-simultaneous
// submissions for the same employee+leaveType (a double-click, two open
// tabs, a network retry) can both read the same "balance remaining" before
// either write lands, both pass validation, and both get created — pushing
// the real balance negative. The unique index below serializes that one
// narrow window; the TTL is only a safety net in case a process crashes
// between acquiring and releasing (see submitLeaveRequest's try/finally).
const leaveRequestLockSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: mongoose.Schema.Types.ObjectId, ref: "LeaveType", required: true },
  createdAt: { type: Date, default: Date.now, expires: 30 },
});

leaveRequestLockSchema.index({ employee: 1, leaveType: 1 }, { unique: true });

export default mongoose.model("LeaveRequestLock", leaveRequestLockSchema);
