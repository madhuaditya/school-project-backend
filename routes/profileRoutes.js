const express = require('express');
const { validateUser } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getMe,
  updateProfile,
  uploadProfileImage,
  getBasicProfile,
} = require('../controllers/profileCtrl');

const r = express.Router();

r.get('/me', validateUser, getMe);
r.put('/me', validateUser, updateProfile);
r.put('/update', validateUser, updateProfile);
r.post(
  '/me/avatar',
  validateUser,
  upload.single('image'),
  uploadProfileImage
);
r.get('/:id', validateUser, getBasicProfile);

module.exports = r;
