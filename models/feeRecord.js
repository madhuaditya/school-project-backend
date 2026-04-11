const mongoose = require("mongoose");

const roundToTwoDecimals = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const feeRecordSchema = new mongoose.Schema(
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

    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    totalFee: { type: Number, required: true, default: 0, set: roundToTwoDecimals },
    paidAmount: { type: Number, default: 0, set: roundToTwoDecimals },
    dueAmount: { type: Number, required: true, default: 0, set: roundToTwoDecimals },

    status: {
      type: String,
      enum: ["PAID", "PARTIAL", "PENDING"],
      default: "PENDING",
    },

    dueDate: Date,

    discount: {
      type: Number,
      default: 0,
      set: roundToTwoDecimals,
    },

    fine: {
      type: Number,
      default: 0,
      set: roundToTwoDecimals,
    },

    notes: String,

    history: [
      {
        amount: { type: Number, set: roundToTwoDecimals },
        lateFee: { type: Number, set: roundToTwoDecimals },
        method: {
          type: String,
          enum: ["UPI", "CARD", "NETBANKING", "CASH"],
        },
        transactionId: String,
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Payment",
        },
        date: { type: Date, default: Date.now },
      },
    ],

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

feeRecordSchema.index({ school: 1, user: 1, month: 1, year: 1 }, { unique: true });
feeRecordSchema.index({ school: 1, class: 1, month: 1, year: 1 });
feeRecordSchema.index({ school: 1, status: 1 });

module.exports = mongoose.model("FeeRecord", feeRecordSchema);