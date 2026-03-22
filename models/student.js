const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    studentId: {
        type: String,
        required: true,
        unique: true
    },
    subjects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
    }],
    class:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        // required: true,
    },
    gradeLevel: {
        type: String,
        required: true,
        enum: ['Kindergarten', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']
    },
    rollNumber: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    dateOfAdmission: {
        type: Date,
        required: true
    },
    fatherName: {
        type: String,
        required: true
    },
    motherName: {
        type: String,
        required: true
    },
    parentContact: {
        type: String,
        required: true
    },
    address: {
        type: String,
        // required: true
    },
    dateOfBirth: {
        type: Date,
        required: true
    },
    gpa: {
        type: Number,
        min: 0,
        max: 4
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'graduated'],
        default: 'active'
    }
},{timestamps: true});

module.exports = mongoose.model('Student', studentSchema);