const mongoose = require('mongoose');
const CalendarEvent = require('../models/calendar');
const { cleanupExpiredCalendarEvents } = require('../services/calendarCleanup');

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const getSchoolIdFromReq = (req) => {
  if (req?.user?.school?._id) return req.user.school._id.toString();
  if (req?.user?.school) return req.user.school.toString();
  return null;
};

const isAdminUser = (req) => req?.user?.role?.role === 'admin';

const normalizeDateToStartOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeDateToEndOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const isEventVisibleToUser = (event, req) => {
  if (isAdminUser(req)) return true;

  const organizerId = event.organizer?._id ? event.organizer._id.toString() : event.organizer?.toString();
  const userId = req.user?._id?.toString();
  if (organizerId && userId && organizerId === userId) return true;

  return event.visibility !== 'private';
};

const ensureSchoolContext = (req, res) => {
  const schoolId = getSchoolIdFromReq(req);
  if (!schoolId) {
    res.status(400).json(formatResponse(false, 'School context not found'));
    return null;
  }
  return schoolId;
};

const buildEventPayload = (req, existingEvent = null) => {
  const {
    title,
    description,
    location,
    startDate,
    endDate,
    timezone,
    allDay,
    color,
    meetingLink,
    visibility,
    status,
    source,
    attendees,
    reminders,
    recurrence,
  } = req.body;

  const payload = {
    ...(title !== undefined && { title: String(title).trim() }),
    ...(description !== undefined && { description: String(description).trim() }),
    ...(location !== undefined && { location: String(location).trim() }),
    ...(startDate !== undefined && { startDate: new Date(startDate) }),
    ...(endDate !== undefined && { endDate: new Date(endDate) }),
    ...(timezone !== undefined && { timezone: String(timezone).trim() }),
    ...(allDay !== undefined && { allDay: Boolean(allDay) }),
    ...(color !== undefined && { color: String(color).trim() }),
    ...(meetingLink !== undefined && { meetingLink: String(meetingLink).trim() }),
    ...(visibility !== undefined && { visibility: String(visibility) }),
    ...(status !== undefined && { status: String(status) }),
    ...(source !== undefined && { source: String(source) }),
    ...(attendees !== undefined && { attendees }),
    ...(reminders !== undefined && { reminders }),
    ...(recurrence !== undefined && { recurrence }),
  };

  if (existingEvent) {
    if (payload.startDate == null) payload.startDate = existingEvent.startDate;
    if (payload.endDate == null) payload.endDate = existingEvent.endDate;
  }

  return payload;
};

const buildCalendarQuery = (req, schoolId) => {
  const { page, size, month, year, weekStart, weekEnd, dateFrom, dateTo, visibility, status, source, organizer, attendeeUserId, q } = req.query;
  const match = {
    school: new mongoose.Types.ObjectId(schoolId),
  };

  const conditions = [];

  if (!isAdminUser(req)) {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    conditions.push({
      $or: [
        { visibility: { $in: ['public', 'team'] } },
        { organizer: userId },
      ],
    });
  }

  if (visibility) {
    if (isAdminUser(req)) {
      conditions.push({ visibility });
    } else if (visibility === 'private') {
      conditions.push({ visibility: 'private', organizer: new mongoose.Types.ObjectId(req.user._id) });
    } else {
      conditions.push({ visibility });
    }
  }

  if (status) {
    conditions.push({ status });
  }

  if (source) {
    conditions.push({ source });
  }

  if (organizer) {
    conditions.push({ organizer: new mongoose.Types.ObjectId(organizer) });
  }

  if (attendeeUserId) {
    conditions.push({ 'attendees.userId': new mongoose.Types.ObjectId(attendeeUserId) });
  }

  if (q) {
    const regex = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    conditions.push({
      $or: [
        { title: regex },
        { description: regex },
        { location: regex },
      ],
    });
  }

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
    conditions.push({ startDate: { $lte: endDate }, endDate: { $gte: startDate } });
  } else if (weekStart && weekEnd) {
    const startDate = normalizeDateToStartOfDay(weekStart);
    const endDate = normalizeDateToEndOfDay(weekEnd);
    conditions.push({ startDate: { $lte: endDate }, endDate: { $gte: startDate } });
  } else if (dateFrom && dateTo) {
    const startDate = normalizeDateToStartOfDay(dateFrom);
    const endDate = normalizeDateToEndOfDay(dateTo);
    conditions.push({ startDate: { $lte: endDate }, endDate: { $gte: startDate } });
  }

  if (conditions.length > 0) {
    match.$and = conditions;
  }

  const parsedPage = Number(page || 1);
  const parsedSize = Number(size || 10);

  return {
    match,
    page: parsedPage,
    size: parsedSize,
  };
};

const createCalendarEvent = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const payload = buildEventPayload(req);
    const parsedStartDate = new Date(payload.startDate);
    const parsedEndDate = new Date(payload.endDate);

    if (parsedStartDate > parsedEndDate) {
      return res.status(400).json(formatResponse(false, 'startDate cannot be greater than endDate'));
    }

    const event = await CalendarEvent.create({
      school: schoolId,
      organizer: req.user._id,
      title: payload.title,
      description: payload.description || '',
      location: payload.location || '',
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      timezone: payload.timezone || 'Asia/Kolkata',
      allDay: payload.allDay || false,
      color: payload.color || '#2563eb',
      meetingLink: payload.meetingLink || '',
      visibility: payload.visibility || 'private',
      status: payload.status || 'confirmed',
      source: payload.source || 'internal',
      attendees: payload.attendees || [],
      reminders: payload.reminders || [],
      recurrence: payload.recurrence || undefined,
    });

    return res.status(201).json(formatResponse(true, 'Calendar event created successfully', event));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error creating calendar event', null, error.message));
  }
};

const getCalendarEvents = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const { match, page, size } = buildCalendarQuery(req, schoolId);
    const skip = (page - 1) * size;

    const [items, totalCount] = await Promise.all([
      CalendarEvent.find(match)
        .populate('organizer', 'name email role')
        .populate('attendees.userId', 'name email role')
        .sort({ startDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(size)
        .lean(),
      CalendarEvent.countDocuments(match),
    ]);

    return res.status(200).json(
      formatResponse(true, 'Calendar events fetched successfully', {
        items,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / size),
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching calendar events', null, error.message));
  }
};

const getCalendarEventById = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const event = await CalendarEvent.findOne({ _id: req.params.id, school: schoolId })
      .populate('organizer', 'name email role')
      .populate('attendees.userId', 'name email role');

    if (!event) {
      return res.status(404).json(formatResponse(false, 'Calendar event not found'));
    }

    if (!isEventVisibleToUser(event, req)) {
      return res.status(403).json(formatResponse(false, 'You do not have access to this calendar event'));
    }

    return res.status(200).json(formatResponse(true, 'Calendar event fetched successfully', event));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching calendar event', null, error.message));
  }
};

const updateCalendarEvent = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const event = await CalendarEvent.findOne({ _id: req.params.id, school: schoolId });
    if (!event) {
      return res.status(404).json(formatResponse(false, 'Calendar event not found'));
    }

    if (!isAdminUser(req) && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only update your own calendar events'));
    }

    const payload = buildEventPayload(req, event);

    if (payload.startDate && payload.endDate && new Date(payload.startDate) > new Date(payload.endDate)) {
      return res.status(400).json(formatResponse(false, 'startDate cannot be greater than endDate'));
    }

    Object.assign(event, payload);
    event.updatedAt = new Date();

    await event.save();
    return res.status(200).json(formatResponse(true, 'Calendar event updated successfully', event));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating calendar event', null, error.message));
  }
};

const deleteCalendarEvent = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const event = await CalendarEvent.findOne({ _id: req.params.id, school: schoolId });
    if (!event) {
      return res.status(404).json(formatResponse(false, 'Calendar event not found'));
    }

    if (!isAdminUser(req) && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only delete your own calendar events'));
    }

    await event.deleteOne();
    return res.status(200).json(formatResponse(true, 'Calendar event deleted successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting calendar event', null, error.message));
  }
};

const updateCalendarAttendees = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const event = await CalendarEvent.findOne({ _id: req.params.id, school: schoolId });
    if (!event) {
      return res.status(404).json(formatResponse(false, 'Calendar event not found'));
    }

    if (!isAdminUser(req) && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only update your own calendar events'));
    }

    event.attendees = req.body.attendees;
    await event.save();
    return res.status(200).json(formatResponse(true, 'Calendar attendees updated successfully', event));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating calendar attendees', null, error.message));
  }
};

const updateCalendarReminders = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const event = await CalendarEvent.findOne({ _id: req.params.id, school: schoolId });
    if (!event) {
      return res.status(404).json(formatResponse(false, 'Calendar event not found'));
    }

    if (!isAdminUser(req) && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only update your own calendar events'));
    }

    event.reminders = req.body.reminders;
    await event.save();
    return res.status(200).json(formatResponse(true, 'Calendar reminders updated successfully', event));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating calendar reminders', null, error.message));
  }
};

const updateCalendarRecurrence = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const event = await CalendarEvent.findOne({ _id: req.params.id, school: schoolId });
    if (!event) {
      return res.status(404).json(formatResponse(false, 'Calendar event not found'));
    }

    if (!isAdminUser(req) && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only update your own calendar events'));
    }

    event.recurrence = req.body.recurrence;
    await event.save();
    return res.status(200).json(formatResponse(true, 'Calendar recurrence updated successfully', event));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating calendar recurrence', null, error.message));
  }
};

const updateCalendarStatus = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const event = await CalendarEvent.findOne({ _id: req.params.id, school: schoolId });
    if (!event) {
      return res.status(404).json(formatResponse(false, 'Calendar event not found'));
    }

    if (!isAdminUser(req) && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only update your own calendar events'));
    }

    event.status = req.body.status;
    await event.save();
    return res.status(200).json(formatResponse(true, 'Calendar event status updated successfully', event));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating calendar status', null, error.message));
  }
};

const updateCalendarVisibility = async (req, res) => {
  try {
    const schoolId = ensureSchoolContext(req, res);
    if (!schoolId) return;

    const event = await CalendarEvent.findOne({ _id: req.params.id, school: schoolId });
    if (!event) {
      return res.status(404).json(formatResponse(false, 'Calendar event not found'));
    }

    if (!isAdminUser(req) && event.organizer.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'You can only update your own calendar events'));
    }

    event.visibility = req.body.visibility;
    await event.save();
    return res.status(200).json(formatResponse(true, 'Calendar event visibility updated successfully', event));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating calendar visibility', null, error.message));
  }
};

const cleanupExpiredEvents = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json(formatResponse(false, 'Only admin can run calendar cleanup'));
    }

    const result = await cleanupExpiredCalendarEvents();
    return res.status(200).json(
      formatResponse(true, 'Expired calendar events cleaned up successfully', {
        cutoffDate: result.cutoffDate,
        deletedCount: result.deletedCount,
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error cleaning up calendar events', null, error.message));
  }
};

module.exports = {
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
};