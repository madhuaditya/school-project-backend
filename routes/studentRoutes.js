const express = require("express");
const {
  addStudentToClass,
  removeStudentFromClass,
  getStudentById,
  updateStudentProfile
} = require("../controllers/studentCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

// ADD STUDENT TO CLASS
router.post("/add-to-class", allow("admin", "teacher"), addStudentToClass);

// UPDATE STUDENT PROFILE
router.put("/update/:id", allow('admin', 'teacher', 'student'), updateStudentProfile);

// REMOVE STUDENT FROM CLASS
router.post("/remove-from-class", allow("admin", "teacher"), removeStudentFromClass);

// GET STUDENT DETAILS
router.get("/:id", allow("admin", "teacher", "student"), getStudentById);

module.exports = router;
