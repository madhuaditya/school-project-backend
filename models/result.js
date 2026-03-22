const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    examName: {
        type: String,
        required: true
    },
    examDate: {
        type: Date,
        required: true
    },
    subjects: [
        {
            name: String,
            maxMarks: Number,
            obtainedMarks: Number,
            grade: String,
            subjectId : {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Subject'
            }
        }
    ],
    totalMarks: Number,
    percentage: Number,
    status: {
        type: String,
        enum: ['Pass', 'Fail'],
        default: 'Pass'
    },
    remarks: String
},{timestamps: true});

module.exports = mongoose.model('Result', resultSchema);