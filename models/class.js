const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  grade: {
    type: Number,
    required: true
  },

  section: {
    type: String,
    required: true
  },

  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },

  active: {
    type: Boolean,
    default: true
  },

  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },

  subjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],

  capacity: {
    type: Number,
    default: 100
  },

  room: {
    type: String
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

// UNIQUE constraint per school
classSchema.index({ name: 1, section: 1, school: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);