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
    class:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        // required: true,
    },
    rollNumber: {
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
    idCardPhoto: {
        type: String,
        trim: true,
    },
    motherName: {
        type: String,
        required: true
    },
    parentContact: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'graduated'],
        default: 'active'
    },
    transportation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transportation',
    },
},{timestamps: true});

module.exports = mongoose.model('Student', studentSchema);