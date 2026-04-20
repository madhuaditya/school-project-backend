const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    applicantUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    leaveType: {
      type: String,
      enum: ["sick", "casual", "earned", "maternity", "paternity", "other"],
      required: true,
    },
    purpose: {
      type: String,
      trim: true,
      default: "",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "declined"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewRemark: {
      type: String,
      trim: true,
      default: "",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    attendanceSyncMeta: {
      type: Object,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

leaveSchema.pre("validate", function () {
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    this.invalidate("endDate", "endDate must be greater than or equal to startDate");
  }
});

leaveSchema.index({ school: 1, status: 1, startDate: 1, createdAt: -1 });
leaveSchema.index({ school: 1, applicantUser: 1, startDate: -1 });
leaveSchema.index({ school: 1, applicantUser: 1, status: 1 });

module.exports = mongoose.model("Leave", leaveSchema);
