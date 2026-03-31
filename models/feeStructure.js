const mongoose = require("mongoose");

const feeStructureSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      unique: true,
    },
    components: {
      tuition: { type: Number, default: 0 },
      exam: { type: Number, default: 0 },
      transport: { type: Number, default: 0 },
      hostel: { type: Number, default: 0 },
      activity: { type: Number, default: 0 },
      development: { type: Number, default: 0 },
    },
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
  { timestamps: true },
);

module.exports = mongoose.model("FeeStructure", feeStructureSchema);
