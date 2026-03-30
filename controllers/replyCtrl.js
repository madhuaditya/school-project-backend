// controllers/replyCtrl.js

const Reply = require('../models/reply');
const Chat = require('../models/chat');
const mongoose = require('mongoose');

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// ==================== CREATE REPLY ====================
const createReply = async (req, res) => {
  try {
    const { msg, chatId } = req.body;
    const { _id: userId, school: school } = req.user;
    const schoolId = school._id;

    // Validate chat ID
    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json(formatResponse(false, 'Invalid chat ID'));
    }

    // Validate school
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school'));
    }

    // Check if chat exists and belongs to same school
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json(formatResponse(false, 'Chat not found'));
    }

    if (chat.school.toString() !== schoolId.toString()) {
      return res.status(403).json(formatResponse(false, 'Chat does not belong to your school'));
    }

    // Create new reply
    const newReply = await Reply.create({
      msg,
      user: userId,
      chat: chatId,
      school: schoolId,
    });

    // Increment reply count in chat
    await Chat.findByIdAndUpdate(chatId, { $inc: { replyCount: 1 } });

    // Populate user info
    const populatedReply = await Reply.findById(newReply._id).populate('user', '_id name image');

    return res.status(201).json(
      formatResponse(true, 'Reply created successfully', populatedReply)
    );
  } catch (error) {
    console.log('Error creating reply: ', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error creating reply', null, error.message));
  }
};

// ==================== DELETE REPLY ====================
const deleteReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId } = req.user;

    // Validate reply ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, 'Invalid reply ID'));
    }

    // Find reply
    const reply = await Reply.findById(id);

    if (!reply) {
      return res.status(404).json(formatResponse(false, 'Reply not found'));
    }

    // Verify ownership
    if (reply.user.toString() !== userId.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only delete your own replies'));
    }

    // Decrement reply count in chat
    await Chat.findByIdAndUpdate(reply.chat, { $inc: { replyCount: -1 } });

    // Hard delete
    await Reply.deleteOne({ _id: id });

    return res.status(200).json(formatResponse(true, 'Reply deleted successfully'));
  } catch (error) {
    console.log('Error deleting reply: ', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error deleting reply', null, error.message));
  }
};

// ==================== GET MY REPLIES ====================
const getMyReplies = async (req, res) => {
  try {
    const { _id: userId } = req.user;

    // Find all replies created by this user
    const myReplies = await Reply.find({ user: userId })
      .populate('user', '_id name image')
      .populate('chat', '_id msg')
      .populate('school', '_id schoolName')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(
      formatResponse(true, 'My replies fetched successfully', myReplies)
    );
  } catch (error) {
    console.log('Error fetching my replies: ', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error fetching my replies', null, error.message));
  }
};

// ==================== GET REPLIES BY CHAT (PAGINATED) ====================
const getRepliesByChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { _id: userId, school: school } = req.user;
    const schoolId = school._id;
    const { page = 1, size = 10 } = req.query;

    // Validate chat ID
    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json(formatResponse(false, 'Invalid chat ID'));
    }

    // Validate school
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school'));
    }

    // Check if chat exists and belongs to same school
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json(formatResponse(false, 'Chat not found'));
    }

    if (chat.school.toString() !== schoolId.toString()) {
      return res.status(403).json(formatResponse(false, 'Chat does not belong to your school'));
    }

    // Calculate skip and limit
    const skip = (page - 1) * size;
    const limit = parseInt(size, 10);

    // Get total count
    const totalCount = await Reply.countDocuments({ chat: chatId });

    // Get paginated replies
    const replies = await Reply.find({ chat: chatId })
      .populate('user', '_id name image')
      .populate('chat', '_id msg')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json(
      formatResponse(true, 'Chat replies fetched successfully', {
        data: replies,
        totalCount,
        currentPage: page,
        totalPages,
      })
    );
  } catch (error) {
    console.log('Error fetching chat replies: ', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error fetching chat replies', null, error.message));
  }
};

module.exports = {
  createReply,
  deleteReply,
  getMyReplies,
  getRepliesByChat,
};
