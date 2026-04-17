const mongoose = require("mongoose");

const salaryStructureSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["TEACHER", "ACCOUNTANT", "DRIVER", "ADMIN", "OTHER"],
      required: true,
      uppercase: true,
      trim: true,
    },

    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },

    components: {
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      da: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
    },

    deductions: {
      pf: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

salaryStructureSchema.index({ school: 1, role: 1, createdAt: -1 });

module.exports = mongoose.model("SalaryStructure", salaryStructureSchema);