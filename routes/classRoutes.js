const express = require("express");
const {
  createClass,
  assignClassTeacher,
  assignStudent,
  removeStudent,
  getClassById,
  getClasses
} = require("../controllers/classCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

router.use(validateUser);

// CREATE CLASS
router.post("/create", allow("admin", "teacher"), createClass);

// ASSIGN CLASS TEACHER (ADMIN ONLY)
router.post("/assign-teacher", allow("admin"), assignClassTeacher);

// ASSIGN STUDENT
router.post("/assign-student", allow("admin", "teacher"), assignStudent);

// REMOVE STUDENT
router.post("/remove-student", allow("admin", "teacher"), removeStudent);

// GET ALL CLASSES
router.get("/all", allow('admin','teacher'), getClasses);

// GET CLASS
router.get("/:id", allow("admin", "teacher", "student"), getClassById);

module.exports = router;