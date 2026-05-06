const express = require("express");
const {
  createSubject,
  getSubjectsByClass,
  assignSubjectToClass,
  updateSubject,
  deleteSubject,
  getSubject,
  getSubjectDashboard,
  getSubjectDetails,
} = require("../controllers/subjectCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

// CREATE SUBJECT
router.post("/create", allow("admin", "teacher"), createSubject);

// ASSIGN SUBJECT TO CLASS
router.post("/assign-to-class", allow("admin", "teacher"), assignSubjectToClass);

// GET SUBJECTS BY CLASS
router.get("/class/:classId", allow("admin", "teacher", "student"), getSubjectsByClass);

// SUBJECT DASHBOARD + DETAILS
router.get("/dashboard", allow("admin", "teacher"), getSubjectDashboard);
router.get("/:subjectId/details", allow("admin", "teacher"), getSubjectDetails);

// UPDATE SUBJECT
router.put("/:id", allow("admin", "teacher"), updateSubject);
router.get("/all", allow("admin", "teacher"), getSubject);

// DELETE SUBJECT
router.delete("/:id", allow("admin"), deleteSubject);

module.exports = router;