const mongoose = require("mongoose")

const noticeSchema = new mongoose.Schema({
     School: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'School',
            required: true,
        },
    title: {
        type: String,
        required: true
    },
    details: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model("Notice", noticeSchema)