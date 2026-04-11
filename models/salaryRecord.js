const mongoose = require("mongoose");

const roundToTwoDecimals = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const salaryRecordSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    baseSalary: { type: Number, default: 0, set: roundToTwoDecimals },

    earnings: {
      basic: { type: Number, default: 0, set: roundToTwoDecimals },
      hra: { type: Number, default: 0, set: roundToTwoDecimals },
      da: { type: Number, default: 0, set: roundToTwoDecimals },
      bonus: { type: Number, default: 0, set: roundToTwoDecimals },
    },

    deductions: {
      pf: { type: Number, default: 0, set: roundToTwoDecimals },
      tax: { type: Number, default: 0, set: roundToTwoDecimals },
      other: { type: Number, default: 0, set: roundToTwoDecimals },
      leaveDeduction: { type: Number, default: 0, set: roundToTwoDecimals },
    },

    totalEarnings: { type: Number, default: 0, set: roundToTwoDecimals },
    totalDeductions: { type: Number, default: 0, set: roundToTwoDecimals },
    netSalary: { type: Number, default: 0, set: roundToTwoDecimals },

    paidAmount: { type: Number, default: 0, set: roundToTwoDecimals },

    status: {
      type: String,
      enum: ["PAID", "PARTIAL", "UNPAID"],
      default: "UNPAID",
    },

    paymentDate: Date,

    remarks: String,

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

salaryRecordSchema.index({ school: 1, staffId: 1, month: 1, year: 1 }, { unique: true });
salaryRecordSchema.index({ school: 1, month: 1, year: 1 });
salaryRecordSchema.index({ school: 1, status: 1 });

module.exports = mongoose.model("SalaryRecord", salaryRecordSchema);