const express = require("express");
const {
  markAttendance,
  getAttendance,
  getClassAttendance,
  getStaffAttendance,
  getTeacherAttendance,
} = require("../controllers/attendanceCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

// All routes require authentication
router.use(validateUser);

// ==================== MARK & MANAGE ATTENDANCE ====================
// Admin: can mark for any student/staff/teacher
// Teacher: can mark for students in their class and themselves
// Staff: can mark only for themselves
router.post("/mark",allow("admin", 'teacher', 'staff' ), markAttendance);

// ==================== GET ATTENDANCE ====================
// Get own attendance or (if admin) any user's attendance
// Query: ?userId=<id>&month=<1-12>&year=<YYYY>
// Month and year optional for filtering
router.get("/", allow("admin", 'teacher', 'staff'), getAttendance);

// ==================== CLASS ATTENDANCE ====================
// Get attendance for entire class
// Only class teacher or admin can access
// Query: ?classId=<id>&month=<1-12>&year=<YYYY>
router.get("/class", allow("admin", 'teacher'), getClassAttendance);

// ==================== STAFF ATTENDANCE ====================
// Get staff member's attendance (Admin only)
// Query: ?staffId=<id>&month=<1-12>&year=<YYYY>
router.get("/staff", allow("admin"), getStaffAttendance);

// ==================== TEACHER ATTENDANCE ====================
// Get teacher's attendance (Admin only)
// Query: ?teacherId=<id>&month=<1-12>&year=<YYYY>
router.get("/teacher", allow("admin"), getTeacherAttendance);

module.exports = router;