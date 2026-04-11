const mongoose = require("mongoose");

const roundToTwoDecimals = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const feeStructureSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      unique: true,
    },
    components: {
      tuition: { type: Number, default: 0, set: roundToTwoDecimals },
      exam: { type: Number, default: 0, set: roundToTwoDecimals },
      transport: { type: Number, default: 0, set: roundToTwoDecimals },
      hostel: { type: Number, default: 0, set: roundToTwoDecimals },
      activity: { type: Number, default: 0, set: roundToTwoDecimals },
      development: { type: Number, default: 0, set: roundToTwoDecimals },
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
