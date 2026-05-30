const mongoose = require('mongoose');

const downloadLogSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ['admin', 'teacher'],
      required: true,
      index: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    format: {
      type: String,
      enum: ['csv', 'excel', 'pdf'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'blocked', 'failed'],
      required: true,
      default: 'success',
      index: true,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    fileName: {
      type: String,
      default: '',
      trim: true,
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    recordCount: {
      type: Number,
      default: 0,
    },
    blockReason: {
      type: String,
      default: '',
      trim: true,
    },
    quotaLimit: {
      type: Number,
      default: 10,
    },
    quotaUsedBefore: {
      type: Number,
      default: 0,
    },
    quotaUsedAfter: {
      type: Number,
      default: 0,
    },
    requestedAtKey: {
      type: String,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      default: '',
      trim: true,
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

downloadLogSchema.index({ school: 1, requestedBy: 1, requestedAtKey: 1 });
downloadLogSchema.index({ school: 1, module: 1, createdAt: -1 });
downloadLogSchema.index({ school: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('DownloadLog', downloadLogSchema);