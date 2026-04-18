const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    feeStructureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeStructure",
      required: true,
    },

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    amount: { type: Number, required: true, min: 0 },
    lateFee: { type: Number, default: 0, min: 0 },

    method: {
      type: String,
      enum: ["UPI", "CARD", "NETBANKING", "CASH","BANK"],
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

paymentSchema.index({ school: 1, user: 1, month: 1, year: 1 });
paymentSchema.index({ school: 1, class: 1, month: 1, year: 1 });
paymentSchema.index({ school: 1, feeStructureId: 1 });
paymentSchema.index({ school: 1, status: 1 });
paymentSchema.index({ school: 1, paidAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);