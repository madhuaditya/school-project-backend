const TimeTable = require('../models/timeTable');
const Class = require('../models/class');
const Subject = require('../models/subject');

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

const isValidDay = (day) => VALID_DAYS.includes(day);

const sanitizePeriods = (periods = []) => {
  return periods.map((period, index) => ({
    subject: period.subject,
    startTime: period.startTime,
    endTime: period.endTime,
    hour: period.hour || index + 1,
  }));
};

const validatePeriodsPayload = (periods) => {
  if (!Array.isArray(periods) || periods.length === 0) return 'periods array is required';

  for (const period of periods) {
    if (!period.subject || !period.startTime || !period.endTime) {
      return 'Each period must have subject, startTime and endTime';
    }
  }

  return null;
};

const validateSchoolClass = async (classId, schoolId) => {
  const cls = await Class.findOne({ _id: classId, school: schoolId }).select('_id school');
  return cls;
};

const validateSubjectsForClass = async (periods, schoolId, classId) => {
  const subjectIds = periods.map((period) => period.subject);
  const count = await Subject.countDocuments({
    _id: { $in: subjectIds },
    school: schoolId,
    class: classId,
  });

  return count === subjectIds.length;
};

const createTimeTable = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json(formatResponse(false, 'Only admin can create timetable'));
    }

    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const { name, classId, day, periods } = req.body;

    if (!name || !classId || !day) {
      return res.status(400).json(formatResponse(false, 'name, classId and day are required'));
    }

    if (!isValidDay(day)) {
      return res.status(400).json(formatResponse(false, 'Invalid day value'));
    }

    const periodsError = validatePeriodsPayload(periods);
    if (periodsError) {
      return res.status(400).json(formatResponse(false, periodsError));
    }

    const cls = await validateSchoolClass(classId, schoolId);
    if (!cls) {
      return res.status(404).json(formatResponse(false, 'Class not found in your school'));
    }

    const isValidSubjects = await validateSubjectsForClass(periods, schoolId, classId);
    if (!isValidSubjects) {
      return res.status(400).json(formatResponse(false, 'One or more subjects are invalid for this class and school'));
    }

    const existing = await TimeTable.findOne({ school: schoolId, class: classId, day });
    if (existing) {
      return res.status(400).json(formatResponse(false, 'Timetable already exists for this class and day'));
    }

    const timetable = await TimeTable.create({
      name,
      school: schoolId,
      class: classId,
      day,
      periods: sanitizePeriods(periods),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    return res.status(201).json(formatResponse(true, 'Timetable created successfully', timetable));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error creating timetable', null, error.message));
  }
};

const updateTimeTable = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json(formatResponse(false, 'Only admin can update timetable'));
    }

    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const timetable = await TimeTable.findOne({ _id: req.params.id, school: schoolId });
    if (!timetable) {
      return res.status(404).json(formatResponse(false, 'Timetable not found'));
    }

    const { name, classId, day, periods } = req.body;
    const effectiveClassId = classId || timetable.class.toString();
    const effectiveDay = day || timetable.day;

    if (day !== undefined && !isValidDay(day)) {
      return res.status(400).json(formatResponse(false, 'Invalid day value'));
    }

    if (classId !== undefined) {
      const cls = await validateSchoolClass(classId, schoolId);
      if (!cls) {
        return res.status(404).json(formatResponse(false, 'Class not found in your school'));
      }
    }

    if (periods !== undefined) {
      const periodsError = validatePeriodsPayload(periods);
      if (periodsError) {
        return res.status(400).json(formatResponse(false, periodsError));
      }

      const isValidSubjects = await validateSubjectsForClass(periods, schoolId, effectiveClassId);
      if (!isValidSubjects) {
        return res.status(400).json(formatResponse(false, 'One or more subjects are invalid for this class and school'));
      }
    }

    if (classId !== undefined || day !== undefined) {
      const duplicate = await TimeTable.findOne({
        _id: { $ne: req.params.id },
        school: schoolId,
        class: effectiveClassId,
        day: effectiveDay,
      });

      if (duplicate) {
        return res.status(400).json(formatResponse(false, 'Timetable already exists for this class and day'));
      }
    }

    if (name !== undefined) timetable.name = name;
    if (classId !== undefined) timetable.class = classId;
    if (day !== undefined) timetable.day = day;
    if (periods !== undefined) timetable.periods = sanitizePeriods(periods);
    timetable.updatedBy = req.user._id;

    await timetable.save();
    return res.status(200).json(formatResponse(true, 'Timetable updated successfully', timetable));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating timetable', null, error.message));
  }
};

const deleteTimeTable = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json(formatResponse(false, 'Only admin can delete timetable'));
    }

    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const timetable = await TimeTable.findOne({ _id: req.params.id, school: schoolId });
    if (!timetable) {
      return res.status(404).json(formatResponse(false, 'Timetable not found'));
    }

    await timetable.deleteOne();
    return res.status(200).json(formatResponse(true, 'Timetable deleted successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting timetable', null, error.message));
  }
};

const getAllTimeTablesForSchool = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const timetables = await TimeTable.find({ school: schoolId })
      .populate('class', 'name grade section')
      .populate('periods.subject', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(formatResponse(true, 'Timetables fetched successfully', timetables));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching timetables', null, error.message));
  }
};

const getTimeTableForDay = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const { day } = req.params;
    const { classId } = req.query;

    if (!isValidDay(day)) {
      return res.status(400).json(formatResponse(false, 'Invalid day value'));
    }

    const query = { school: schoolId, day };
    if (classId) query.class = classId;

    const timetables = await TimeTable.find(query)
      .populate('class', 'name grade section')
      .populate('periods.subject', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(formatResponse(true, 'Day timetable fetched successfully', timetables));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching day timetable', null, error.message));
  }
};

const getTimeTableForClass = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const { classId } = req.params;

    const cls = await validateSchoolClass(classId, schoolId);
    if (!cls) {
      return res.status(404).json(formatResponse(false, 'Class not found in your school'));
    }

    const timetables = await TimeTable.find({ school: schoolId, class: classId })
      .populate('class', 'name grade section')
      .populate('periods.subject', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(formatResponse(true, 'Class timetable fetched successfully', timetables));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching class timetable', null, error.message));
  }
};

module.exports = {
  createTimeTable,
  updateTimeTable,
  deleteTimeTable,
  getAllTimeTablesForSchool,
  getTimeTableForDay,
  getTimeTableForClass,
};
