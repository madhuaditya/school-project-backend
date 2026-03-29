const express = require('express');
const { validateUser } = require('../middleware/auth');
const { createFeedback, getFeedbackList } = require('../controllers/feedbackCtrl');

const router = express.Router();

router.post('/public/contact', createFeedback);
router.post('/public/review', createFeedback);
router.get('/', validateUser, getFeedbackList);

module.exports = router;
