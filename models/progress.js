const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },

  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },

  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },

  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },

  type: {
    type: String,
    enum: ['exam', 'test', 'assignment'],
    required: true
  },

  title: { // e.g. Unit Test 1, Mid Term
    type: String,
    required: true
  },

  marksObtained: {
    type: Number,
    required: true
  },

  totalMarks: {
    type: Number,
    required: true
  },

  percentage: Number,

  grade: {
    type: String,
    enum: ['A+', 'A', 'B', 'C', 'D', 'Fail'],
  },

  remarks: String,

  date: {
    type: Date,
    default: Date.now
  },

  academicYear: {
    type: String, // "2025-26"
    required: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }

}, { timestamps: true });

// prevent duplicate entry
progressSchema.index({
  student: 1,
  subject: 1,
  type: 1,
  title: 1,
  academicYear: 1
}, { unique: true });

progressSchema.index({ student: 1, academicYear: 1, date: -1 });
progressSchema.index({ class: 1, academicYear: 1 });

module.exports = mongoose.model('Progress', progressSchema);