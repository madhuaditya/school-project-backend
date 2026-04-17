const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      unique: true,
      index: true,
    },
    planName: {
      type: String,
      required: true,
      trim: true,
      default: 'Basic',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired', 'trial'],
      default: 'inactive',
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'custom'],
      default: 'monthly',
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    trialEndsAt: {
      type: Date,
      default: null,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    features: {
      type: [String],
      default: [],
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
    lastPaymentAt: {
      type: Date,
      default: null,
    },
    nextBillingAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);


module.exports = mongoose.model('Subscription', subscriptionSchema);