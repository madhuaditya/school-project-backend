const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
     School: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
    },

    remindAt: {
      type: Date,
      required: true,
    },

    completed: {
      type: Boolean,
      default: false,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reminder', reminderSchema);
