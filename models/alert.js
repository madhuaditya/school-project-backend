const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    createdFor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    viewed: {
      type: Boolean,
      default: false,
    },
    viewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for quick lookup of unviewed alerts per user and school
alertSchema.index({ school: 1, createdFor: 1, viewed: 1 });
// Index for looking up alerts created by admin
alertSchema.index({ school: 1, createdBy: 1 });
// Index for sorting by creation time
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Alert", alertSchema);
