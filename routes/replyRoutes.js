// routes/replyRoutes.js

const express = require('express');
const {
  createReply,
  deleteReply,
  getMyReplies,
  getRepliesByChat,
} = require('../controllers/replyCtrl');
const { validateUser } = require('../middleware/auth');
const { validateReplyMessage, validatePagination } = require('../middleware/chatValidate');

const r = express.Router();

// Apply authentication to all routes
r.use(validateUser);

// Create new reply
r.post('/create', validateReplyMessage, createReply);

// Delete reply (only by reply creator)
r.delete('/:id', deleteReply);

// Get my replies
r.get('/my', getMyReplies);

// Get replies by chat ID (paginated)
r.get('/chat/:chatId', validatePagination, getRepliesByChat);

module.exports = r;
