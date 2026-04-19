const Attendance = require("../models/attendance");
const User = require("../models/user");
const Class = require("../models/class");
const Student = require("../models/student");
const Teacher = require("../models/teacher");

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
  const startDate = new Date(startDateValue);
  const endDate = new Date(endDateValue);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "Invalid startDate or endDate" };
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  if (startDate > endDate) {
    return { error: "startDate cannot be greater than endDate" };
  }

  return { startDate, endDate };
};

const formatDateKey = (value) => {
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
};

const getDateKeysInRange = (startDate, endDate) => {
  const keys = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
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

    const attendanceDate = new Date(date);
    if (Number.isNaN(attendanceDate.getTime())) {
      return res.status(400).json(formatResponse(false, "Invalid date value"));
    }
    attendanceDate.setHours(0, 0, 0, 0);

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
      return res.status(409).json(
        formatResponse(false, "Attendance already marked for this user and date", existingAttendance)
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

    const attendanceDate = new Date(date);
    if (Number.isNaN(attendanceDate.getTime())) {
      return res.status(400).json(formatResponse(false, "Invalid date value"));
    }
    attendanceDate.setHours(0, 0, 0, 0);

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
      return res.status(200).json(formatResponse(true, "Attendance updated successfully", existingAttendance));
    } else if (currentUserRole === "teacher" && (targetUser.role.role === "student" || targetUser._id.toString() === currentUserId.toString())) {
      existingAttendance.status = status;
      existingAttendance.remarks = remarks || null;
      existingAttendance.updatedBy = currentUserId;
      await existingAttendance.save();
      return res.status(200).json(formatResponse(true, "Attendance updated successfully", existingAttendance));
    } else if (currentUserRole === "staff" && targetUser._id.toString() === currentUserId.toString()) {
      existingAttendance.status = status;
      existingAttendance.remarks = remarks || null;
      existingAttendance.updatedBy = currentUserId;
      await existingAttendance.save();
      return res.status(200).json(formatResponse(true, "Attendance updated successfully", existingAttendance));
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
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      filter.date = {
        $gte: startDate,
        $lte: endDate,
      };
    } else if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      filter.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate("user", "_id name email phone")
      .populate("class", " _id name grade section")
      .populate("createdBy", " _id name")
      .populate("updatedBy", " _id name")
      .sort({ date: -1 });

    if (attendanceRecords.length === 0) {
      return res.status(200).json(formatResponse(false, "No attendance records found"));
    }

    // Calculate summary
    const summary = {
      total: attendanceRecords.length,
      present: attendanceRecords.filter((a) => a.status === "present").length,
      absent: attendanceRecords.filter((a) => a.status === "absent").length,
      leave: attendanceRecords.filter((a) => a.status === "leave").length,
      presentPercentage: (
        (attendanceRecords.filter((a) => a.status === "present").length /
          attendanceRecords.length) *
        100
      ).toFixed(2),
    };

    return res.status(200).json(
      formatResponse(true, "Attendance records fetched successfully", {
        attendance: attendanceRecords,
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
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      filter.date = {
        $gte: startDate,
        $lte: endDate,
      };
    } else if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      filter.date = {
        $gte: startDate,
        $lte: endDate,
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
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      filter.date = {
        $gte: startDate,
        $lte: endDate,
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
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      filter.date = {
        $gte: startDate,
        $lte: endDate,
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
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

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
  updateAttendance
};