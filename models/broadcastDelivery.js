const mongoose = require('mongoose');

const broadcastDeliverySchema = new mongoose.Schema(
  {
    broadcast: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BroadcastCampaign',
      required: true,
      index: true,
    },
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
    createdFor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['alert', 'email', 'sms', 'whatsapp', 'telegram'],
      required: true,
    },
    destination: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'skipped'],
      required: true,
    },
    provider: {
      type: String,
      trim: true,
      default: '',
    },
    providerMessageId: {
      type: String,
      trim: true,
      default: '',
    },
    errorMessage: {
      type: String,
      trim: true,
      default: '',
    },
    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

broadcastDeliverySchema.index({ broadcast: 1, channel: 1, createdFor: 1 });
broadcastDeliverySchema.index({ school: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('BroadcastDelivery', broadcastDeliverySchema);
