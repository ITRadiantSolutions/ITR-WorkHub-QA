import mongoose from "mongoose";

const kraResponseSchema = new mongoose.Schema(
  {
    kraId: { type: mongoose.Schema.Types.ObjectId, default: null }, // KraAssignment.kras[]._id
    kraName: String,
    weight: Number,
    kpis: { type: [mongoose.Schema.Types.Mixed], default: [] }, // includes each kpi's `actual`
    response: { type: String, default: "" },
    rating: { type: Number, default: null },
    managerResponse: { type: String, default: "" },
    managerRating: { type: Number, default: null },
    status: {
      type: String,
      enum: ["pending", "employee_submitted", "manager_reviewed", "manager_approved"],
      default: "pending",
    },
    employeeSubmittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false },
);

const submissionSchema = new mongoose.Schema(
  {
    cycleId: { type: mongoose.Schema.Types.ObjectId, ref: "Cycle", required: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "KraAssignment", default: null },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    status: {
      type: String,
      enum: [
        "draft",
        "pending_manager_approval",
        "manager_approved",
        "employee_submitted",
        "final_employee_submitted",
        "manager_reviewed",
        "final_manager_reviewed",
      ],
      default: "draft",
    },

    kraResponses: { type: [kraResponseSchema], default: [] },
    submittedAt: { type: Date, default: null },

    finalReport: {
      managerSubmitted: { type: Boolean, default: false },
      managerOverallResponse: { type: String, default: "" },
      employeeAvg: { type: Number, default: null },
      managerAvg: { type: Number, default: null },
      overallRating: { type: Number, default: null },
      oneOnOneDate: { type: Date, default: null },
      oneOnOneComment: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

submissionSchema.index({ cycleId: 1, employeeId: 1 }, { unique: true });
submissionSchema.index({ cycleId: 1, managerId: 1 });

const KRA_RESPONSE_STATUSES = kraResponseSchema.path("status").enumValues;

submissionSchema.pre("save", async function () {
  for (const response of this.kraResponses) {
    if (!KRA_RESPONSE_STATUSES.includes(response.status)) {
      response.status = "pending";
    }
  }

  if (!this.cycleId && this.assignmentId) {
    const assignment = await mongoose.model("KraAssignment").findById(this.assignmentId).select("cycleId");
    if (assignment?.cycleId) this.cycleId = assignment.cycleId;
  }
});

export default mongoose.model("Submission", submissionSchema);
