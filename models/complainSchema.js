const mongoose = require('mongoose');

const complainSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    School: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
    },
    date: {
        type: Date,
        required: true
    },
    complaint: {
        type: String,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
},{ timestamps: true });

module.exports = mongoose.model("Complain", complainSchema);