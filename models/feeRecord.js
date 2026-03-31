const mongoose = require("mongoose");

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

    totalFee: { type: Number, required: true, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, required: true, default: 0 },

    status: {
      type: String,
      enum: ["PAID", "PARTIAL", "PENDING"],
      default: "PENDING",
    },

    dueDate: Date,

    discount: {
      type: Number,
      default: 0,
    },

    fine: {
      type: Number,
      default: 0,
    },

    notes: String,

    history: [
      {
        amount: Number,
        lateFee: Number,
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