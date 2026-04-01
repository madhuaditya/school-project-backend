const mongoose = require("mongoose");

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

    baseSalary: { type: Number, default: 0 },

    earnings: {
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      da: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
    },

    deductions: {
      pf: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      leaveDeduction: { type: Number, default: 0 },
    },

    totalEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },

    paidAmount: { type: Number, default: 0 },

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