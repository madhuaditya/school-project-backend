const express = require('express');
const { validateUser } = require('../middleware/auth');
const {
  createNotice,
  updateNotice,
  deleteNotice,
  getValidNoticesForSchool,
} = require('../controllers/noticeCtrl');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');
const router = express.Router();

router.get('/valid', validateUser, checkSubscriptionActive, getValidNoticesForSchool);
router.post('/', validateUser, checkSubscriptionActive, createNotice);
router.put('/:id', validateUser, checkSubscriptionActive, updateNotice);
router.delete('/:id', validateUser, checkSubscriptionActive, deleteNotice);

module.exports = router;
