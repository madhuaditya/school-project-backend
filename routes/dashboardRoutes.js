const express = require('express');
const { validateUser } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { getSchoolOverview } = require('../controllers/dashboardCtrl');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');
const router = express.Router();

router.get('/overview', validateUser, checkSubscriptionActive, allow('admin', 'teacher', 'student', 'staff', 'school'), getSchoolOverview);

module.exports = router;
