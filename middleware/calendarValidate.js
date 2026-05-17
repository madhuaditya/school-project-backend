const mongoose = require('mongoose');

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const VISIBILITY_VALUES = ['private', 'public', 'team'];
const STATUS_VALUES = ['confirmed', 'cancelled', 'draft'];
const SOURCE_VALUES = ['internal', 'google', 'outlook', 'apple'];
const ATTENDEE_STATUS_VALUES = ['pending', 'accepted', 'declined', 'tentative'];
const REMINDER_TYPE_VALUES = ['email', 'notification', 'sms'];
const RECURRENCE_FREQUENCY_VALUES = ['daily', 'weekly', 'monthly', 'yearly'];

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const parseMaybeInteger = (value) => {
  if (value == null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const validateAttendees = (attendees) => {
  if (!Array.isArray(attendees)) {
    return 'attendees must be an array';
  }

  for (const attendee of attendees) {
    if (!attendee || typeof attendee !== 'object') {
      return 'Each attendee must be an object';
    }

    if (attendee.userId != null && !isObjectId(attendee.userId)) {
      return 'Invalid attendee userId';
    }

    if (attendee.name != null && typeof attendee.name !== 'string') {
      return 'attendee name must be a string';
    }

    if (attendee.email != null && typeof attendee.email !== 'string') {
      return 'attendee email must be a string';
    }

    if (attendee.status != null && !ATTENDEE_STATUS_VALUES.includes(String(attendee.status))) {
      return `attendee status must be one of: ${ATTENDEE_STATUS_VALUES.join(', ')}`;
    }
  }

  return null;
};

const validateReminders = (reminders) => {
  if (!Array.isArray(reminders)) {
    return 'reminders must be an array';
  }

  for (const reminder of reminders) {
    if (!reminder || typeof reminder !== 'object') {
      return 'Each reminder must be an object';
    }

    if (reminder.type != null && !REMINDER_TYPE_VALUES.includes(String(reminder.type))) {
      return `reminder type must be one of: ${REMINDER_TYPE_VALUES.join(', ')}`;
    }

    if (reminder.minutesBefore != null) {
      const minutesBefore = Number(reminder.minutesBefore);
      if (!Number.isFinite(minutesBefore) || minutesBefore < 0 || minutesBefore > 10080) {
        return 'reminder minutesBefore must be a number between 0 and 10080';
      }
    }
  }

  return null;
};

const validateRecurrence = (recurrence) => {
  if (recurrence == null) {
    return null;
  }

  if (typeof recurrence !== 'object' || Array.isArray(recurrence)) {
    return 'recurrence must be an object';
  }

  if (recurrence.frequency != null && !RECURRENCE_FREQUENCY_VALUES.includes(String(recurrence.frequency))) {
    return `recurrence frequency must be one of: ${RECURRENCE_FREQUENCY_VALUES.join(', ')}`;
  }

  if (recurrence.interval != null) {
    const interval = Number(recurrence.interval);
    if (!Number.isFinite(interval) || interval < 1 || interval > 365) {
      return 'recurrence interval must be between 1 and 365';
    }
  }

  if (recurrence.endDate != null && !isValidDate(recurrence.endDate)) {
    return 'recurrence endDate must be a valid date';
  }

  if (recurrence.daysOfWeek != null) {
    if (!Array.isArray(recurrence.daysOfWeek)) {
      return 'recurrence daysOfWeek must be an array';
    }

    for (const day of recurrence.daysOfWeek) {
      const normalizedDay = Number(day);
      if (!Number.isInteger(normalizedDay) || normalizedDay < 0 || normalizedDay > 6) {
        return 'recurrence daysOfWeek values must be integers from 0 to 6';
      }
    }
  }

  return null;
};

const validateCalendarListQuery = (req, res, next) => {
  try {
    let { page = 1, size = 10, month, year, weekStart, weekEnd, dateFrom, dateTo, visibility, status, source, organizer, attendeeUserId, q } = req.query;

    page = parseMaybeInteger(page);
    size = parseMaybeInteger(size);

    if (!page || page < 1) {
      return res.status(400).json(formatResponse(false, 'page must be a positive integer'));
    }

    if (!size || size < 1 || size > 100) {
      return res.status(400).json(formatResponse(false, 'size must be between 1 and 100'));
    }

    const hasMonthYear = month != null || year != null;
    if (hasMonthYear && (month == null || year == null)) {
      return res.status(400).json(formatResponse(false, 'month and year must be provided together'));
    }

    const hasWeekRange = weekStart != null || weekEnd != null;
    if (hasWeekRange && (weekStart == null || weekEnd == null)) {
      return res.status(400).json(formatResponse(false, 'weekStart and weekEnd must be provided together'));
    }

    const hasDateRange = dateFrom != null || dateTo != null;
    if (hasDateRange && (dateFrom == null || dateTo == null)) {
      return res.status(400).json(formatResponse(false, 'dateFrom and dateTo must be provided together'));
    }

    if (hasMonthYear) {
      const normalizedMonth = parseMaybeInteger(month);
      const normalizedYear = parseMaybeInteger(year);

      if (!normalizedMonth || normalizedMonth < 1 || normalizedMonth > 12) {
        return res.status(400).json(formatResponse(false, 'month must be between 1 and 12'));
      }

      if (!normalizedYear || normalizedYear < 2000 || normalizedYear > 3000) {
        return res.status(400).json(formatResponse(false, 'year must be a valid 4-digit number'));
      }

      req.query.month = normalizedMonth;
      req.query.year = normalizedYear;
    }

    if (hasWeekRange) {
      if (!isValidDate(weekStart) || !isValidDate(weekEnd)) {
        return res.status(400).json(formatResponse(false, 'weekStart and weekEnd must be valid dates'));
      }
    }

    if (hasDateRange) {
      if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
        return res.status(400).json(formatResponse(false, 'dateFrom and dateTo must be valid dates'));
      }
    }

    if (visibility != null && !VISIBILITY_VALUES.includes(String(visibility))) {
      return res.status(400).json(formatResponse(false, `visibility must be one of: ${VISIBILITY_VALUES.join(', ')}`));
    }

    if (status != null && !STATUS_VALUES.includes(String(status))) {
      return res.status(400).json(formatResponse(false, `status must be one of: ${STATUS_VALUES.join(', ')}`));
    }

    if (source != null && !SOURCE_VALUES.includes(String(source))) {
      return res.status(400).json(formatResponse(false, `source must be one of: ${SOURCE_VALUES.join(', ')}`));
    }

    if (organizer != null && !isObjectId(organizer)) {
      return res.status(400).json(formatResponse(false, 'organizer must be a valid ObjectId'));
    }

    if (attendeeUserId != null && !isObjectId(attendeeUserId)) {
      return res.status(400).json(formatResponse(false, 'attendeeUserId must be a valid ObjectId'));
    }

    if (q != null && typeof q !== 'string') {
      return res.status(400).json(formatResponse(false, 'q must be a string'));
    }

    if (q != null && String(q).trim().length > 200) {
      return res.status(400).json(formatResponse(false, 'q cannot exceed 200 characters'));
    }

    req.query.page = page;
    req.query.size = size;
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar list query', null, error.message));
  }
};

const validateCalendarIdParam = (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !isObjectId(id)) {
      return res.status(400).json(formatResponse(false, 'Invalid calendar event id'));
    }
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar event id', null, error.message));
  }
};

const validateCalendarCreate = (req, res, next) => {
  try {
    const { title, startDate, endDate, description, location, timezone, allDay, color, meetingLink, visibility, status, source, attendees, reminders, recurrence } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json(formatResponse(false, 'title, startDate and endDate are required'));
    }

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json(formatResponse(false, 'title must be a non-empty string'));
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json(formatResponse(false, 'startDate and endDate must be valid dates'));
    }

    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      return res.status(400).json(formatResponse(false, 'startDate cannot be greater than endDate'));
    }

    if (description != null && typeof description !== 'string') {
      return res.status(400).json(formatResponse(false, 'description must be a string'));
    }

    if (location != null && typeof location !== 'string') {
      return res.status(400).json(formatResponse(false, 'location must be a string'));
    }

    if (timezone != null && typeof timezone !== 'string') {
      return res.status(400).json(formatResponse(false, 'timezone must be a string'));
    }

    if (allDay != null && typeof allDay !== 'boolean') {
      return res.status(400).json(formatResponse(false, 'allDay must be a boolean'));
    }

    if (color != null && typeof color !== 'string') {
      return res.status(400).json(formatResponse(false, 'color must be a string'));
    }

    if (meetingLink != null && typeof meetingLink !== 'string') {
      return res.status(400).json(formatResponse(false, 'meetingLink must be a string'));
    }

    if (visibility != null && !VISIBILITY_VALUES.includes(String(visibility))) {
      return res.status(400).json(formatResponse(false, `visibility must be one of: ${VISIBILITY_VALUES.join(', ')}`));
    }

    if (status != null && !STATUS_VALUES.includes(String(status))) {
      return res.status(400).json(formatResponse(false, `status must be one of: ${STATUS_VALUES.join(', ')}`));
    }

    if (source != null && !SOURCE_VALUES.includes(String(source))) {
      return res.status(400).json(formatResponse(false, `source must be one of: ${SOURCE_VALUES.join(', ')}`));
    }

    if (attendees != null) {
      const attendeesError = validateAttendees(attendees);
      if (attendeesError) {
        return res.status(400).json(formatResponse(false, attendeesError));
      }
    }

    if (reminders != null) {
      const remindersError = validateReminders(reminders);
      if (remindersError) {
        return res.status(400).json(formatResponse(false, remindersError));
      }
    }

    if (recurrence != null) {
      const recurrenceError = validateRecurrence(recurrence);
      if (recurrenceError) {
        return res.status(400).json(formatResponse(false, recurrenceError));
      }
    }

    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar create request', null, error.message));
  }
};

const validateCalendarUpdate = (req, res, next) => {
  try {
    const { title, startDate, endDate, description, location, timezone, allDay, color, meetingLink, visibility, status, source, attendees, reminders, recurrence } = req.body;

    if (title != null && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json(formatResponse(false, 'title must be a non-empty string'));
    }

    if (startDate != null && !isValidDate(startDate)) {
      return res.status(400).json(formatResponse(false, 'startDate must be a valid date'));
    }

    if (endDate != null && !isValidDate(endDate)) {
      return res.status(400).json(formatResponse(false, 'endDate must be a valid date'));
    }

    if (startDate != null && endDate != null && new Date(startDate).getTime() > new Date(endDate).getTime()) {
      return res.status(400).json(formatResponse(false, 'startDate cannot be greater than endDate'));
    }

    if (description != null && typeof description !== 'string') {
      return res.status(400).json(formatResponse(false, 'description must be a string'));
    }

    if (location != null && typeof location !== 'string') {
      return res.status(400).json(formatResponse(false, 'location must be a string'));
    }

    if (timezone != null && typeof timezone !== 'string') {
      return res.status(400).json(formatResponse(false, 'timezone must be a string'));
    }

    if (allDay != null && typeof allDay !== 'boolean') {
      return res.status(400).json(formatResponse(false, 'allDay must be a boolean'));
    }

    if (color != null && typeof color !== 'string') {
      return res.status(400).json(formatResponse(false, 'color must be a string'));
    }

    if (meetingLink != null && typeof meetingLink !== 'string') {
      return res.status(400).json(formatResponse(false, 'meetingLink must be a string'));
    }

    if (visibility != null && !VISIBILITY_VALUES.includes(String(visibility))) {
      return res.status(400).json(formatResponse(false, `visibility must be one of: ${VISIBILITY_VALUES.join(', ')}`));
    }

    if (status != null && !STATUS_VALUES.includes(String(status))) {
      return res.status(400).json(formatResponse(false, `status must be one of: ${STATUS_VALUES.join(', ')}`));
    }

    if (source != null && !SOURCE_VALUES.includes(String(source))) {
      return res.status(400).json(formatResponse(false, `source must be one of: ${SOURCE_VALUES.join(', ')}`));
    }

    if (attendees != null) {
      const attendeesError = validateAttendees(attendees);
      if (attendeesError) {
        return res.status(400).json(formatResponse(false, attendeesError));
      }
    }

    if (reminders != null) {
      const remindersError = validateReminders(reminders);
      if (remindersError) {
        return res.status(400).json(formatResponse(false, remindersError));
      }
    }

    if (recurrence != null) {
      const recurrenceError = validateRecurrence(recurrence);
      if (recurrenceError) {
        return res.status(400).json(formatResponse(false, recurrenceError));
      }
    }

    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar update request', null, error.message));
  }
};

const validateCalendarAttendees = (req, res, next) => {
  try {
    const { attendees } = req.body;
    const attendeesError = validateAttendees(attendees);
    if (attendeesError) {
      return res.status(400).json(formatResponse(false, attendeesError));
    }
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar attendees request', null, error.message));
  }
};

const validateCalendarReminders = (req, res, next) => {
  try {
    const { reminders } = req.body;
    const remindersError = validateReminders(reminders);
    if (remindersError) {
      return res.status(400).json(formatResponse(false, remindersError));
    }
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar reminders request', null, error.message));
  }
};

const validateCalendarRecurrence = (req, res, next) => {
  try {
    const { recurrence } = req.body;
    const recurrenceError = validateRecurrence(recurrence);
    if (recurrenceError) {
      return res.status(400).json(formatResponse(false, recurrenceError));
    }
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar recurrence request', null, error.message));
  }
};

const validateCalendarStatus = (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !STATUS_VALUES.includes(String(status))) {
      return res.status(400).json(formatResponse(false, `status must be one of: ${STATUS_VALUES.join(', ')}`));
    }
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar status request', null, error.message));
  }
};

const validateCalendarVisibility = (req, res, next) => {
  try {
    const { visibility } = req.body;
    if (!visibility || !VISIBILITY_VALUES.includes(String(visibility))) {
      return res.status(400).json(formatResponse(false, `visibility must be one of: ${VISIBILITY_VALUES.join(', ')}`));
    }
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating calendar visibility request', null, error.message));
  }
};

module.exports = {
  validateCalendarListQuery,
  validateCalendarIdParam,
  validateCalendarCreate,
  validateCalendarUpdate,
  validateCalendarAttendees,
  validateCalendarReminders,
  validateCalendarRecurrence,
  validateCalendarStatus,
  validateCalendarVisibility,
  VISIBILITY_VALUES,
  STATUS_VALUES,
  SOURCE_VALUES,
  ATTENDEE_STATUS_VALUES,
  REMINDER_TYPE_VALUES,
  RECURRENCE_FREQUENCY_VALUES,
};