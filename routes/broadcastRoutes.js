const express = require('express');
const {
  previewRecipients,
  createBroadcast,
  getBroadcastHistory,
  getBroadcastById,
  getBroadcastDeliveries,
} = require('../controllers/broadcastCtrl');
const { validateUser } = require('../middleware/auth');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');
const { allow } = require('../middleware/role');

const router = express.Router();

router.use(validateUser, checkSubscriptionActive, allow('admin'));

router.post('/preview-recipients', previewRecipients);
router.post('/send', createBroadcast);
router.get('/history', getBroadcastHistory);
router.get('/:broadcastId/deliveries', getBroadcastDeliveries);
router.get('/:broadcastId', getBroadcastById);

module.exports = router;
