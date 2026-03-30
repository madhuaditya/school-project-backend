// controllers/chatCtrl.js

const Chat = require('../models/chat');
const User = require('../models/user');
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

// ==================== CREATE CHAT ====================
const createChat = async (req, res) => {
  try {
    const { msg } = req.body;
    const { _id: userId, school: school } = req.user;
    const schoolId = school._id;

    // Validate school
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school'));
    }

    // Create new chat
    const newChat = await Chat.create({
      msg,
      user: userId,
      school: schoolId,
      replyCount: 0,
      likes: 0,
    });

    // Populate user info
    const populatedChat = await Chat.findById(newChat._id).populate('user', '_id name image');

    return res.status(201).json(
      formatResponse(true, 'Chat created successfully', populatedChat)
    );
  } catch (error) {
    console.log('Error creating chat: ', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error creating chat', null, error.message));
  }
};

// ==================== DELETE CHAT ====================
const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;
    const { _id: userId } = req.user;

    // Validate chat ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, 'Invalid chat ID'));
    }

    // Find chat
    const chat = await Chat.findById(id);

    if (!chat) {
      return res.status(404).json(formatResponse(false, 'Chat not found'));
    }

    // Verify ownership
    if (chat.user.toString() !== userId.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only delete your own chats'));
    }

    // Hard delete
    await Chat.deleteOne({ _id: id });

    return res.status(200).json(formatResponse(true, 'Chat deleted successfully'));
  } catch (error) {
    console.log('Error deleting chat: ', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error deleting chat', null, error.message));
  }
};

// ==================== GET MY CHATS ====================
const getMyChats = async (req, res) => {
  try {
    const { _id: userId } = req.user;

    // Find all chats created by this user
    const myChats = await Chat.find({ user: userId })
      .populate('user', '_id name image')
      .populate('school', '_id schoolName')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(
      formatResponse(true, 'My chats fetched successfully', myChats)
    );
  } catch (error) {
    console.log('Error fetching my chats: ', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error fetching my chats', null, error.message));
  }
};

// ==================== GET SCHOOL CHATS (PAGINATED) ====================
const getSchoolChats = async (req, res) => {
  try {
    const { _id: userId, school: school } = req.user;
    const schoolId = school._id;
    const { page = 1, size = 10 } = req.query;

    // Validate school
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school'));
    }

    // Calculate skip and limit
    const skip = (page - 1) * size;
    const limit = parseInt(size, 10);

    // Get total count
    const totalCount = await Chat.countDocuments({ school: schoolId });

    // Get paginated chats
    const chats = await Chat.find({ school: schoolId })
      .populate('user', '_id name image')
      .populate('school', '_id schoolName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json(
      formatResponse(true, 'School chats fetched successfully', {
        data: chats,
        totalCount,
        currentPage: page,
        totalPages,
      })
    );
  } catch (error) {
    console.log('Error fetching school chats: ', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error fetching school chats', null, error.message));
  }
};

module.exports = {
  createChat,
  deleteChat,
  getMyChats,
  getSchoolChats,
};
