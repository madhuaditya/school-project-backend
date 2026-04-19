const express = require("express");
const {
  markAttendance,
  getAttendance,
  getClassAttendance,
  getStaffAttendance,
  getTeacherAttendance,
  updateAttendance,
  getTodayAttendace,
  getClassAttendanceDashboardSummary,
  getClassAttendanceDashboardMatrix,
  getClassAttendanceDashboardTrend,
  getClassAttendanceDashboardStatusBreakdown,
} = require("../controllers/attendanceCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const router = express.Router();

// All routes require authentication
router.use(validateUser, checkSubscriptionActive);

// ==================== MARK & MANAGE ATTENDANCE ====================
// Admin: can mark for any student/staff/teacher
// Teacher: can mark for students in their class and themselves
// Staff: can mark only for themselves
router.post("/mark",allow("admin", 'teacher', 'staff' ), markAttendance);

router.post("/update",allow("admin", 'teacher', 'staff' ), updateAttendance);

// ==================== GET ATTENDANCE ====================
// Get own attendance or (if admin) any user's attendance
// Query: ?userId=<id>&month=<1-12>&year=<YYYY>
// Month and year optional for filtering
router.get("", allow("admin", 'teacher', 'staff','student'), getAttendance);

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

// ==================== CLASS DASHBOARD ATTENDANCE ====================
// Class-wise attendance analytics with custom date range
router.get("/dashboard/summary", allow("admin", "teacher"), getClassAttendanceDashboardSummary);
router.get("/dashboard/matrix", allow("admin", "teacher"), getClassAttendanceDashboardMatrix);
router.get("/dashboard/trend", allow("admin", "teacher"), getClassAttendanceDashboardTrend);
router.get("/dashboard/status-breakdown", allow("admin", "teacher"), getClassAttendanceDashboardStatusBreakdown);

router.get(
  "/get-today/:id",
  (req, res, next) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });
    next();
  },
  getTodayAttendace
);

module.exports = router;