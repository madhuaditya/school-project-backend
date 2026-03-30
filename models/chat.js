const mongoose = require("mongoose");
const chatSchema = new mongoose.Schema(
  {
    msg :{
        type : String,
        required : true
    },
    user:{
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    school:{
        type : mongoose.Schema.Types.ObjectId,
        ref : "School",
        required : true
    },
    replyCount : {
        type : Number,
        default : 0
    },
    likes : {
        type : Number,
        default : 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);

module.exports = mongoose.model("Chat", chatSchema);