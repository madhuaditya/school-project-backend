const express = require("express");
const {
  createSubject,
  getSubjectsByClass,
  assignSubjectToClass,
  updateSubject,
  deleteSubject
} = require("../controllers/subjectCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

router.use(validateUser);

// CREATE SUBJECT
router.post("/create", allow("admin", "teacher"), createSubject);

// ASSIGN SUBJECT TO CLASS
router.post("/assign-to-class", allow("admin", "teacher"), assignSubjectToClass);

// GET SUBJECTS BY CLASS
router.get("/class/:classId", allow("admin", "teacher", "student"), getSubjectsByClass);

// UPDATE SUBJECT
router.put("/:id", allow("admin", "teacher"), updateSubject);

// DELETE SUBJECT
router.delete("/:id", allow("admin"), deleteSubject);

module.exports = router;