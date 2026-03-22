const mongoose = require("mongoose")

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
    }]
}, { timestamps: true });

module.exports = mongoose.model("Teacher", teacherSchema)