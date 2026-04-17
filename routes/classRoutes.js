const express = require("express");
const {
  createClass,
  assignClassTeacher,
  assignStudent,
  removeStudent,
  getClassById,
  getClasses,
  getClassStudents,
} = require("../controllers/classCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

// CREATE CLASS
router.post("/create", allow("admin", "teacher"), createClass);

// ASSIGN CLASS TEACHER (ADMIN ONLY)
router.post("/assign-teacher", allow("admin"), assignClassTeacher);

// ASSIGN STUDENT
router.post("/assign-student", allow("admin", "teacher"), assignStudent);

// REMOVE STUDENT
router.post("/remove-student", allow("admin", "teacher"), removeStudent);

// GET ALL CLASSES
router.get("/all", allow('admin','teacher','student'), getClasses);

// GET ALL STUDENTS BY CLASS ID
router.get('/:classId/students', allow('admin', 'teacher', 'student'), getClassStudents);

// GET CLASS
router.get("/:id", allow("admin", "teacher", "student"), getClassById);

module.exports = router;