const express = require('express');
const { validateUser } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const {
  createTimeTable,
  updateTimeTable,
  deleteTimeTable,
  getAllTimeTablesForSchool,
  getTimeTableForDay,
  getTimeTableForClass,
} = require('../controllers/timeTableCtrl');

const router = express.Router();

router.use(validateUser);

// Read APIs: all authenticated users in same school
router.get('/', getAllTimeTablesForSchool);
router.get('/day/:day', getTimeTableForDay);
router.get('/class/:classId', getTimeTableForClass);

// Write APIs: admin only
router.post('/', allow('admin'), createTimeTable);
router.put('/:id', allow('admin'), updateTimeTable);
router.delete('/:id', allow('admin'), deleteTimeTable);

module.exports = router;
