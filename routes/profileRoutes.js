const express = require('express');
const { validateUser } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getMe,
  updateProfile,
  registerPushToken,
  uploadProfileImage,
  getBasicProfile,
  searchSchoolUsers,
} = require('../controllers/profileCtrl');
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const r = express.Router();

r.get('/me', validateUser, checkSubscriptionActive, getMe);
r.put('/me', validateUser, checkSubscriptionActive, updateProfile);
r.put('/update', validateUser, checkSubscriptionActive, updateProfile);
r.put('/push-token', validateUser, checkSubscriptionActive, registerPushToken);
r.post(
  '/me/avatar',
  validateUser,
  checkSubscriptionActive,
  upload.single('image'),
  uploadProfileImage
);
r.get('/search/users', validateUser, checkSubscriptionActive, searchSchoolUsers);
r.get('/:id', validateUser, checkSubscriptionActive, getBasicProfile);

module.exports = r;
