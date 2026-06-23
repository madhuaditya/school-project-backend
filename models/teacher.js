const mongoose = require("mongoose")


const qualificationSchema = new mongoose.Schema({
  degree: {
    type: String,
    required: [true, 'Degree or certification name is required'],
    trim: true,
    enum: ['B.Ed', 'M.Ed', 'B.Sc', 'M.Sc', 'B.A', 'M.A', 'Ph.D', 'CTET', 'NET', 'Other']
  },
  fieldOfStudy: {
    type: String,
    required: [true, 'Field of study/major is required'], // e.g., Mathematics, Physics
    trim: true
  },
  institution: {
    type: String,
    required: [true, 'Institution name is required'],
    trim: true
  },
  passingYear: {
    type: Number,
    required: [true, 'Passing year is required'],
    min: [1950, 'Year cannot be earlier than 1950'],
    max: [new Date().getFullYear(), 'Passing year cannot be in the future']
  },
  grade: {
    type: String, // Handles both GPA (e.g., "3.8/4.0") and Percentage (e.g., "85%")
    trim: true
  },
  certificateUrl: {
    type: String, // Link to cloud storage (S3/Cloudinary) for verification documents
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false // Set to true after background or admin verification
  }
}, { _id: true });

const teacherSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    principal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    class:{
    type : mongoose.Schema.Types.ObjectId,
    ref: 'Class'
    },
    classTeacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    teachSubjects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
    }],
    teachSclass: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    qualifications: {
        type: [qualificationSchema], 
        default: undefined // Prevents Mongoose from auto-creating an empty [] if you prefer it to be missing/null
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
    }
}, { timestamps: true });

module.exports = mongoose.model("Teacher", teacherSchema)