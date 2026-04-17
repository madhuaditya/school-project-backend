const express = require("express");
const {
  addTeacherToSubject,
  getTeacherById,
  getAllTeachers,
} = require("../controllers/teacherCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

// ADD TEACHER TO SUBJECT
router.post("/add-to-subject", allow("admin", "teacher"), addTeacherToSubject);

// GET ALL TEACHERS IN SCHOOL
router.get("/all", allow("admin", "teacher", "student", "staff"), getAllTeachers);

// GET TEACHER DETAILS
router.get("/:id", allow("admin", "teacher", "student"), getTeacherById);

module.exports = router;
