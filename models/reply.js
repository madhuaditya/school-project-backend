const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    msg: {
        type: String,
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    chat: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        required: true,
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "School",
        required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reply", replySchema);