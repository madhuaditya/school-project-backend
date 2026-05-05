const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  // Exam identifier
  name: {
    type: String,
    required: true, // e.g., "3rd Month Exam", "Mid Term", "Final Term", "Unit Test 1"
    trim: true
  },

  code: {
    type: String, // Optional: e.g., "3M", "MT", "FT"
    trim: true
  },

  description: String,

  // Tight coupling with school, class, subject
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },

  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },

  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },

  // Marks configuration
  totalMarks: {
    type: Number,
    required: true,
    min: 1
  },

  minimumPassingMarks: {
    type: Number,
    required: true,
    min: 0
  },

  // Grading thresholds (optional)
  gradingScale: {
    aPlus: {
      type: Number, // 90% and above
      default: 90
    },
    a: {
      type: Number, // 80-89%
      default: 80
    },
    b: {
      type: Number, // 70-79%
      default: 70
    },
    c: {
      type: Number, // 60-69%
      default: 60
    },
    d: {
      type: Number, // 50-59%
      default: 50
    }
  },

  // Term / sequence information
  term: {
    type: String, // "1", "2", "3", or "Semester 1", "Semester 2"
    enum: ['1', '2', '3', '4', 'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Annual'],
    default: '1'
  },

  sequenceOrder: {
    type: Number, // Order in which exams occur (1, 2, 3...)
    default: 1
  },

  academicYear: {
    type: String, // "2025-26"
    required: true
  },

  // Exam period / duration
  scheduledDate: {
    type: Date // When the exam is scheduled
  },

  duration: {
    type: Number // In minutes, e.g., 180 for 3 hours
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Audit fields
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

// Prevent duplicate exam structure per subject per class
examSchema.index(
  {
    school: 1,
    class: 1,
    subject: 1,
    name: 1,
    academicYear: 1
  },
  { unique: true }
);

// Indexes for quick queries
examSchema.index({ school: 1, class: 1, subject: 1, academicYear: 1 });
examSchema.index({ school: 1, academicYear: 1 });
examSchema.index({ school: 1, class: 1, academicYear: 1 });
examSchema.index({ sequenceOrder: 1, term: 1 });

module.exports = mongoose.model('Exam', examSchema);
