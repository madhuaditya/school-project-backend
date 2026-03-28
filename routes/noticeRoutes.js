const express = require('express');
const { validateUser } = require('../middleware/auth');
const {
  createNotice,
  updateNotice,
  deleteNotice,
  getValidNoticesForSchool,
} = require('../controllers/noticeCtrl');

const router = express.Router();

router.get('/valid', validateUser, getValidNoticesForSchool);
router.post('/', validateUser, createNotice);
router.put('/:id', validateUser, updateNotice);
router.delete('/:id', validateUser, deleteNotice);

module.exports = router;
