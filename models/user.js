// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    username :{
      type: String,
      trim:true,
      required : true,
      unique: true,
    },

    email: {
      type: String,
      trim: true,
      sparse: true,
    },

    phone: {
      type: String,
      sparse: true,
    },

    smsPhone: {
      type: String,
      trim: true,
      sparse: true,
    },

    whatsappPhone: {
      type: String,
      trim: true,
      sparse: true,
    },

    telegramChatId: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    image: {
      type: String,
    },

    pushTokens: {
      type: [String],
      default: [],
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
     city: {
        type: String,
    },
    state: {
        type: String,
    },
    address: {
        type: String,
    },
    pinCode: {
        type: String,
    },
    country : {
        type: String,
    },

    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
      default: 'Not specified',
    },

    active: {
      type: Boolean,
      default: true,
    },

    refreshToken: {
      type: String,
    },
    resetToken:{
      type: String,
    },
    resetTokenExp: {
      type: Date,
    },
    school: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'School',
          required: true,
    },
  },
  {
    timestamps: true,
  }
);
userSchema.index({ email: 1, phone: 1 });
userSchema.index({ school: 1, active: 1, name: 1, username: 1, phone: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return ;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword =  function (p) {
  // console.log('password ', p);
  // console.log("Comparing password for user ", this.email);
  return  bcrypt.compare(p, this.password);
};

module.exports = mongoose.model('User', userSchema);
