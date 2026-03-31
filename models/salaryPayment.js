const mongoose = require("mongoose");

const salaryPaymentSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },

    salaryRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryRecord",
      required: true,
    },

    amount: { type: Number, required: true, min: 0 },

    method: {
      type: String,
      enum: ["BANK", "UPI", "CASH"],
      required: true,
    },

    transactionId: String,

    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "PENDING"],
      default: "PENDING",
    },

    remarks: String,

    paidAt: { type: Date, default: Date.now },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

salaryPaymentSchema.index({ school: 1, staffId: 1 });
salaryPaymentSchema.index({ school: 1, salaryRecordId: 1 });
salaryPaymentSchema.index({ school: 1, status: 1 });
salaryPaymentSchema.index({ school: 1, paidAt: -1 });

module.exports = mongoose.model("SalaryPayment", salaryPaymentSchema);