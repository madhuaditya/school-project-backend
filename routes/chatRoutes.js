// routes/chatRoutes.js

const express = require('express');
const {
  createChat,
  deleteChat,
  getMyChats,
  getSchoolChats,
} = require('../controllers/chatCtrl');
const { validateUser } = require('../middleware/auth');
const { validateChatMessage, validatePagination } = require('../middleware/chatValidate');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');

const r = express.Router();

// Apply authentication to all routes
r.use(validateUser, checkSubscriptionActive);

// Create new chat
r.post('/create', validateChatMessage, createChat);

// Delete chat (only by chat creator)
r.delete('/:id', deleteChat);

// Get my chats
r.get('/my', getMyChats);

// Get school chats (paginated)
r.get('/', validatePagination, getSchoolChats);

module.exports = r;
