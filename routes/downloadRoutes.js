const express = require('express');
const { validateUser } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');
const {
  downloadExport,
  getDownloadHistory,
  getDownloadLimits,
  updateDownloadLimits,
} = require('../controllers/downloadCtrl');

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

router.post('/export', allow('admin', 'teacher'), downloadExport);
router.get('/history', allow('admin', 'teacher'), getDownloadHistory);
router.get('/limits', allow('admin', 'teacher'), getDownloadLimits);
router.put('/limits', allow('admin'), updateDownloadLimits);

module.exports = router;