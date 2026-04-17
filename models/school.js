const mongoose = require('mongoose');

// const {bycrypt} = require('bycrypt'); // 🔒 For password hashing
const bcrypt = require('bcrypt');

const schoolSchema = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    schoolName: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    pinCode: {
        type: String,
        required: true
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
    },
    refreshToken: {
      type: String,
    },
    resetToken:{
      type: String,
    },
    resetTokenExp: {
      type: Date,
    }

}, { timestamps: true });

schoolSchema.pre('save', async function () {
  if (!this.isModified('password')) return ;
  this.password = await bcrypt.hash(this.password, 10);
});

schoolSchema.methods.comparePassword = function (p) {
  return bcrypt.compare(p, this.password);
};

module.exports = mongoose.model('School', schoolSchema);