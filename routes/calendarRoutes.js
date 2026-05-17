const express = require('express');
const { validateUser } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');
const {
  createCalendarEvent,
  getCalendarEvents,
  getCalendarEventById,
  updateCalendarEvent,
  deleteCalendarEvent,
  updateCalendarAttendees,
  updateCalendarReminders,
  updateCalendarRecurrence,
  updateCalendarStatus,
  updateCalendarVisibility,
  cleanupExpiredEvents,
} = require('../controllers/calendarCtrl');
const {
  validateCalendarListQuery,
  validateCalendarIdParam,
  validateCalendarCreate,
  validateCalendarUpdate,
  validateCalendarAttendees,
  validateCalendarReminders,
  validateCalendarRecurrence,
  validateCalendarStatus,
  validateCalendarVisibility,
} = require('../middleware/calendarValidate');

const router = express.Router();

router.use(validateUser, checkSubscriptionActive, allow('admin', 'teacher', 'staff'));

router.get('/', validateCalendarListQuery, getCalendarEvents);
router.get('/:id', validateCalendarIdParam, getCalendarEventById);
router.post('/', validateCalendarCreate, createCalendarEvent);
router.put('/:id', validateCalendarIdParam, validateCalendarUpdate, updateCalendarEvent);
router.delete('/:id', validateCalendarIdParam, deleteCalendarEvent);
router.patch('/:id/attendees', validateCalendarIdParam, validateCalendarAttendees, updateCalendarAttendees);
router.patch('/:id/reminders', validateCalendarIdParam, validateCalendarReminders, updateCalendarReminders);
router.patch('/:id/recurrence', validateCalendarIdParam, validateCalendarRecurrence, updateCalendarRecurrence);
router.patch('/:id/status', validateCalendarIdParam, validateCalendarStatus, updateCalendarStatus);
router.patch('/:id/visibility', validateCalendarIdParam, validateCalendarVisibility, updateCalendarVisibility);
router.post('/cleanup/expired', allow('admin'), cleanupExpiredEvents);

module.exports = router;