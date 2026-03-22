const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
    subName: {
        type: String,
        required: true,
    },
    subCode: {
        type: String,
        required: true,
    },
    sessions: {
        type: String,
        required: true,
    },
    sclassName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
    },
     School: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
}, { timestamps: true });

module.exports = mongoose.model("Subject", subjectSchema);