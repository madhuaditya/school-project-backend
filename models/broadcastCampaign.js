const mongoose = require('mongoose');

const broadcastCampaignSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    channels: [
      {
        type: String,
        enum: ['alert', 'email', 'sms', 'whatsapp', 'telegram'],
        required: true,
      },
    ],
    audience: {
      userIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      roleNames: [
        {
          type: String,
          trim: true,
        },
      ],
      classIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Class',
        },
      ],
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    deliverySummary: {
      total: {
        type: Number,
        default: 0,
      },
      sent: {
        type: Number,
        default: 0,
      },
      failed: {
        type: Number,
        default: 0,
      },
      skipped: {
        type: Number,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'completed_with_failures', 'failed'],
      default: 'processing',
    },
  },
  { timestamps: true }
);

broadcastCampaignSchema.index({ school: 1, createdAt: -1 });
broadcastCampaignSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('BroadcastCampaign', broadcastCampaignSchema);
