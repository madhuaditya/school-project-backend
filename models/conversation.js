const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['direct', 'school_broadcast', 'private_group'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    directKey: {
      type: String,
      trim: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ school: 1, directKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Conversation', conversationSchema);
