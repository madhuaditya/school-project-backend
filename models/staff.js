const staffSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    staffId: {
        type: String,
        // required: true,
        unique: true
    },
    position: {
        type: String,
        // required: true
    },
    department: {
        type: String,
        // required: true
    },
    hireDate: {
        type: Date,
        // required: true
    },
    salary: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);