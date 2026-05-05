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
  generateAdvancedReportHtml,
  generateStyledReport,
  generateStyledReportHtml,
  generateCBSEReport,
  generateCBSEReportHtml,
  getStudentResultByYear,
  getStudentDashboardAnalytics,
  getClassDashboardAnalytics,
  exportStudentPerformanceCsv,
  exportStudentPerformanceExcel,
} = require("../controllers/progressCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");
const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

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

router.get(
  "/student-dashboard/:studentId",
  allow("admin", "teacher", "student"),
  getStudentDashboardAnalytics,
);

router.get(
  "/class-dashboard/:classId",
  allow("admin", "teacher"),
  getClassDashboardAnalytics,
);

router.get(
  "/export/csv/:studentId",
  allow("admin", "teacher", "student"),
  exportStudentPerformanceCsv,
);

router.get(
  "/export/excel/:studentId",
  allow("admin", "teacher", "student"),
  exportStudentPerformanceExcel,
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
  "/advanced-report-html/:studentId",
  allow("admin", "teacher"),
  generateAdvancedReportHtml,
);

router.get(
  "/report-card/:studentId",
  allow("admin", "teacher"),
  generateStyledReport,
);

router.get(
  "/report-card-html/:studentId",
  allow("admin", "teacher"),
  generateStyledReportHtml,
);

router.get(
  "/report-card-cbsc/:studentId",
  allow("admin", "teacher"),
  generateCBSEReport,
);

router.get(
  "/report-card-cbsc-html/:studentId",
  allow("admin", "teacher"),
  generateCBSEReportHtml,
);

module.exports = router;
