const express = require("express");
const {
  addProgress,
  updateProgress,
  deleteProgress,
  getProgressById,
  getValidSubjectsForStudent,
  getStudentPerformance,
  getClassResult,
  getSubjectPerformance,
  generateStudentReport,
  generateAdvancedReport,
  generateStyledReport,
  generateCBSEReport,
  getStudentResultByYear,
} = require("../controllers/progressCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

router.use(validateUser);

// ADD
router.post("/create", allow("admin", "teacher"), addProgress);

// VALID SUBJECTS FOR A STUDENT (used for add/update forms)
router.get(
  "/valid-subjects/:studentId",
  allow("admin", "teacher"),
  getValidSubjectsForStudent,
);

// GET / UPDATE / DELETE SINGLE PERFORMANCE
router.get(
  "/:progressId",
  allow("admin", "teacher"),
  getProgressById,
);

router.put(
  "/:progressId",
  allow("admin", "teacher"),
  updateProgress,
);
router.delete(
  "/:progressId",
  allow("admin", "teacher"),
  deleteProgress,
);

// STUDENT PERFORMANCE
router.get(
  "/student/:studentId",
  allow("admin", "teacher", "student"),
  getStudentPerformance,
);

// CLASS RESULT
router.get("/class/:classId", allow("admin", "teacher"), getClassResult);

// SUBJECT PERFORMANCE
router.get(
  "/subject/:subjectId",
  allow("admin", "teacher"),
  getSubjectPerformance,
);

// PDF
router.get(
  "/report/:studentId",
  allow("admin", "teacher"),
  generateStudentReport,
);
router.get(
  "/result/student/:studentId",
  allow("admin", "teacher", "student"),
  getStudentResultByYear,
);

router.get(
  "/advanced-report/:studentId",
  allow("admin", "teacher"),
  generateAdvancedReport,
);

router.get(
  "/report-card/:studentId",
  allow("admin", "teacher"),
  generateStyledReport,
);

router.get(
  "/report-card-cbsc/:studentId",
  allow("admin", "teacher"),
  generateCBSEReport,
);

module.exports = router;
