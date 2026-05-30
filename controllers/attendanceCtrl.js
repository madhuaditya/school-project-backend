const Attendance = require("../models/attendance");
const User = require("../models/user");
const Class = require("../models/class");
const Student = require("../models/student");
const Teacher = require("../models/teacher");
const Role    = require("../models/role")
const moment = require("moment-timezone");

const IST_TIMEZONE = "Asia/Kolkata";

const momentIst = (value) => {
  if (value === undefined || value === null) {
    return moment().tz(IST_TIMEZONE);
  }

  return moment.tz(value, IST_TIMEZONE);
};

const startOfIstDay = (value) => momentIst(value).startOf("day").toDate();

const endOfIstDay = (value) => momentIst(value).endOf("day").toDate();

const buildIstMonthRange = (year, month) => {
  const start = moment.tz(`${year}-${month}-01`, "YYYY-M-D", IST_TIMEZONE).startOf("day");

  if (!start.isValid()) {
    return { error: "Invalid month or year value" };
  }

  return {
    startDate: start.toDate(),
    endDate: start.clone().endOf("month").toDate(),
  };
};

const buildIstYearRange = (year) => {
  const start = moment.tz(`${year}-01-01`, "YYYY-M-D", IST_TIMEZONE).startOf("day");

  if (!start.isValid()) {
    return { error: "Invalid year value" };
  }

  return {
    startDate: start.toDate(),
    endDate: start.clone().endOf("year").toDate(),
  };
};

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

// ==================== AUTHORIZATION HELPERS ====================
const checkUserSchool = async (userId, schoolId) => {
  const user = await User.findById(userId).select("school");
  return user && user.school.toString() === schoolId.toString();
};

const parseDashboardDateRange = (startDateValue, endDateValue) => {
  const startDate = momentIst(startDateValue).startOf("day");
  const endDate = momentIst(endDateValue).endOf("day");

  if (!startDate.isValid() || !endDate.isValid()) {
    return { error: "Invalid startDate or endDate" };
  }

  if (startDate.isAfter(endDate)) {
    return { error: "startDate cannot be greater than endDate" };
  }

  return { startDate: startDate.toDate(), endDate: endDate.toDate() };
};

const formatDateKey = (value) => {
  return momentIst(value).format("YYYY-MM-DD");
};

const toIstAttendancePayload = (attendanceDoc) => {
  const attendance = attendanceDoc?.toObject ? attendanceDoc.toObject() : attendanceDoc;

  if (!attendance) {
    return attendance;
  }

  return {
    ...attendance,
    date: momentIst(attendance.date).format("YYYY-MM-DD"),
  };
};

const getDateKeysInRange = (startDate, endDate) => {
  const keys = [];
  const cursor = momentIst(startDate).startOf("day");
  const lastDay = momentIst(endDate).startOf("day");

  while (cursor.isSameOrBefore(lastDay, "day")) {
    keys.push(cursor.format("YYYY-MM-DD"));
    cursor.add(1, "day");
  }

  return keys;
};

const ensureClassDashboardAccess = async ({ classId, currentUserId, currentUserRole, currentUserSchool }) => {
  if (!classId) {
    return { status: 400, response: formatResponse(false, "classId is required") };
  }

  const classDoc = await Class.findById(classId)
    .populate({
      path: "classTeacher",
      populate: {
        path: "user",
        select: "_id name",
      },
    })
    .lean();

  if (!classDoc) {
    return { status: 404, response: formatResponse(false, "Class not found") };
  }

  if (!classDoc?.school || classDoc.school.toString() !== currentUserSchool.toString()) {
    return { status: 403, response: formatResponse(false, "Class not in your school") };
  }

  if (currentUserRole === "admin") {
    return { classDoc };
  }

  if (currentUserRole !== "teacher") {
    return { status: 403, response: formatResponse(false, "Unauthorized to view class attendance dashboard") };
  }

  const teacherProfile = await Teacher.findOne({ user: currentUserId })
    .select("_id class classTeacher teachSclass")
    .lean();

  if (!teacherProfile) {
    return { status: 403, response: formatResponse(false, "Teacher profile not found") };
  }

  const classIdString = classId.toString();
  const canAccess =
    classDoc?.classTeacher?._id?.toString() === teacherProfile._id.toString() ||
    teacherProfile?.class?.toString() === classIdString ||
    teacherProfile?.classTeacher?.toString() === classIdString ||
    (Array.isArray(teacherProfile?.teachSclass) &&
      teacherProfile.teachSclass.some((entry) => entry?.toString() === classIdString));

  if (!canAccess) {
    return { status: 403, response: formatResponse(false, "You can only view dashboard for your assigned classes") };
  }

  return { classDoc };
};


// ==================== MARK ATTENDANCE ====================

/**
 * Mark attendance for students, staff, and teachers
 * Admin: Can mark for any student/staff/teacher in school
 * Teacher: Can mark for students in their class and themselves
 * Staff: Can mark only for themselves
 * Student: Can view their own (handled in getAttendance)
 */
const markAttendance = async (req, res) => {
  try {
    const { userId, date, status, remarks, classId } = req.body;
    const currentUserId = req.user._id;
    const schoolId = req.user.school._id;
    const currentUserRole = req.user.role.role;
    

    if(!schoolId) {
      return res.status(400).json(formatResponse(false, "Your account is not associated with any school"));
    }

    // Validation
    if (!userId || !date || !status) {
      return res.status(400).json(
        formatResponse(false, "Missing required fields: userId, date, status, school")
      );
    }

    if (!["present", "absent", "leave"].includes(status)) {
      return res.status(400).json(
        formatResponse(false, "Invalid status. Must be: present, absent, or leave")
      );
    }

    const attendanceMoment = momentIst(date).startOf("day");
    if (!attendanceMoment.isValid()) {
      return res.status(400).json(formatResponse(false, "Invalid date value"));
    }
    const attendanceDate = attendanceMoment.toDate();

    // Check if user exists
    const targetUser = await User.findById(userId).populate('role', 'role').populate('school', '_id schoolName');
    if (!targetUser) {
      return res.status(404).json(formatResponse(false, "User not found"));
    }
    if(targetUser.school._id.toString() !== schoolId.toString()) {
      return res.status(403).json(formatResponse(false, "You can only mark attendance for users in your school"));
    }

    const existingAttendance = await Attendance.findOne({
      user: userId,
      date: attendanceDate,
      school: schoolId
    });

    if (existingAttendance) {
      existingAttendance.status = status;
      existingAttendance.remarks = remarks || null;
      existingAttendance.updatedBy = currentUserId;
      await existingAttendance.save();
      return res.status(200).json(
        formatResponse(true, "Attendance updated successfully", existingAttendance)
      );
    }

    const createdBy = currentUserId;

    if(currentUserRole === 'admin' ){
      const newAttendance = await Attendance.create({
        user: userId,
        status,
        date: attendanceDate,
        remarks: remarks || null,
        school: schoolId,
        class: classId || null,
        createdBy: createdBy,
        updatedBy: currentUserId,
      });
      return res.status(201).json(formatResponse(true, "Attendance marked successfully", newAttendance));
    } else if (currentUserRole === "teacher" && (targetUser.role.role === "student" || targetUser._id.toString() === currentUserId.toString())) {
      const newAttendance = await Attendance.create({
        user: userId,
        status,
        date: attendanceDate,
        remarks: remarks || null,
        school: schoolId,
        class: classId || null,
        createdBy: createdBy,
        updatedBy: currentUserId,
      });
      return res.status(201).json(formatResponse(true, "Attendance marked successfully", newAttendance));
    } else if (currentUserRole === "staff" && targetUser._id.toString() === currentUserId.toString()) {
      const newAttendance = await Attendance.create({
        user: userId,
        status,
        date: attendanceDate,
        remarks: remarks || null,
        school: schoolId,
        class: classId || null,
        createdBy: createdBy,
        updatedBy: currentUserId,
      });
      return res.status(201).json(formatResponse(true, "Attendance marked successfully", newAttendance));
    } else {
      return res.status(403).json(formatResponse(false, "Unauthorized to mark attendance"));
    }
  } catch (error) {
    console.error("Error marking attendance:", error);
    return res.status(500).json(formatResponse(false, "Error marking attendance", null, error.message));
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { userId, date, status, remarks, classId } = req.body;
    const currentUserId = req.user._id;
    const schoolId = req.user.school._id;
    const currentUserRole = req.user.role.role;      

    if(!schoolId) {
      return res.status(400).json(formatResponse(false, "Your account is not associated with any school"));
    }

    // Validation
    if (!userId || !date || !status) {
      return res.status(400).json(
        formatResponse(false, "Missing required fields: userId, date, status, school")
      );
    }

    if (!["present", "absent", "leave"].includes(status)) {
      return res.status(400).json(
        formatResponse(false, "Invalid status. Must be: present, absent, or leave")
      );
    }

    const attendanceMoment = momentIst(date).startOf("day");
    if (!attendanceMoment.isValid()) {
      return res.status(400).json(formatResponse(false, "Invalid date value"));
    }
    const attendanceDate = attendanceMoment.toDate();

    // Check if user exists
    const targetUser = await User.findById(userId).populate('role', 'role').populate('school', '_id schoolName');
    if (!targetUser) {
      return res.status(404).json(formatResponse(false, "User not found"));
    }
    if(targetUser.school._id.toString() !== schoolId.toString()) {
      return res.status(403).json(formatResponse(false, "You can only update attendance for users in your school"));
    }

    const existingAttendance = await Attendance.findOne({
      user: userId,
      date: attendanceDate,
      school: schoolId
    });
    
    if (!existingAttendance) {
       return res.status(404).json(formatResponse(false, "Attendance record not found for the given user and date"));
    }

    if(currentUserRole === 'admin' ){
      existingAttendance.status = status;
      existingAttendance.remarks = remarks || null;
      existingAttendance.updatedBy = currentUserId;
      await existingAttendance.save();
      return res.status(200).json(formatResponse(true, "Attendance updated successfully", toIstAttendancePayload(existingAttendance)));
    } else if (currentUserRole === "teacher" && (targetUser.role.role === "student" || targetUser._id.toString() === currentUserId.toString())) {
      existingAttendance.status = status;
      existingAttendance.remarks = remarks || null;
      existingAttendance.updatedBy = currentUserId;
      await existingAttendance.save();
      return res.status(200).json(formatResponse(true, "Attendance updated successfully", toIstAttendancePayload(existingAttendance)));
    } else if (currentUserRole === "staff" && targetUser._id.toString() === currentUserId.toString()) {
      existingAttendance.status = status;
      existingAttendance.remarks = remarks || null;
      existingAttendance.updatedBy = currentUserId;
      await existingAttendance.save();
      return res.status(200).json(formatResponse(true, "Attendance updated successfully", toIstAttendancePayload(existingAttendance)));
    } else {
      return res.status(403).json(formatResponse(false, "Unauthorized to update attendance"));
    }
  } catch (error) {
    console.error("Error updating attendance:", error);
    return res.status(500).json(formatResponse(false, "Error updating attendance", null, error.message));
  }
};

// ==================== GET ATTENDANCE ====================

/**
 * Get attendance - Users see only their own, Admin can see anyone
 * Filter by month and year
 */
const getAttendance = async (req, res) => {
  try {
    const { userId, month, year } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    // Get user to check
    let targetUserId = userId ? userId : currentUserId.toString();

    // Authorization: Users can only see their own attendance unless they're admin
    if (
      currentUserRole !== "admin" &&
      currentUserRole !== "teacher" &&
      targetUserId !== currentUserId.toString()
    ) {
      return res.status(403).json(formatResponse(false, "You can only view your own attendance"));
    }

    // Build filter
    const filter = {
      user: targetUserId,
      school: currentUserSchool,
    };

    // Filter by month and year if provided
    if (month && year) {
      const range = buildIstMonthRange(Number(year), Number(month));
      if (range.error) {
        return res.status(400).json(formatResponse(false, range.error));
      }
      filter.date = {
        $gte: range.startDate,
        $lte: range.endDate,
      };
    } else if (year) {
      const range = buildIstYearRange(Number(year));
      if (range.error) {
        return res.status(400).json(formatResponse(false, range.error));
      }
      filter.date = {
        $gte: range.startDate,
        $lte: range.endDate,
      };
    }
    // console.log("Fetching attendance with filter:", filter);

    const attendanceRecords = await Attendance.find(filter)
      .populate("user", "_id name email phone")
      .populate("class", " _id name grade section")
      .populate("createdBy", " _id name")
      .populate("updatedBy", " _id name")
      .sort({ date: -1 });

    if (attendanceRecords.length === 0) {
      return res.status(200).json(formatResponse(false, "No attendance records found"));
    }

    const attendance = attendanceRecords.map((record) => toIstAttendancePayload(record));

    // Calculate summary
    const summary = {
      total: attendance.length,
      present: attendance.filter((a) => a.status === "present").length,
      absent: attendance.filter((a) => a.status === "absent").length,
      leave: attendance.filter((a) => a.status === "leave").length,
      presentPercentage: (
        (attendance.filter((a) => a.status === "present").length /
          attendance.length) *
        100
      ).toFixed(2),
    };

    return res.status(200).json(
      formatResponse(true, "Attendance records fetched successfully", {
        attendance,
        summary,
        filters: { month, year },
      })
    );
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return res.status(500).json(formatResponse(false, "Error fetching attendance", null, error.message));
  }
};

// ==================== GET CLASS ATTENDANCE ====================

/**
 * Get attendance for entire class
 * Only teachers of that class or admin can access
 */
const getClassAttendance = async (req, res) => {
  try {
    const { classId, month, year } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    if (!classId) {
      return res.status(400).json(formatResponse(false, "classId is required"));
    }

    // Get class
    const classDoc = await Class.findById(classId).populate("teacher", "_id");
    if (!classDoc) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    // Authorization
    if (currentUserRole !== "admin" && currentUserRole !== "school") {
      if (currentUserRole === "teacher") {
        if (classDoc.teacher._id.toString() !== currentUserId.toString()) {
          return res.status(403).json(
            formatResponse(false, "You can only view attendance for your own class")
          );
        }
      } else {
        return res.status(403).json(formatResponse(false, "Unauthorized to view class attendance"));
      }
    }

    // Build filter
    const filter = {
      class: classId,
      school: currentUserSchool,
    };

    if (month && year) {
      const range = buildIstMonthRange(Number(year), Number(month));
      if (range.error) {
        return res.status(400).json(formatResponse(false, range.error));
      }
      filter.date = {
        $gte: range.startDate,
        $lte: range.endDate,
      };
    } else if (year) {
      const range = buildIstYearRange(Number(year));
      if (range.error) {
        return res.status(400).json(formatResponse(false, range.error));
      }
      filter.date = {
        $gte: range.startDate,
        $lte: range.endDate,
      };
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate("user", "name email phone")
      .sort({ date: -1, "user.name": 1 });

    if (attendanceRecords.length === 0) {
      return res.status(404).json(formatResponse(false, "No attendance records found for this class"));
    }

    return res.status(200).json(
      formatResponse(true, "Class attendance records fetched successfully", {
        classInfo: { id: classDoc._id, name: classDoc.name, grade: classDoc.grade },
        attendance: attendanceRecords,
        totalRecords: attendanceRecords.length,
        filters: { month, year },
      })
    );
  } catch (error) {
    console.error("Error fetching class attendance:", error);
    return res.status(500).json(formatResponse(false, "Error fetching class attendance", null, error.message));
  }
};

// ==================== GET STAFF ATTENDANCE ====================

/**
 * Get attendance for staff in school
 * Only admin can view
 */
const getStaffAttendance = async (req, res) => {
  try {
    const { staffId, month, year } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    // Only admin
    if (currentUserRole !== "admin" && currentUserRole !== "school") {
      return res.status(403).json(formatResponse(false, "Only admin can view staff attendance"));
    }

    if (!staffId) {
      return res.status(400).json(formatResponse(false, "staffId is required"));
    }

    // Build filter
    const filter = {
      user: staffId,
      school: currentUserSchool,
    };

    if (month && year) {
      const range = buildIstMonthRange(Number(year), Number(month));
      if (range.error) {
        return res.status(400).json(formatResponse(false, range.error));
      }
      filter.date = {
        $gte: range.startDate,
        $lte: range.endDate,
      };
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate("user", "name email")
      .sort({ date: -1 });

    if (attendanceRecords.length === 0) {
      return res.status(404).json(formatResponse(false, "No attendance records found for this staff"));
    }

    const summary = {
      total: attendanceRecords.length,
      present: attendanceRecords.filter((a) => a.status === "present").length,
      absent: attendanceRecords.filter((a) => a.status === "absent").length,
      leave: attendanceRecords.filter((a) => a.status === "leave").length,
    };

    return res.status(200).json(
      formatResponse(true, "Staff attendance records fetched successfully", {
        attendance: attendanceRecords,
        summary,
        filters: { month, year },
      })
    );
  } catch (error) {
    console.error("Error fetching staff attendance:", error);
    return res.status(500).json(formatResponse(false, "Error fetching staff attendance", null, error.message));
  }
};

// ==================== GET TEACHER ATTENDANCE ====================

/**
 * Get attendance for teacher in school
 * Only admin can view
 */
const getTeacherAttendance = async (req, res) => {
  try {
    const { teacherId, month, year } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    // Only admin
    if (currentUserRole !== "admin" && currentUserRole !== "school") {
      return res.status(403).json(formatResponse(false, "Only admin can view teacher attendance"));
    }

    if (!teacherId) {
      return res.status(400).json(formatResponse(false, "teacherId is required"));
    }

    // Build filter
    const filter = {
      user: teacherId,
      school: currentUserSchool,
    };

    if (month && year) {
      const range = buildIstMonthRange(Number(year), Number(month));
      if (range.error) {
        return res.status(400).json(formatResponse(false, range.error));
      }
      filter.date = {
        $gte: range.startDate,
        $lte: range.endDate,
      };
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate("user", "name email")
      .sort({ date: -1 });

    if (attendanceRecords.length === 0) {
      return res.status(404).json(formatResponse(false, "No attendance records found for this teacher"));
    }

    const summary = {
      total: attendanceRecords.length,
      present: attendanceRecords.filter((a) => a.status === "present").length,
      absent: attendanceRecords.filter((a) => a.status === "absent").length,
      leave: attendanceRecords.filter((a) => a.status === "leave").length,
    };

    return res.status(200).json(
      formatResponse(true, "Teacher attendance records fetched successfully", {
        attendance: attendanceRecords,
        summary,
        filters: { month, year },
      })
    );
  } catch (error) {
    console.error("Error fetching teacher attendance:", error);
    return res.status(500).json(formatResponse(false, "Error fetching teacher attendance", null, error.message));
  }
};

const getClassAttendanceDashboardSummary = async (req, res) => {
  try {
    const { classId, startDate: startDateValue, endDate: endDateValue, status = "all" } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    const dateRange = parseDashboardDateRange(startDateValue, endDateValue);
    if (dateRange.error) {
      return res.status(400).json(formatResponse(false, dateRange.error));
    }

    const accessResult = await ensureClassDashboardAccess({
      classId,
      currentUserId,
      currentUserRole,
      currentUserSchool,
    });

    if (accessResult.response) {
      return res.status(accessResult.status).json(accessResult.response);
    }

    const { classDoc } = accessResult;
    const students = await Student.find({ class: classId }).select("_id user rollNumber status").lean();
    const userIds = students.map((student) => student.user).filter(Boolean);

    const attendanceFilter = {
      school: currentUserSchool,
      date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
      user: { $in: userIds },
    };

    if (status && status !== "all") {
      attendanceFilter.status = status;
    }

    const attendanceRecords = userIds.length > 0 ? await Attendance.find(attendanceFilter).select("status").lean() : [];

    const totalPresent = attendanceRecords.filter((record) => record.status === "present").length;
    const totalAbsent = attendanceRecords.filter((record) => record.status === "absent").length;
    const totalLeave = attendanceRecords.filter((record) => record.status === "leave").length;
    const totalMarked = attendanceRecords.length;
    const totalStudents = students.length;
    const dateKeys = getDateKeysInRange(dateRange.startDate, dateRange.endDate);
    const expectedRecords = totalStudents * dateKeys.length;
    const totalNotMarked = Math.max(expectedRecords - totalMarked, 0);
    const attendanceRate = expectedRecords > 0 ? Number(((totalPresent / expectedRecords) * 100).toFixed(2)) : 0;

    return res.status(200).json(
      formatResponse(true, "Class attendance dashboard summary fetched successfully", {
        classInfo: {
          _id: classDoc._id,
          name: classDoc.name,
          grade: classDoc.grade,
          section: classDoc.section,
          classTeacher: classDoc?.classTeacher
            ? {
                _id: classDoc.classTeacher._id,
                name: classDoc?.classTeacher?.user?.name || "Unassigned",
              }
            : null,
        },
        summary: {
          totalStudents,
          totalMarked,
          totalPresent,
          totalAbsent,
          totalLeave,
          totalNotMarked,
          attendanceRate,
        },
        filters: {
          classId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          status,
        },
      })
    );
  } catch (error) {
    console.error("Error fetching class attendance dashboard summary:", error);
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching class attendance dashboard summary", null, error.message));
  }
};

const getClassAttendanceDashboardMatrix = async (req, res) => {
  try {
    const {
      classId,
      startDate: startDateValue,
      endDate: endDateValue,
      status = "all",
      studentSearch = "",
    } = req.query;

    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    const dateRange = parseDashboardDateRange(startDateValue, endDateValue);
    if (dateRange.error) {
      return res.status(400).json(formatResponse(false, dateRange.error));
    }

    const accessResult = await ensureClassDashboardAccess({
      classId,
      currentUserId,
      currentUserRole,
      currentUserSchool,
    });

    if (accessResult.response) {
      return res.status(accessResult.status).json(accessResult.response);
    }

    const dateKeys = getDateKeysInRange(dateRange.startDate, dateRange.endDate);
    const students = await Student.find({ class: classId })
      .populate({ path: "user", select: "_id name email" })
      .select("_id user rollNumber status")
      .lean();

    const userIds = students.map((student) => student?.user?._id || student?.user).filter(Boolean);
    const attendanceFilter = {
      school: currentUserSchool,
      date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
      user: { $in: userIds },
    };

    if (status && status !== "all") {
      attendanceFilter.status = status;
    }

    const attendanceRecords = userIds.length > 0
      ? await Attendance.find(attendanceFilter).select("user status date remarks").sort({ date: 1 }).lean()
      : [];

    const attendanceMap = new Map();
    attendanceRecords.forEach((record) => {
      const userKey = record.user.toString();
      const dayKey = formatDateKey(record.date);
      if (!attendanceMap.has(userKey)) {
        attendanceMap.set(userKey, new Map());
      }
      attendanceMap.get(userKey).set(dayKey, record);
    });

    const searchTerm = String(studentSearch || "").trim().toLowerCase();
    const matrix = students
      .map((student) => {
        const userId = (student?.user?._id || student?.user)?.toString();
        const userAttendance = attendanceMap.get(userId) || new Map();

        const statusByDate = {};
        let presentCount = 0;
        let absentCount = 0;
        let leaveCount = 0;

        dateKeys.forEach((dayKey) => {
          const dayRecord = userAttendance.get(dayKey);
          if (!dayRecord) {
            statusByDate[dayKey] = "not-marked";
            return;
          }

          statusByDate[dayKey] = dayRecord.status;

          if (dayRecord.status === "present") presentCount += 1;
          if (dayRecord.status === "absent") absentCount += 1;
          if (dayRecord.status === "leave") leaveCount += 1;
        });

        const totalMarked = presentCount + absentCount + leaveCount;
        const totalDays = dateKeys.length;
        const attendancePercentage = totalDays > 0 ? Number(((presentCount / totalDays) * 100).toFixed(2)) : 0;

        return {
          studentId: student._id,
          userId,
          studentName: student?.user?.name || "Unknown",
          rollNumber: student?.rollNumber || "N/A",
          studentStatus: student?.status || "active",
          totals: {
            totalDays,
            totalMarked,
            present: presentCount,
            absent: absentCount,
            leave: leaveCount,
            notMarked: Math.max(totalDays - totalMarked, 0),
            attendancePercentage,
          },
          statusByDate,
        };
      })
      .filter((row) => {
        if (!searchTerm) return true;
        return (
          row.studentName.toLowerCase().includes(searchTerm) ||
          String(row.rollNumber).toLowerCase().includes(searchTerm)
        );
      })
      .sort((a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));

    return res.status(200).json(
      formatResponse(true, "Class attendance matrix fetched successfully", {
        classInfo: {
          _id: accessResult.classDoc._id,
          name: accessResult.classDoc.name,
          grade: accessResult.classDoc.grade,
          section: accessResult.classDoc.section,
        },
        dateKeys,
        matrix,
        filters: {
          classId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          status,
          studentSearch,
        },
      })
    );
  } catch (error) {
    console.error("Error fetching class attendance dashboard matrix:", error);
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching class attendance dashboard matrix", null, error.message));
  }
};

const getClassAttendanceDashboardTrend = async (req, res) => {
  try {
    const { classId, startDate: startDateValue, endDate: endDateValue } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    const dateRange = parseDashboardDateRange(startDateValue, endDateValue);
    if (dateRange.error) {
      return res.status(400).json(formatResponse(false, dateRange.error));
    }

    const accessResult = await ensureClassDashboardAccess({
      classId,
      currentUserId,
      currentUserRole,
      currentUserSchool,
    });

    if (accessResult.response) {
      return res.status(accessResult.status).json(accessResult.response);
    }

    const students = await Student.find({ class: classId }).select("user").lean();
    const userIds = students.map((student) => student.user).filter(Boolean);
    const dateKeys = getDateKeysInRange(dateRange.startDate, dateRange.endDate);

    const attendanceRecords = userIds.length > 0
      ? await Attendance.find({
          school: currentUserSchool,
          user: { $in: userIds },
          date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        })
          .select("status date")
          .lean()
      : [];

    const trendMap = new Map(
      dateKeys.map((dateKey) => [
        dateKey,
        {
          date: dateKey,
          present: 0,
          absent: 0,
          leave: 0,
          marked: 0,
          notMarked: students.length,
          attendanceRate: 0,
        },
      ])
    );

    attendanceRecords.forEach((record) => {
      const dayKey = formatDateKey(record.date);
      const entry = trendMap.get(dayKey);
      if (!entry) return;

      if (record.status === "present") entry.present += 1;
      if (record.status === "absent") entry.absent += 1;
      if (record.status === "leave") entry.leave += 1;
      entry.marked += 1;
      entry.notMarked = Math.max(students.length - entry.marked, 0);
      entry.attendanceRate = students.length > 0 ? Number(((entry.present / students.length) * 100).toFixed(2)) : 0;
    });

    return res.status(200).json(
      formatResponse(true, "Class attendance trend fetched successfully", {
        classInfo: {
          _id: accessResult.classDoc._id,
          name: accessResult.classDoc.name,
          grade: accessResult.classDoc.grade,
          section: accessResult.classDoc.section,
        },
        trend: Array.from(trendMap.values()),
        filters: {
          classId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      })
    );
  } catch (error) {
    console.error("Error fetching class attendance dashboard trend:", error);
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching class attendance dashboard trend", null, error.message));
  }
};

const getClassAttendanceDashboardStatusBreakdown = async (req, res) => {
  try {
    const { classId, startDate: startDateValue, endDate: endDateValue } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    const dateRange = parseDashboardDateRange(startDateValue, endDateValue);
    if (dateRange.error) {
      return res.status(400).json(formatResponse(false, dateRange.error));
    }

    const accessResult = await ensureClassDashboardAccess({
      classId,
      currentUserId,
      currentUserRole,
      currentUserSchool,
    });

    if (accessResult.response) {
      return res.status(accessResult.status).json(accessResult.response);
    }

    const students = await Student.find({ class: classId }).select("user").lean();
    const userIds = students.map((student) => student.user).filter(Boolean);
    const dateKeys = getDateKeysInRange(dateRange.startDate, dateRange.endDate);
    const totalExpected = students.length * dateKeys.length;

    const attendanceRecords = userIds.length > 0
      ? await Attendance.find({
          school: currentUserSchool,
          user: { $in: userIds },
          date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        })
          .select("status")
          .lean()
      : [];

    const present = attendanceRecords.filter((record) => record.status === "present").length;
    const absent = attendanceRecords.filter((record) => record.status === "absent").length;
    const leave = attendanceRecords.filter((record) => record.status === "leave").length;
    const marked = attendanceRecords.length;
    const notMarked = Math.max(totalExpected - marked, 0);

    const asPercentage = (value) => (totalExpected > 0 ? Number(((value / totalExpected) * 100).toFixed(2)) : 0);

    return res.status(200).json(
      formatResponse(true, "Class attendance status breakdown fetched successfully", {
        classInfo: {
          _id: accessResult.classDoc._id,
          name: accessResult.classDoc.name,
          grade: accessResult.classDoc.grade,
          section: accessResult.classDoc.section,
        },
        totals: {
          expected: totalExpected,
          marked,
          present,
          absent,
          leave,
          notMarked,
        },
        percentages: {
          present: asPercentage(present),
          absent: asPercentage(absent),
          leave: asPercentage(leave),
          notMarked: asPercentage(notMarked),
        },
        filters: {
          classId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      })
    );
  } catch (error) {
    console.error("Error fetching class attendance status breakdown:", error);
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching class attendance status breakdown", null, error.message));
  }
};

const getTodayAttendace = async (req, res) => {
  try {
    const targetUser = req.params.id;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    // Verify target user exists
    const user = await User.findById(targetUser).populate('role', 'role');
    if (!user) {
      return res.status(404).json(formatResponse(false, "User not found"));
    }

    // Check authorization
    const isAdmin = currentUserRole === "admin";
    const isTeacher = currentUserRole === "teacher";
    const isSameUser = user._id.toString() === currentUserId.toString();

    // Authorization logic:
    // - Admin can view anyone
    // - Teacher can view students and themselves
    // - Others can only view themselves
    if (!isAdmin && !isSameUser && !(isTeacher && user.role.role === 'student')) {
      return res.status(403).json(formatResponse(false, "You do not have permission to view this attendance"));
    }

    // Calculate today's date range correctly
    const today = momentIst();
    const startOfDay = today.clone().startOf("day").toDate();
    const endOfDay = today.clone().endOf("day").toDate();

    // Build filter with correct date range
    const filter = {
      user: targetUser,
      school: currentUserSchool,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };
    // console.log("Fetching today's attendance with filter:", filter);

    // Fetch attendance records
    const attendanceRecords = await Attendance.find(filter)
      .populate("user", "_id name email")
      .sort({ date: -1 });

    // Calculate summary
    // console.log("Today's attendance records:", attendanceRecords);
    const summary = {
      total: attendanceRecords.length,
      present: attendanceRecords.filter((a) => a.status === "present").length,
      absent: attendanceRecords.filter((a) => a.status === "absent").length,
      leave: attendanceRecords.filter((a) => a.status === "leave").length,
      notMarked: attendanceRecords.length === 0 ? 1 : 0,
    };

    return res.status(200).json(
      formatResponse(true, "Today's attendance records fetched successfully", {
        attendance: attendanceRecords,
        summary,
        filters: { startOfDay, endOfDay },
      })
    );
  } catch (error) {
    console.error("Error fetching today's attendance:", error);
    return res.status(500).json(formatResponse(false, "Error fetching today's attendance", null, error.message));
  }
};

// ==================== GET TODAY ATTENDANCE FOR CLASS ====================
/**
 * Get today's attendance for all students in a class
 * Each student appears in result; unmarked students have status "not-marked"
 * Admin: any class in school
 * Teacher: classes they are assigned to teach
 */
const getTodayClassAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    if (!classId) {
      return res.status(400).json(formatResponse(false, "classId is required in path"));
    }

    // Verify class exists and belongs to school
    const classDoc = await Class.findById(classId)
      .populate({
        path: "classTeacher",
        populate: { path: "user", select: "_id name" }
      })
      .lean();

    if (!classDoc) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (classDoc.school.toString() !== currentUserSchool.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    // Teacher access check - reuse dashboard access pattern
    if (currentUserRole === "teacher") {
      const accessResult = await ensureClassDashboardAccess({
        classId,
        currentUserId,
        currentUserRole,
        currentUserSchool,
      });
      if (accessResult.response) {
        return res.status(accessResult.status).json(accessResult.response);
      }
    }

    // Calculate today's date range
    const today = momentIst();
    const startOfDay = today.clone().startOf("day").toDate();
    const endOfDay = today.clone().endOf("day").toDate();

    // Fetch all students in class
    const students = await Student.find({ class: classId })
      .populate({ path: "user", select: "_id name email phone" })
      .select("_id user rollNumber studentId fatherName motherName status")
      .lean();

    const userIds = students.map(s => s.user?._id).filter(Boolean);

    // Fetch today's attendance for those students.
    // Do not require `class` here because some attendance records may have been
    // saved without the class field, but the student is still enrolled in this class.
    const attendanceRecords = userIds.length > 0
      ? await Attendance.find({
          user: { $in: userIds },
          date: { $gte: startOfDay, $lte: endOfDay },
          school: currentUserSchool,
        })
          .select("user status remarks class")
          .lean()
      : [];

    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      attendanceMap.set(record.user.toString(), record);
    });

    // Map students with attendance status
    const studentAttendance = students.map(student => {
      const userIdStr = student.user?._id?.toString();
      const attendance = attendanceMap.get(userIdStr);
      return {
        studentId: student._id,
        userId: userIdStr,
        name: student.user?.name,
        email: student.user?.email,
        image: student.user?.image || null,
        phone: student.user?.phone,
        rollNumber: student.rollNumber,
        studentIdCode: student.studentId,
        studentId: student.studentId,
        fatherName: student.fatherName,
        motherName: student.motherName,
        status: attendance?.status || "not-marked",
        remarks: attendance?.remarks || null
      };
    }).sort((a, b) => {
      const aRoll = String(a.rollNumber).padStart(10, '0');
      const bRoll = String(b.rollNumber).padStart(10, '0');
      return aRoll.localeCompare(bRoll, undefined, { numeric: true });
    });

    const summary = {
      totalStudents: students.length,
      present: attendanceRecords.filter(a => a.status === "present").length,
      absent: attendanceRecords.filter(a => a.status === "absent").length,
      leave: attendanceRecords.filter(a => a.status === "leave").length,
      notMarked: students.length - attendanceRecords.length
    };

    return res.status(200).json(
      formatResponse(true, "Today's class attendance fetched successfully", {
        classInfo: {
          _id: classDoc._id,
          name: classDoc.name,
          grade: classDoc.grade,
          section: classDoc.section
        },
        date: formatDateKey(today),
        attendance: studentAttendance,
        summary
      })
    );
  } catch (error) {
    console.error("Error fetching today's class attendance:", error);
    return res.status(500).json(formatResponse(false, "Error fetching today's class attendance", null, error.message));
  }
};

// ============ GET TODAY ATTENDANCE FOR ANY ROLE EXCEPT THE STUDENDT ========
/**
 * Get today's attendance for all User have same role in a school
 * Each User appears in result; unmarked students have status "not-marked"
 * Admin: any class in school
 */

const getTodayAttendanceRole = async (req, res) => {
  try {
    // accept role from either path param or query
    const role = req.params.role || req.query.role;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    if(currentUserRole !== 'admin'){
       return res.status(402).json(formatResponse(false, "Only admin can access this Feactures"));
    }

    if (!role) {
      return res.status(400).json(formatResponse(false, "Role is required in path"));
    }
    const roleRec = await Role.findOne({role:role});

    if(!roleRec){
        return res.status(400).json(formatResponse(false, "Role is required in path"));
    }


    // Calculate today's date range
    const today = momentIst();
    const startOfDay = today.clone().startOf("day").toDate();
    const endOfDay = today.clone().endOf("day").toDate();

    // Fetch all students in class
    const users = await User.find({ role: roleRec._id, school: currentUserSchool })
      .select("_id username name email phone image")
      .lean();

    const userIds = users.map(u => u._id).filter(Boolean);

    // Fetch today's attendance for those students
    const attendanceRecords = userIds.length > 0
      ? await Attendance.find({
          user: { $in: userIds },
          date: { $gte: startOfDay, $lte: endOfDay },
          school: currentUserSchool,
        })
          .select("user status remarks")
          .lean()
      : [];

    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      attendanceMap.set(record.user.toString(), record);
    });

    // Merge role-specific meta (teacher/admin/staff) so frontend gets richer payload
    const roleMetaMap = new Map();
    try {
      const Teacher = require('../models/teacher');
      const Staff = require('../models/staff');
      const Admin = require('../models/admin');
      const userIds = users.map(u => u._id).filter(Boolean);

      if (roleRec.role === 'teacher') {
        const teacherDocs = await Teacher.find({ user: { $in: userIds } })
          .populate({ path: 'classTeacher', select: '_id name section' })
          .lean();
        teacherDocs.forEach(td => {
          if (td.user) roleMetaMap.set(td.user.toString(), td);
        });
      } else if (roleRec.role === 'staff') {
        const staffDocs = await Staff.find({ user: { $in: userIds } }).lean();
        staffDocs.forEach(sd => {
          if (sd.user) roleMetaMap.set(sd.user.toString(), sd);
        });
      } else if (roleRec.role === 'admin') {
        const adminDocs = await Admin.find({ user: { $in: userIds } }).lean();
        adminDocs.forEach(ad => {
          if (ad.user) roleMetaMap.set(ad.user.toString(), ad);
        });
      }
    } catch (err) {
      // if role-specific models are missing, continue with basic user info
      console.warn('Could not load role meta models for getTodayAttendanceRole', err?.message || err);
    }

    // Map users with attendance status and attach role meta where available
    const usersAttendeces = users.map(user => {
      const userIdStr = user._id?.toString();
      const attendance = attendanceMap.get(userIdStr);
      const meta = roleMetaMap.get(userIdStr) || null;
      return {
        _id: user._id,
        userId: userIdStr,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        image: user.image || null,
        status: attendance?.status || "not-marked",
        remarks: attendance?.remarks || null,
        roleMeta: meta,
      };
    });

    const summary = {
      totalUsers: users.length,
      present: attendanceRecords.filter(a => a.status === "present").length,
      absent: attendanceRecords.filter(a => a.status === "absent").length,
      leave: attendanceRecords.filter(a => a.status === "leave").length,
      notMarked: users.length - attendanceRecords.length
    };

    return res.status(200).json(
      formatResponse(true, "Today's class attendance fetched successfully", {
        date: formatDateKey(today),
        attendance: usersAttendeces,
        summary
      })
    );
  } catch (error) {
    console.error("Error fetching today's attendance for ROLE:", error);
    return res.status(500).json(formatResponse(false, "Error fetching today's class attendance", null, error.message));
  }
};

// ==================== BULK MARK ATTENDANCE ====================
/**
 * Bulk mark/update attendance for multiple students
 * Admin: can mark any user in school
 * Teacher: can mark only students in school
 * Overwrites existing attendance for same user+date combo
 */
const bulkMarkAttendance = async (req, res) => {
  try {
    const { records, date } = req.body;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    if (!currentUserSchool) {
      return res.status(400).json(formatResponse(false, "Your account is not associated with any school"));
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json(formatResponse(false, "records array is required and must not be empty"));
    }

    // Determine attendance date: use provided date or default to today
    let attendanceDate = momentIst().startOf("day").toDate();
    console.log("Bulk marking attendance. Provided date:", date);
    if (date) {
      const parsedDate = momentIst(date).startOf("day");
      if (!parsedDate.isValid()) {
        return res.status(400).json(formatResponse(false, "Invalid date value"));
      }
      attendanceDate = parsedDate.toDate();
    }
    console.log("Bulk marking attendance for date (IST):", formatDateKey(attendanceDate));

    // Validate all records
    const validatedRecords = [];
    const uniqueUserIds = new Set();
    for (const record of records) {
      if (!record.userId || !record.status) {
        return res.status(400).json(formatResponse(false, "Each record must have userId and status"));
      }
      if (!["present", "absent", "leave"].includes(record.status)) {
        return res.status(400).json(formatResponse(false, `Invalid status: ${record.status}. Must be: present, absent, or leave`));
      }
      if (!uniqueUserIds.has(record.userId)) {
        uniqueUserIds.add(record.userId);
        validatedRecords.push({
          userId: record.userId,
          status: record.status,
          remarks: record.remarks || null,
          classId: record.classId || null
        });
      }
    }

    // Fetch all target users
    const users = await User.find({ _id: { $in: Array.from(uniqueUserIds) } })
      .populate("role", "role")
      .populate("school", "_id");

    if (users.length !== validatedRecords.length) {
      return res.status(404).json(formatResponse(false, "One or more user IDs do not exist"));
    }

    // Verify all users are in same school
    for (const user of users) {
      if (user.school._id.toString() !== currentUserSchool.toString()) {
        return res.status(403).json(formatResponse(false, `User ${user._id} is not in your school`));
      }
    }

    // Authorization: Teacher can only mark students
    if (currentUserRole === "teacher") {
      for (const user of users) {
        if (user.role.role !== "student") {
          return res.status(403).json(formatResponse(false, `Teacher can only mark attendance for students`));
        }
      }
    }

    // Perform upsert for each record
    const results = {
      processed: 0,
      created: [],
      updated: [],
      failed: []
    };

    for (const record of validatedRecords) {
      try {
        const existingAttendance = await Attendance.findOne({
          user: record.userId,
          date: attendanceDate,
          school: currentUserSchool
        });
        // console.log("Existing record date (IST):", existingAttendance ? formatDateKey(existingAttendance.date) : "none");
        if (existingAttendance) {
          // Update existing record
          // console.log(`Updating attendance for user ${record.userId} on ${formatDateKey(attendanceDate)}`);
          existingAttendance.status = record.status;
          existingAttendance.remarks = record.remarks;
          existingAttendance.updatedBy = currentUserId;
          existingAttendance.class = record.classId || existingAttendance.class;
          existingAttendance.updatedAt = momentIst().toDate();
          existingAttendance.date = attendanceDate; // Ensure date is consistent
          await existingAttendance.save();
          results.updated.push({
            userId: record.userId,
            status: record.status,
            action: "updated"
          });
        } else {
          // Create new record
          // console.log("Creating attendance for date (IST):", formatDateKey(attendanceDate));
          const newAttendance = await Attendance.create({
            user: record.userId,
            status: record.status,
            remarks: record.remarks,
            date: attendanceDate,
            school: currentUserSchool,
            class: record.classId || null,
            createdBy: currentUserId,
            updatedBy: currentUserId
          });
          results.created.push({
            userId: record.userId,
            status: record.status,
            action: "created"
          });
        }
        results.processed += 1;
      } catch (error) {
        results.failed.push({
          userId: record.userId,
          error: error.message
        });
      }
    }

    return res.status(200).json(
      formatResponse(true, "Bulk attendance processed successfully", {
        date: formatDateKey(attendanceDate),
        results: {
          totalProcessed: results.processed,
          totalCreated: results.created.length,
          totalUpdated: results.updated.length,
          totalFailed: results.failed.length,
          details: {
            created: results.created,
            updated: results.updated,
            failed: results.failed
          }
        }
      })
    );
  } catch (error) {
    console.error("Error processing bulk attendance:", error);
    return res.status(500).json(formatResponse(false, "Error processing bulk attendance", null, error.message));
  }
};

// ==================== GET CLASS ATTENDANCE CSV ====================
/**
 * Export class attendance as CSV for date range
 * Admin: any class in school
 * Teacher: classes they are assigned to teach
 * Returns CSV file download
 */
const getClassAttendanceCSV = async (req, res) => {
  try {
    const { classId, startDate: startDateValue, endDate: endDateValue } = req.query;
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    const currentUserSchool = req.user.school._id;

    if (!classId || !startDateValue || !endDateValue) {
      return res.status(400).json(formatResponse(false, "classId, startDate, and endDate are required"));
    }

    const dateRange = parseDashboardDateRange(startDateValue, endDateValue);
    if (dateRange.error) {
      return res.status(400).json(formatResponse(false, dateRange.error));
    }

    // Verify class exists and access
    const accessResult = await ensureClassDashboardAccess({
      classId,
      currentUserId,
      currentUserRole,
      currentUserSchool,
    });

    if (accessResult.response) {
      return res.status(accessResult.status).json(accessResult.response);
    }

    const { classDoc } = accessResult;

    // Fetch all students in class
    const students = await Student.find({ class: classId })
      .populate({ path: "user", select: "_id name email phone" })
      .select("_id user rollNumber studentId")
      .lean();

    const userIds = students.map(s => s.user?._id).filter(Boolean);

    // Fetch attendance records in date range
    const attendanceRecords = userIds.length > 0
      ? await Attendance.find({
          user: { $in: userIds },
          date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
          school: currentUserSchool,
          class: classId
        })
          .select("user date status remarks")
          .lean()
      : [];

    // Generate date keys for the range
    const dateKeys = getDateKeysInRange(dateRange.startDate, dateRange.endDate);

    // Build attendance map for quick lookup
    const attendanceMap = new Map();
    attendanceRecords.forEach(record => {
      const key = `${record.user.toString()}_${formatDateKey(record.date)}`;
      attendanceMap.set(key, record);
    });

    // Build CSV
    const csvHeader = ["Date", "StudentID", "RollNumber", "Name", "Email", "Phone", "Status", "Remarks"];
    const csvRows = [csvHeader.join(",")];

    // One row per student per date
    for (const dateKey of dateKeys) {
      for (const student of students) {
        const userIdStr = student.user?._id?.toString();
        const mapKey = `${userIdStr}_${dateKey}`;
        const attendance = attendanceMap.get(mapKey);
        const status = attendance?.status || "not-marked";
        const remarks = attendance?.remarks ? `"${attendance.remarks.replace(/"/g, '""')}"` : "";

        const row = [
          dateKey,
          student.studentId || "",
          student.rollNumber || "",
          student.user?.name || "",
          student.user?.email || "",
          student.user?.phone || "",
          status,
          remarks
        ].map(cell => {
          if (typeof cell === "string" && (cell.includes(",") || cell.includes('"') || cell.includes("\n"))) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(",");

        csvRows.push(row);
      }
    }

    const csvContent = csvRows.join("\n");
    const filename = `attendance-${classDoc.name}-${formatDateKey(dateRange.startDate)}_to_${formatDateKey(dateRange.endDate)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    return res.send(csvContent);
  } catch (error) {
    console.error("Error exporting class attendance CSV:", error);
    return res.status(500).json(formatResponse(false, "Error exporting attendance", null, error.message));
  }
};

module.exports = {
  markAttendance,
  getAttendance,
  getClassAttendance,
  getStaffAttendance,
  getTeacherAttendance,
  getClassAttendanceDashboardSummary,
  getClassAttendanceDashboardMatrix,
  getClassAttendanceDashboardTrend,
  getClassAttendanceDashboardStatusBreakdown,
  getTodayAttendace,
  getTodayAttendanceRole,
  updateAttendance,
  getTodayClassAttendance,
  bulkMarkAttendance,
  getClassAttendanceCSV
};