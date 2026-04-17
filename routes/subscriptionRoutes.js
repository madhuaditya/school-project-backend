const express = require('express');
const { validateUser } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const {
  createSubscription,
  renewSubscription,
  getCurrentSchoolSubscription,
  getSubscriptionBySchool,
} = require('../controllers/subscriptionCtrl');

const router = express.Router();

router.get('/status', validateUser, getCurrentSchoolSubscription);
router.post('/create', validateUser, allow('admin'), createSubscription);
router.put('/renew', validateUser, allow('admin'), renewSubscription);
router.get('/school/:schoolId', validateUser, allow('admin'), getSubscriptionBySchool);

module.exports = router;