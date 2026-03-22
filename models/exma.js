const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    duration: {
        type: Number,
        required: true,
        description: 'Duration in minutes',
    },
    totalMarks: {
        type: Number,
        required: true,
    },
    passingMarks: {
        type: Number,
        required: true,
    },
     School: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
    class: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
    }]
},{timestamps: true});

module.exports = mongoose.model('Exam', examSchema);