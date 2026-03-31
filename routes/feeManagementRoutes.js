const express = require("express");
const {
  createFeeRecord,
  updateFeeRecord,
  deleteFeeRecord,
  getFeeRecordById,
  getStudentFeeByMonthYear,
  getStudentAllFees,
  getClassWiseFeeMatrix,
  getSchoolWiseFeeMatrix,
  getPendingFeesByClass,
  getYearlyFeeMatrix,
  createPayment,
  getPaymentsByFeeRecord,
  getStudentPaymentHistory,
  createAlertForStudentUnpaidFees,
  createAlertForClassUnpaidFees,
  createAlertForSchoolUnpaidFees,
  createFeeRecordForClassStudents,
  createFeeRecordForSchoolStudents,
} = require("../controllers/feeManagementCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

router.use(validateUser);

// ==================== FEE RECORD ROUTES (ADMIN ONLY) ====================

// Admin: Create fee record for student
router.post("/record/create", allow("admin"), createFeeRecord);

// Admin: Update fee record
router.put("/record/:id", allow("admin"), updateFeeRecord);

// Admin: Delete fee record
router.delete("/record/:id", allow("admin"), deleteFeeRecord);

// Admin: Bulk create fee records for all students in a class
router.post("/record/class/bulk-create", allow("admin"), createFeeRecordForClassStudents);

// Admin: Bulk create fee records for all students in school
// router.post("/record/school/bulk-create", allow("admin"), createFeeRecordForSchoolStudents);

// Get fee record by id (Admin + Student can view own)
router.get("/record/:id", allow("admin", "student"), getFeeRecordById);

// Get student fee by month and year (Admin + Student can view own)
router.get("/record/student/:studentId/month/:month/:year", allow("admin", "student"), getStudentFeeByMonthYear);

// Get all fees for a student (Admin + Student can view own)
router.get("/record/student/:studentId/all", allow("admin", "student"), getStudentAllFees);

// ==================== ADMIN ANALYTICS ROUTES ====================

// Admin: Get class-wise fee matrix (monthly)
router.get("/analytics/class-wise", allow("admin"), getClassWiseFeeMatrix);

// Admin: Get school-wise fee matrix (monthly)
router.get("/analytics/school-wise", allow("admin"), getSchoolWiseFeeMatrix);

// Admin: Get pending fees by class
router.get("/analytics/pending", allow("admin"), getPendingFeesByClass);

// Admin: Get yearly fee matrix for a class
router.get("/analytics/yearly", allow("admin"), getYearlyFeeMatrix);

// ==================== PAYMENT ROUTES ====================

// Create payment (Admin only)
router.post("/payment/create", allow("admin"), createPayment);

// Get payments for a fee record (Admin + Student can view own)
router.get("/payment/:feeRecordId", allow("admin", "student"), getPaymentsByFeeRecord);

// Get student payment history (Admin + Student can view own)
router.get("/payment/student/:studentId/history", allow("admin", "student"), getStudentPaymentHistory);

// ==================== ALERT ROUTES FOR UNPAID FEES ====================

// Admin: Create alert for single student with unpaid fees (past due date)
router.post("/alert/student/create", allow("admin"), createAlertForStudentUnpaidFees);

// Admin: Create alerts for all students in a class with unpaid fees (past due date)
router.post("/alert/class/create", allow("admin"), createAlertForClassUnpaidFees);

// Admin: Create alerts for all students in school with unpaid fees (past due date)
router.post("/alert/school/create", allow("admin"), createAlertForSchoolUnpaidFees);

module.exports = router;
