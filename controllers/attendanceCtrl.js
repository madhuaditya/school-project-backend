const Attendance = require("../models/Attendance");
const User = require("../models/user");
const Class = require("../models/class");

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
      date: new Date(date).setHours(0, 0, 0, 0),
      school: schoolId
    });
    let createdBy = currentUserId;
    
    if (existingAttendance) {
     createdBy = existingAttendance.createdBy;
    }

    if(currentUserRole === 'admin' ){
      const newAttendance = await Attendance.create({
        user: userId,
        status,
        date: new Date(date).setHours(0, 0, 0, 0),
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
        date: new Date(date).setHours(0, 0, 0, 0),
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
        date: new Date(date).setHours(0, 0, 0, 0),
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
      date: new Date(date).setHours(0, 0, 0, 0),
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
      return res.status(404).json(formatResponse(false, "No attendance records found"));
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

const getTodayAttendace = async (req, res) => {
  try {
    const targetUser = req.params.id;
    // console.log("Target user for today's attendance: ", targetUser);
    const currentUserId = req.user._id;
    const currentUserRole = req.user.role.role;
    // console.log("Current user role: ", currentUserRole);
    const currentUserSchool = req.user.school._id;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const user = await User.findById(targetUser).populate('role', 'role');
    // console.log("User for today's attendance: ", user.name, " with role ", user.role.role);
    if(!user) {
      return res.status(404).json(formatResponse(false, "User not found"));
    }

    // Build filter
    const filter = {
      user: targetUser,
      school: currentUserSchool,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    };

    if(currentUserRole === "admin" || currentUserRole === "teacher") {
      if(currentUserRole === 'admin') {
        const attendanceRecords = await Attendance.find(filter)
          .populate("user", "_id name email")
          .sort({ date: -1 });

          // console.log("Attendance records for today: ", attendanceRecords);

        if (attendanceRecords.length === 0) {
          return res.status(404).json(formatResponse(false, "No attendance records found for today"));
        }
        
        const summary = {
          total: attendanceRecords.length,
          present: attendanceRecords.filter((a) => a.status === "present").length,
          absent: attendanceRecords.filter((a) => a.status === "absent").length,
          leave: attendanceRecords.filter((a) => a.status === "leave").length,
        };

        return res.status(200).json(
          formatResponse(true, "Today's attendance records fetched successfully", {
            attendance: attendanceRecords,
            summary,
            filters: { startOfDay, endOfDay },
          })
        );
      } else if((user.role.role === 'student') && currentUserRole === 'teacher') {
        const attendanceRecords = await Attendance.find(filter)
          .populate("user", "_id name email")
          .sort({ date: -1 });

        if (attendanceRecords.length === 0) {
          return res.status(404).json(formatResponse(false, "No attendance records found for today"));
        }
        
        const summary = {
          total: attendanceRecords.length,
          present: attendanceRecords.filter((a) => a.status === "present").length,
          absent: attendanceRecords.filter((a) => a.status === "absent").length,
          leave: attendanceRecords.filter((a) => a.status === "leave").length,
        };

        return res.status(200).json(
          formatResponse(true, "Today's attendance records fetched successfully", {
            attendance: attendanceRecords,
            summary,
            filters: { startOfDay, endOfDay },
          })
        );
      } else if(user._id.toString() === currentUserId.toString()) {
        const attendanceRecords = await Attendance.find(filter)
          .populate("user", "_id name email")
          .sort({ date: -1 });
          // console.log("Attendance records for today: ", attendanceRecords);
          
        if (attendanceRecords.length === 0) {
          return res.status(404).json(formatResponse(false, "No attendance records found for today"));
        }
        
        const summary = {
          total: attendanceRecords.length,
          present: attendanceRecords.filter((a) => a.status === "present").length,
          absent: attendanceRecords.filter((a) => a.status === "absent").length,
          leave: attendanceRecords.filter((a) => a.status === "leave").length,
        };

        return res.status(200).json(
          formatResponse(true, "Today's attendance records fetched successfully", {
            attendance: attendanceRecords,
            summary,
            filters: { startOfDay, endOfDay },
          })
        );
      } else {
        return res.status(403).json(formatResponse(false, "Your role is not suitable to get attendance"));
      }
    } else {
      if(user._id.toString() !== currentUserId.toString()) {
        return res.status(403).json(formatResponse(false, "You can only view your own attendance"));
      }
      
      const attendanceRecords = await Attendance.find(filter)
        .populate("user", "_id name email")
        .sort({ date: -1 });

      if (attendanceRecords.length === 0) {
        return res.status(404).json(formatResponse(false, "No attendance records found for today"));
      }
      
      const summary = {
        total: attendanceRecords.length,
        present: attendanceRecords.filter((a) => a.status === "present").length,
        absent: attendanceRecords.filter((a) => a.status === "absent").length,
        leave: attendanceRecords.filter((a) => a.status === "leave").length,
      };

      return res.status(200).json(
        formatResponse(true, "Today's attendance records fetched successfully", {
          attendance: attendanceRecords,
          summary,
          filters: { startOfDay, endOfDay },
        })
      );
    }
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
  getTodayAttendace,
  updateAttendance
};