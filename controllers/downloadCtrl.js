const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const School = require('../models/school');
const User = require('../models/user');
const Role = require('../models/role');
const ClassModel = require('../models/class');
const Exam = require('../models/exam');
const Subject = require('../models/subject');
const Student = require('../models/student');
const Teacher = require('../models/teacher');
const Attendance = require('../models/attendance');
const Progress = require('../models/progress');
const Leave = require('../models/leave');
const TimeTable = require('../models/timeTable');
const Notice = require('../models/notice');
const CalendarEvent = require('../models/calendar');
const FeeStructure = require('../models/feeStructure');
const FeeRecord = require('../models/feeRecord');
const SalaryStructure = require('../models/salaryStructure');
const SalaryPayment = require('../models/salaryPayment');
const Subscription = require('../models/subscription');
const DownloadLog = require('../models/downloadLog');
const DownloadPolicy = require('../models/downloadPolicy');

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const SUPPORTED_FORMATS = new Set(['csv', 'excel', 'pdf']);
const ROLE_DOWNLOAD_LIMITS = {
  admin: new Set([
    'school-profile',
    'classes',
    'subjects',
    'teachers',
    'students',
    'attendance',
    'results',
    'timetable',
    'notices',
    'calendar',
    'fee-structures',
    'fee-records',
    'salary-structures',
    'salary-payments',
    'exams',
    'leave-records',
    'dashboard-summary',
  ]),
  teacher: new Set(['classes', 'subjects', 'students', 'attendance', 'results']),
};

const DEFAULT_DAILY_LIMIT = 10;

const getSchoolIdFromRequest = (req) => {
  const schoolId = req.user?.school?._id || req.user?.school || req.user?._id;
  return schoolId ? schoolId.toString() : null;
};

const getActorIdFromRequest = (req) => (req.user?._id ? req.user._id.toString() : null);

const getActorRoleFromRequest = (req) => {
  const role = req.user?.role?.role || req.user?.role || 'admin';
  return String(role).toLowerCase();
};

const toDateKey = (date = new Date()) => new Date(date).toISOString().slice(0, 10);

const cleanFilePart = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'download';

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildCsv = (headers, rows) => [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

const buildExcelXml = (sheetName, headers, rows) => {
  const headerRow = `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`).join('')}</Row>`;
  const bodyRows = rows
    .map(
      (row) =>
        `<Row>${row
          .map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`)
          .join('')}</Row>`
    )
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   ${headerRow}
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;
};

const renderPdfBuffer = ({ title, headers, rows, meta = [] }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(16).text(title, { underline: true });
    doc.moveDown(0.5);

    meta.forEach((line) => {
      doc.fontSize(10).text(line);
    });

    if (meta.length) {
      doc.moveDown(0.5);
    }

    doc.fontSize(10).text(headers.join(' | '), { continued: false });
    doc.moveDown(0.25);
    doc.text('-'.repeat(100));

    if (!rows.length) {
      doc.moveDown(0.25);
      doc.text('No records found for the selected filters.');
    } else {
      rows.forEach((row) => {
        doc.moveDown(0.2);
        doc.fontSize(9).text(row.map((value) => String(value ?? '')).join(' | '), { continued: false });
      });
    }

    doc.end();
  });

const getSchoolContext = (req) => {
  const schoolId = getSchoolIdFromRequest(req);
  if (!schoolId) {
    throw new Error('School context is required');
  }
  return schoolId;
};

const getRoleScope = async (req, schoolId, role) => {
  if (role !== 'teacher') {
    return {
      classIds: null,
      subjectIds: null,
      teacherId: null,
    };
  }

  const teacher = await Teacher.findOne({ user: req.user._id })
    .populate('user', '_id name email phone school')
    .populate('teachSubjects', '_id name code class school')
    .populate('teachSclass', '_id name grade section school')
    .populate('class', '_id name grade section school')
    .populate('classTeacher', '_id name grade section school')
    .lean();

  if (!teacher || teacher.user?.school?.toString() !== schoolId) {
    const error = new Error('Teacher profile not found in this school');
    error.statusCode = 403;
    throw error;
  }

  const classIds = new Set();
  const subjectIds = new Set();

  [teacher.class, teacher.classTeacher, ...(teacher.teachSclass || [])].filter(Boolean).forEach((item) => {
    classIds.add(item._id.toString());
  });

  (teacher.teachSubjects || []).filter(Boolean).forEach((item) => {
    subjectIds.add(item._id.toString());
  });

  return {
    classIds,
    subjectIds,
    teacherId: teacher._id.toString(),
  };
};

const getPolicy = async (schoolId, actorId) => {
  const existing = await DownloadPolicy.findOne({ school: schoolId });
  if (existing) {
    return existing;
  }

  const created = await DownloadPolicy.create({
    school: schoolId,
    dailyLimit: DEFAULT_DAILY_LIMIT,
    createdBy: actorId,
    updatedBy: actorId,
  });

  return created;
};

const getTodayUsage = async (schoolId, requestedBy, requestedAtKey) =>
  DownloadLog.countDocuments({
    school: schoolId,
    requestedBy,
    requestedAtKey,
    status: 'success',
  });

const logAttempt = async ({ schoolId, actorId, actorRole, module, format, status, filters, fileName = '', fileSizeBytes = 0, recordCount = 0, blockReason = '', quotaLimit = DEFAULT_DAILY_LIMIT, quotaUsedBefore = 0, quotaUsedAfter = 0, req }) => {
  await DownloadLog.create({
    school: schoolId,
    requestedBy: actorId,
    actorRole,
    module,
    format,
    status,
    filters: filters || {},
    fileName,
    fileSizeBytes,
    recordCount,
    blockReason,
    quotaLimit,
    quotaUsedBefore,
    quotaUsedAfter,
    requestedAtKey: toDateKey(),
    ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '',
    userAgent: req.headers['user-agent'] || '',
  });
};

const coerceList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeFormat = (format) => {
  const value = String(format || '').toLowerCase();
  if (value === 'xlsx') return 'excel';
  if (SUPPORTED_FORMATS.has(value)) return value;
  return null;
};

const normalizeModule = (module) => String(module || '').trim().toLowerCase();

const requireTeacherClassAccess = (teacherScope, classIds) => {
  const allowed = teacherScope.classIds || new Set();
  for (const classId of classIds) {
    if (!allowed.has(classId.toString())) {
      const error = new Error('Teacher can only download data from assigned classes');
      error.statusCode = 403;
      throw error;
    }
  }
};

const requireTeacherSubjectAccess = (teacherScope, subjectIds) => {
  const allowed = teacherScope.subjectIds || new Set();
  for (const subjectId of subjectIds) {
    if (!allowed.has(subjectId.toString())) {
      const error = new Error('Teacher can only download assigned subjects');
      error.statusCode = 403;
      throw error;
    }
  }
};

const getFilterClassIds = (filters) => coerceList(filters.classId || filters.classIds).map((value) => value.toString());
const getFilterSubjectIds = (filters) => coerceList(filters.subjectId || filters.subjectIds).map((value) => value.toString());

const ensureSchoolDoc = async (schoolId) => {
  const school = await School.findById(schoolId).populate('subscription').lean();
  if (!school) {
    const error = new Error('School not found');
    error.statusCode = 404;
    throw error;
  }
  return school;
};

const buildModuleExport = async ({ module, role, schoolId, req, filters, teacherScope }) => {
  const school = await ensureSchoolDoc(schoolId);
  const startDate = parseDate(filters.startDate);
  const endDate = parseDate(filters.endDate);
  const academicYear = filters.academicYear ? String(filters.academicYear).trim() : null;
  const classFilterIds = getFilterClassIds(filters);
  const subjectFilterIds = getFilterSubjectIds(filters);

  const buildMeta = (count) => [
    `School: ${school.schoolName} (${school.schoolId})`,
    `Module: ${module}`,
    `Role: ${role}`,
    `Records: ${count}`,
  ];

  if (module === 'school-profile') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download school profile data');
      error.statusCode = 403;
      throw error;
    }

    const rows = [[
      school.schoolId,
      school.schoolName,
      school.email,
      school.phone || '',
      school.address,
      school.city,
      school.state,
      school.pinCode,
      school.subscription?.planName || '',
      school.subscription?.status || '',
      school.subscription?.endsAt ? new Date(school.subscription.endsAt).toISOString().slice(0, 10) : '',
    ]];

    return {
      sheetName: 'SchoolProfile',
      title: 'School Profile Export',
      headers: ['School ID', 'School Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Pin Code', 'Plan', 'Subscription Status', 'Subscription Ends At'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-profile`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'classes') {
    const query = { school: schoolId };
    if (role === 'teacher') {
      query._id = { $in: [...teacherScope.classIds] };
    }
    if (classFilterIds.length) {
      if (role === 'teacher') {
        requireTeacherClassAccess(teacherScope, classFilterIds);
      }
      query._id = { $in: classFilterIds };
    }

    const classes = await ClassModel.find(query)
      .populate({ path: 'classTeacher', populate: { path: 'user', select: '_id name email phone' } })
      .populate('subjects', 'name code')
      .sort({ grade: 1, section: 1, name: 1 })
      .lean();

    const rows = classes.map((item) => [
      item.name || '',
      item.grade ?? '',
      item.section || '',
      item.room || '',
      item.capacity ?? '',
      item.active ? 'active' : 'inactive',
      item.classTeacher?.user?.name || '',
      (item.subjects || []).map((subject) => subject.name).join('; '),
      item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : '',
    ]);

    return {
      sheetName: 'Classes',
      title: 'Classes Export',
      headers: ['Name', 'Grade', 'Section', 'Room', 'Capacity', 'Status', 'Class Teacher', 'Subjects', 'Created At'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-classes`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'subjects') {
    const query = { school: schoolId };
    if (role === 'teacher') {
      query._id = { $in: [...teacherScope.subjectIds] };
    }
    if (subjectFilterIds.length) {
      if (role === 'teacher') {
        requireTeacherSubjectAccess(teacherScope, subjectFilterIds);
      }
      query._id = { $in: subjectFilterIds };
    }

    const subjects = await Subject.find(query)
      .populate('class', 'name grade section')
      .populate({ path: 'teacher', populate: { path: 'user', select: '_id name email phone' } })
      .sort({ name: 1 })
      .lean();

    const rows = subjects.map((item) => [
      item.name || '',
      item.code || '',
      item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
      item.teacher?.user?.name || '',
      item.maxMarks ?? '',
      item.active ? 'active' : 'inactive',
      item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : '',
    ]);

    return {
      sheetName: 'Subjects',
      title: 'Subjects Export',
      headers: ['Name', 'Code', 'Class', 'Teacher', 'Max Marks', 'Status', 'Created At'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-subjects`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'teachers') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download teacher data');
      error.statusCode = 403;
      throw error;
    }

    const teachers = await Teacher.find({})
      .populate({ path: 'user', select: '_id name email phone school active' })
      .populate('class', 'name grade section school')
      .populate('classTeacher', 'name grade section school')
      .populate('teachSclass', 'name grade section school')
      .populate('teachSubjects', 'name code')
      .lean();

    const filtered = teachers.filter((item) => item.user?.school?.toString() === schoolId);
    const rows = filtered.map((item) => [
      item.user?.name || '',
      item.user?.email || '',
      item.user?.phone || '',
      item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
      item.classTeacher ? `${item.classTeacher.name || ''} ${item.classTeacher.section || ''}`.trim() : '',
      (item.teachSclass || []).map((classItem) => classItem.name).join('; '),
      (item.teachSubjects || []).map((subject) => subject.name).join('; '),
      item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : '',
    ]);

    return {
      sheetName: 'Teachers',
      title: 'Teachers Export',
      headers: ['Name', 'Email', 'Phone', 'Class', 'Class Teacher', 'Assigned Classes', 'Assigned Subjects', 'Created At'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-teachers`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'students') {
    const studentQuery = {};
    if (role === 'teacher') {
      studentQuery.class = { $in: [...teacherScope.classIds] };
    }
    if (classFilterIds.length) {
      if (role === 'teacher') {
        requireTeacherClassAccess(teacherScope, classFilterIds);
      }
      studentQuery.class = { $in: classFilterIds };
    }

    const students = await Student.find(studentQuery)
      .populate({ path: 'user', select: '_id name email phone school active image' })
      .populate('class', 'name grade section school')
      .sort({ createdAt: -1 })
      .lean();

    const filtered = students.filter((item) => item.user?.school?.toString() === schoolId);
    const rows = filtered.map((item) => [
      item.studentId || '',
      item.rollNumber || '',
      item.user?.name || '',
      item.user?.email || '',
      item.user?.phone || '',
      item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
      item.fatherName || '',
      item.motherName || '',
      item.parentContact || '',
      item.dateOfAdmission ? new Date(item.dateOfAdmission).toISOString().slice(0, 10) : '',
      item.status || '',
    ]);

    return {
      sheetName: 'Students',
      title: 'Students Export',
      headers: ['Student ID', 'Roll Number', 'Name', 'Email', 'Phone', 'Class', 'Father Name', 'Mother Name', 'Parent Contact', 'Admission Date', 'Status'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-students`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'attendance') {
    const query = { school: schoolId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    if (classFilterIds.length) {
      if (role === 'teacher') {
        requireTeacherClassAccess(teacherScope, classFilterIds);
      }
      query.class = { $in: classFilterIds };
    } else if (role === 'teacher') {
      query.class = { $in: [...teacherScope.classIds] };
    }

    const [attendanceRows, students] = await Promise.all([
      Attendance.find(query)
        .populate({ path: 'user', select: '_id name email phone school' })
        .populate('class', 'name grade section')
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      Student.find({})
        .populate({ path: 'user', select: '_id name email phone school' })
        .populate('class', 'name grade section')
        .lean(),
    ]);

    const studentMap = new Map(
      students
        .filter((item) => item.user?.school?.toString() === schoolId)
        .map((item) => [item.user._id.toString(), item])
    );

    const rows = attendanceRows.map((item) => {
      const student = studentMap.get(item.user?._id?.toString());
      return [
        item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
        student?.studentId || '',
        student?.rollNumber || '',
        item.user?.name || '',
        item.user?.email || '',
        item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
        item.status || '',
        item.remarks || '',
      ];
    });

    return {
      sheetName: 'Attendance',
      title: 'Attendance Export',
      headers: ['Date', 'Student ID', 'Roll Number', 'Name', 'Email', 'Class', 'Status', 'Remarks'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-attendance`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'results') {
    const query = { school: schoolId };
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    if (classFilterIds.length) {
      if (role === 'teacher') {
        requireTeacherClassAccess(teacherScope, classFilterIds);
      }
      query.class = { $in: classFilterIds };
    } else if (role === 'teacher') {
      query.class = { $in: [...teacherScope.classIds] };
    }
    if (subjectFilterIds.length) {
      if (role === 'teacher') {
        requireTeacherSubjectAccess(teacherScope, subjectFilterIds);
      }
      query.subject = { $in: subjectFilterIds };
    } else if (role === 'teacher' && teacherScope.subjectIds.size) {
      query.subject = { $in: [...teacherScope.subjectIds] };
    }

    const [progressRows, students] = await Promise.all([
      Progress.find(query)
        .populate('student', 'studentId rollNumber user class')
        .populate({ path: 'student', populate: { path: 'user', select: '_id name email phone school' } })
        .populate('class', 'name grade section')
        .populate('subject', 'name code')
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      Student.find({})
        .populate({ path: 'user', select: '_id name email phone school' })
        .lean(),
    ]);

    const studentMap = new Map(
      students
        .filter((item) => item.user?.school?.toString() === schoolId)
        .map((item) => [item._id.toString(), item])
    );

    const rows = progressRows.map((item) => {
      const student = studentMap.get(item.student?._id?.toString());
      return [
        item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
        student?.studentId || item.student?.studentId || '',
        student?.rollNumber || item.student?.rollNumber || '',
        item.student?.user?.name || student?.user?.name || '',
        item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
        item.subject?.name || '',
        item.type || '',
        item.title || '',
        item.marksObtained ?? '',
        item.totalMarks ?? '',
        item.percentage ?? '',
        item.grade || '',
        item.academicYear || '',
        item.remarks || '',
      ];
    });

    return {
      sheetName: 'Results',
      title: 'Results Export',
      headers: ['Date', 'Student ID', 'Roll Number', 'Student Name', 'Class', 'Subject', 'Type', 'Title', 'Marks Obtained', 'Total Marks', 'Percentage', 'Grade', 'Academic Year', 'Remarks'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-results`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'timetable') {
    if (role === 'teacher') {
      const classFilter = classFilterIds.length ? classFilterIds : [...teacherScope.classIds];
      if (classFilterIds.length) {
        requireTeacherClassAccess(teacherScope, classFilterIds);
      }
      const timetables = await TimeTable.find({ school: schoolId, class: { $in: classFilter } })
        .populate('class', 'name grade section')
        .populate('periods.subject', 'name code')
        .sort({ day: 1 })
        .lean();

      const rows = timetables.flatMap((item) =>
        (item.periods || []).map((period) => [
          item.name || '',
          item.day || '',
          item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
          period.subject?.name || '',
          period.startTime || '',
          period.endTime || '',
          period.hour ?? '',
        ])
      );

      return {
        sheetName: 'Timetable',
        title: 'Timetable Export',
        headers: ['Name', 'Day', 'Class', 'Subject', 'Start Time', 'End Time', 'Hour'],
        rows,
        fileBase: `${cleanFilePart(school.schoolName)}-timetable`,
        meta: buildMeta(rows.length),
      };
    }

    const timetables = await TimeTable.find({ school: schoolId })
      .populate('class', 'name grade section')
      .populate('periods.subject', 'name code')
      .sort({ day: 1 })
      .lean();

    const rows = timetables.flatMap((item) =>
      (item.periods || []).map((period) => [
        item.name || '',
        item.day || '',
        item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
        period.subject?.name || '',
        period.startTime || '',
        period.endTime || '',
        period.hour ?? '',
      ])
    );

    return {
      sheetName: 'Timetable',
      title: 'Timetable Export',
      headers: ['Name', 'Day', 'Class', 'Subject', 'Start Time', 'End Time', 'Hour'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-timetable`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'notices') {
    const notices = await Notice.find({ school: schoolId }).sort({ date: -1, createdAt: -1 }).lean();
    const rows = notices.map((item) => [
      item.title || '',
      item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
      item.validity ? new Date(item.validity).toISOString().slice(0, 10) : '',
      item.details || '',
    ]);

    return {
      sheetName: 'Notices',
      title: 'Notices Export',
      headers: ['Title', 'Date', 'Validity', 'Details'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-notices`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'calendar') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download calendar data');
      error.statusCode = 403;
      throw error;
    }

    const events = await CalendarEvent.find({ school: schoolId }).populate('organizer', 'name email phone').sort({ startDate: -1 }).lean();
    const rows = events.map((item) => [
      item.title || '',
      item.startDate ? new Date(item.startDate).toISOString() : '',
      item.endDate ? new Date(item.endDate).toISOString() : '',
      item.allDay ? 'yes' : 'no',
      item.visibility || '',
      item.status || '',
      item.location || '',
      item.timezone || '',
      item.organizer?.name || '',
      (item.attendees || []).length,
    ]);

    return {
      sheetName: 'Calendar',
      title: 'Calendar Export',
      headers: ['Title', 'Start Date', 'End Date', 'All Day', 'Visibility', 'Status', 'Location', 'Timezone', 'Organizer', 'Attendee Count'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-calendar`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'exams') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download exam data');
      error.statusCode = 403;
      throw error;
    }

    const exams = await Exam.find({ School: schoolId })
      .populate('class', 'name grade section')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const rows = exams.map((item) => [
      item.title || '',
      item.subject || '',
      item.date ? new Date(item.date).toISOString().slice(0, 10) : '',
      item.duration ?? '',
      item.totalMarks ?? '',
      item.passingMarks ?? '',
      (item.class || []).map((classItem) => `${classItem.name || ''} ${classItem.section || ''}`.trim()).join('; '),
    ]);

    return {
      sheetName: 'Exams',
      title: 'Exams Export',
      headers: ['Title', 'Subject', 'Date', 'Duration (Minutes)', 'Total Marks', 'Passing Marks', 'Classes'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-exams`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'leave-records') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download leave records');
      error.statusCode = 403;
      throw error;
    }

    const leaveRecords = await Leave.find({ school: schoolId })
      .populate({ path: 'applicantUser', select: '_id name email phone username' })
      .populate({ path: 'reviewedBy', select: '_id name email phone username' })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const rows = leaveRecords.map((item) => [
      item.applicantUser?.name || '',
      item.applicantUser?.username || '',
      item.leaveType || '',
      item.purpose || '',
      item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : '',
      item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : '',
      item.status || '',
      item.reviewedBy?.name || '',
      item.reviewedAt ? new Date(item.reviewedAt).toISOString().slice(0, 10) : '',
    ]);

    return {
      sheetName: 'Leaves',
      title: 'Leave Records Export',
      headers: ['Applicant', 'Username', 'Leave Type', 'Purpose', 'Start Date', 'End Date', 'Status', 'Reviewed By', 'Reviewed At'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-leave-records`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'fee-structures') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download fee structure data');
      error.statusCode = 403;
      throw error;
    }

    const feeStructures = await FeeStructure.find({ school: schoolId }).populate('class', 'name grade section').sort({ createdAt: -1 }).lean();
    const rows = feeStructures.map((item) => [
      item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
      item.components?.tuition ?? 0,
      item.components?.exam ?? 0,
      item.components?.transport ?? 0,
      item.components?.hostel ?? 0,
      item.components?.activity ?? 0,
      item.components?.development ?? 0,
    ]);

    return {
      sheetName: 'FeeStructures',
      title: 'Fee Structures Export',
      headers: ['Class', 'Tuition', 'Exam', 'Transport', 'Hostel', 'Activity', 'Development'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-fee-structures`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'fee-records') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download fee record data');
      error.statusCode = 403;
      throw error;
    }

    const feeRecords = await FeeRecord.find({ school: schoolId })
      .populate({ path: 'user', select: '_id name email phone' })
      .populate('class', 'name grade section')
      .sort({ year: -1, month: -1, createdAt: -1 })
      .lean();

    const rows = feeRecords.map((item) => [
      item.month ?? '',
      item.year ?? '',
      item.user?.name || '',
      item.class ? `${item.class.name || ''} ${item.class.section || ''}`.trim() : '',
      item.totalFee ?? 0,
      item.paidAmount ?? 0,
      item.dueAmount ?? 0,
      item.status || '',
      item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '',
    ]);

    return {
      sheetName: 'FeeRecords',
      title: 'Fee Records Export',
      headers: ['Month', 'Year', 'Student', 'Class', 'Total Fee', 'Paid Amount', 'Due Amount', 'Status', 'Due Date'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-fee-records`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'salary-structures') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download salary structure data');
      error.statusCode = 403;
      throw error;
    }

    const salaryStructures = await SalaryStructure.find({ school: schoolId }).sort({ createdAt: -1 }).lean();
    const rows = salaryStructures.map((item) => [
      item.role || '',
      item.components?.basic ?? 0,
      item.components?.hra ?? 0,
      item.components?.da ?? 0,
      item.components?.bonus ?? 0,
      item.deductions?.pf ?? 0,
      item.deductions?.tax ?? 0,
      item.deductions?.other ?? 0,
    ]);

    return {
      sheetName: 'SalaryStructures',
      title: 'Salary Structures Export',
      headers: ['Role', 'Basic', 'HRA', 'DA', 'Bonus', 'PF', 'Tax', 'Other'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-salary-structures`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'salary-payments') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download salary payment data');
      error.statusCode = 403;
      throw error;
    }

    const salaryPayments = await SalaryPayment.find({ school: schoolId })
      .populate({ path: 'staffId', select: '_id name email phone' })
      .populate('salaryStructureId', 'role')
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();

    const rows = salaryPayments.map((item) => [
      item.staffId?.name || '',
      item.salaryStructureId?.role || '',
      item.month ?? '',
      item.year ?? '',
      item.amount ?? 0,
      item.method || '',
      item.status || '',
      item.paidAt ? new Date(item.paidAt).toISOString().slice(0, 10) : '',
      item.transactionId || '',
    ]);

    return {
      sheetName: 'SalaryPayments',
      title: 'Salary Payments Export',
      headers: ['Staff', 'Role', 'Month', 'Year', 'Amount', 'Method', 'Status', 'Paid At', 'Transaction ID'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-salary-payments`,
      meta: buildMeta(rows.length),
    };
  }

  if (module === 'dashboard-summary') {
    if (role !== 'admin') {
      const error = new Error('Only admin can download dashboard summary data');
      error.statusCode = 403;
      throw error;
    }

    const [studentRole, teacherRole] = await Promise.all([
      Role.findOne({ role: 'student' }).select('_id').lean(),
      Role.findOne({ role: 'teacher' }).select('_id').lean(),
    ]);

    const [classes, subjects, students, teachers, attendanceCount, progressCount, feeRecords, salaryPayments] = await Promise.all([
      ClassModel.countDocuments({ school: schoolId }),
      Subject.countDocuments({ school: schoolId }),
      User.countDocuments({ school: schoolId, role: studentRole?._id }),
      User.countDocuments({ school: schoolId, role: teacherRole?._id }),
      Attendance.countDocuments({ school: schoolId }),
      Progress.countDocuments({ school: schoolId }),
      FeeRecord.countDocuments({ school: schoolId }),
      SalaryPayment.countDocuments({ school: schoolId }),
    ]);

    const rows = [[
      classes,
      subjects,
      students,
      teachers,
      attendanceCount,
      progressCount,
      feeRecords,
      salaryPayments,
    ]];

    return {
      sheetName: 'DashboardSummary',
      title: 'Dashboard Summary Export',
      headers: ['Classes', 'Subjects', 'Students', 'Teachers', 'Attendance Records', 'Progress Records', 'Fee Records', 'Salary Payments'],
      rows,
      fileBase: `${cleanFilePart(school.schoolName)}-dashboard-summary`,
      meta: buildMeta(rows.length),
    };
  }

  const error = new Error('Unsupported download module');
  error.statusCode = 400;
  throw error;
};

const downloadExport = async (req, res) => {
  const actorRole = getActorRoleFromRequest(req);
  const actorId = getActorIdFromRequest(req);
  const schoolId = getSchoolContext(req);

  try {
    const rawModule = req.body?.module;
    const rawFormat = req.body?.format;
    const module = normalizeModule(rawModule);
    const format = normalizeFormat(rawFormat);
    const filters = req.body?.filters && typeof req.body.filters === 'object' ? req.body.filters : {};

    if (!module) {
      await logAttempt({
        schoolId,
        actorId,
        actorRole,
        module: String(rawModule || ''),
        format: String(rawFormat || '').toLowerCase(),
        status: 'blocked',
        filters,
        blockReason: 'module is required',
        req,
      });
      return res.status(400).json(formatResponse(false, 'module is required'));
    }

    if (!format) {
      await logAttempt({
        schoolId,
        actorId,
        actorRole,
        module,
        format: String(rawFormat || '').toLowerCase(),
        status: 'blocked',
        filters,
        blockReason: 'format must be csv, excel, or pdf',
        req,
      });
      return res.status(400).json(formatResponse(false, 'format must be csv, excel, or pdf'));
    }

    if (!ROLE_DOWNLOAD_LIMITS[actorRole]?.has(module)) {
      await logAttempt({
        schoolId,
        actorId,
        actorRole,
        module,
        format,
        status: 'blocked',
        filters,
        blockReason: 'You are not allowed to download this module',
        req,
      });
      return res.status(403).json(formatResponse(false, 'You are not allowed to download this module'));
    }

    const policy = await getPolicy(schoolId, actorId);
    const requestedAtKey = toDateKey();
    const quotaUsedBefore = await getTodayUsage(schoolId, actorId, requestedAtKey);

    if (quotaUsedBefore >= policy.dailyLimit) {
      await logAttempt({
        schoolId,
        actorId,
        actorRole,
        module,
        format,
        status: 'blocked',
        filters,
        quotaLimit: policy.dailyLimit,
        quotaUsedBefore,
        quotaUsedAfter: quotaUsedBefore,
        blockReason: 'Daily download limit reached',
        req,
      });

      return res.status(429).json(
        formatResponse(false, 'Daily download limit reached. Update download limits to continue.', {
          dailyLimit: policy.dailyLimit,
          downloadsUsedToday: quotaUsedBefore,
        })
      );
    }

    const teacherScope = actorRole === 'teacher' ? await getRoleScope(req, schoolId, actorRole) : null;
    const exportPayload = await buildModuleExport({ module, role: actorRole, schoolId, req, filters, teacherScope });
    const fileName = `${exportPayload.fileBase}-${toDateKey()}-${module}.${format === 'excel' ? 'xls' : format === 'pdf' ? 'pdf' : 'csv'}`;
    const recordCount = exportPayload.rows.length;
    const quotaUsedAfter = quotaUsedBefore + 1;

    const contentType = format === 'csv'
      ? 'text/csv; charset=utf-8'
      : format === 'excel'
        ? 'application/vnd.ms-excel; charset=utf-8'
        : 'application/pdf';

    await logAttempt({
      schoolId,
      actorId,
      actorRole,
      module,
      format,
      status: 'success',
      filters,
      fileName,
      recordCount,
      quotaLimit: policy.dailyLimit,
      quotaUsedBefore,
      quotaUsedAfter,
      req,
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (format === 'csv') {
      return res.status(200).send(buildCsv(exportPayload.headers, exportPayload.rows));
    }

    if (format === 'excel') {
      return res.status(200).send(buildExcelXml(exportPayload.sheetName, exportPayload.headers, exportPayload.rows));
    }

    const pdfBuffer = await renderPdfBuffer({
      title: exportPayload.title,
      headers: exportPayload.headers,
      rows: exportPayload.rows,
      meta: exportPayload.meta,
    });

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    if (schoolId && actorId && req.body?.module && req.body?.format) {
      try {
        await logAttempt({
          schoolId,
          actorId,
          actorRole,
          module: normalizeModule(req.body.module),
          format: normalizeFormat(req.body.format) || String(req.body.format).toLowerCase(),
          status: 'failed',
          filters: req.body?.filters || {},
          quotaLimit: DEFAULT_DAILY_LIMIT,
          quotaUsedBefore: 0,
          quotaUsedAfter: 0,
          blockReason: error.message,
          req,
        });
      } catch (logError) {
        // keep the original error as the response source
      }
    }

    return res.status(statusCode).json(formatResponse(false, error.message || 'Error generating download', null, error.message));
  }
};

const getDownloadHistory = async (req, res) => {
  try {
    const schoolId = getSchoolContext(req);
    const role = getActorRoleFromRequest(req);
    const actorId = getActorIdFromRequest(req);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;
    const query = { school: schoolId };

    if (role === 'teacher') {
      query.requestedBy = actorId;
    } else if (req.query.requestedBy && mongoose.Types.ObjectId.isValid(req.query.requestedBy)) {
      query.requestedBy = req.query.requestedBy;
    }

    if (req.query.module) {
      query.module = normalizeModule(req.query.module);
    }

    if (req.query.format) {
      query.format = normalizeFormat(req.query.format) || String(req.query.format).toLowerCase();
    }

    if (req.query.status) {
      query.status = String(req.query.status).toLowerCase();
    }

    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      const start = parseDate(req.query.startDate);
      const end = parseDate(req.query.endDate);
      if (start) query.createdAt.$gte = start;
      if (end) query.createdAt.$lte = end;
    }

    const [items, total] = await Promise.all([
      DownloadLog.find(query)
        .populate('requestedBy', 'name email phone username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DownloadLog.countDocuments(query),
    ]);

    return res.status(200).json(
      formatResponse(true, 'Download history fetched successfully', {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching download history', null, error.message));
  }
};

const getDownloadLimits = async (req, res) => {
  try {
    const schoolId = getSchoolContext(req);
    const actorId = getActorIdFromRequest(req);
    const policy = await getPolicy(schoolId, actorId);
    const downloadsUsedToday = await getTodayUsage(schoolId, actorId, toDateKey());

    return res.status(200).json(
      formatResponse(true, 'Download limits fetched successfully', {
        schoolId,
        policy: {
          _id: policy._id,
          dailyLimit: policy.dailyLimit,
          enabledRoles: policy.enabledRoles,
          notes: policy.notes,
          createdAt: policy.createdAt,
          updatedAt: policy.updatedAt,
        },
        downloadsUsedToday,
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching download limits', null, error.message));
  }
};

const updateDownloadLimits = async (req, res) => {
  try {
    const schoolId = getSchoolContext(req);
    const actorId = getActorIdFromRequest(req);
    const dailyLimit = Number(req.body?.dailyLimit);

    if (!Number.isFinite(dailyLimit) || dailyLimit < 1) {
      return res.status(400).json(formatResponse(false, 'dailyLimit must be a positive number'));
    }

    const enabledRoles = coerceList(req.body?.enabledRoles)
      .map((role) => String(role).toLowerCase())
      .filter((role) => ['admin', 'teacher'].includes(role));

    const policy = await DownloadPolicy.findOneAndUpdate(
      { school: schoolId },
      {
        $set: {
          dailyLimit,
          enabledRoles: enabledRoles.length ? enabledRoles : ['admin', 'teacher'],
          notes: req.body?.notes || '',
          updatedBy: actorId,
        },
        $setOnInsert: {
          school: schoolId,
          createdBy: actorId,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json(
      formatResponse(true, 'Download limits updated successfully', {
        policy,
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating download limits', null, error.message));
  }
};

module.exports = {
  downloadExport,
  getDownloadHistory,
  getDownloadLimits,
  updateDownloadLimits,
};