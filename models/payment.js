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

    feeRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeRecord",
      required: true,
    },

    amount: { type: Number, required: true, min: 0 },
    lateFee: { type: Number, default: 0, min: 0 },

    method: {
      type: String,
      enum: ["UPI", "CARD", "NETBANKING", "CASH"],
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

paymentSchema.index({ school: 1, user: 1 });
paymentSchema.index({ school: 1, feeRecordId: 1 });
paymentSchema.index({ school: 1, status: 1 });
paymentSchema.index({ school: 1, paidAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);