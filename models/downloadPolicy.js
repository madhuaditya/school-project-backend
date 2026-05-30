const mongoose = require('mongoose');

const downloadPolicySchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      unique: true,
      index: true,
    },
    dailyLimit: {
      type: Number,
      default: 10,
      min: 1,
      max: 1000,
    },
    enabledRoles: {
      type: [String],
      default: ['admin', 'teacher'],
      enum: ['admin', 'teacher'],
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DownloadPolicy', downloadPolicySchema);