const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },

    periodStart: {
      type: Date,
      required: true,
    },

    periodEnd: {
      type: Date,
      required: true,
    },

    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
     School: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Salary', salarySchema);
