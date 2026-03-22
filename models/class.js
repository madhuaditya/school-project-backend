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
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher'
    },
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }],
    School: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
    },
    capacity: {
        type: Number,
        default: 30
    },
    room: String
},{ timestamps: true });

module.exports = mongoose.model('Class', classSchema);