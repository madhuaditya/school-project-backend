const express = require('express');
const { validateUser } = require('../middleware/auth');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');
const {
  withUpload,
  getMessagingContactsList,
  createOrGetDirectConversation,
  createPrivateGroupConversation,
  listConversations,
  getConversationMessages,
  uploadMessagingAsset,
  createConversationMessage,
  markConversationAsRead,
  getSchoolBroadcastConversation,
} = require('../controllers/messagingCtrl');

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

router.get('/contacts', getMessagingContactsList);
router.post('/conversations/direct', createOrGetDirectConversation);
router.post('/conversations/groups', createPrivateGroupConversation);
router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/messages', createConversationMessage);
router.post('/conversations/:id/read', markConversationAsRead);
router.get('/broadcast', getSchoolBroadcastConversation);
router.post('/uploads', withUpload, uploadMessagingAsset);

module.exports = router;
