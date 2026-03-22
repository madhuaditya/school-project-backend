const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
     School: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // admin or manager
        required: true,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // admin or manager
    },
    feeType: {
        type: String,
        enum: ['tuition', 'transport', 'uniform', 'lunch', 'library', 'lab', 'sports', 'other'],
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    month   :{
        type: String,
        enum: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        required: true
    },
    year: {
        type: Number,
        required: true,
        min: 2000,
        max: 2100
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'Rupees'
    },
    dueDate: {
        type: Date,
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    term: {
        type: String,
        enum: ['first', 'second', 'third', 'full-year'],
        required: true
    },
    description: String,
    isActive: {
        type: Boolean,
        default: true
    }
},{timestamps: true});

module.exports = mongoose.model('Fee', feeSchema);