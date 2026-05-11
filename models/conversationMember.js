const mongoose = require('mongoose');

const conversationMemberSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    roleInGroup: {
      type: String,
      enum: ['owner', 'member', 'participant'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastReadMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

conversationMemberSchema.index({ conversation: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('ConversationMember', conversationMemberSchema);
