const express = require("express");
const {
  createSalaryRecord,
  updateSalaryRecord,
  deleteSalaryRecord,
  getSalaryRecordById,
  getStaffSalaryByMonth,
  getStaffAllSalaries,
  getSalaryMatrixByMonth,
  getYearlySalaryMatrix,
  getPendingSalaries,
  recordSalaryPayment,
  getSalaryPaymentsByRecord,
  getStaffPaymentHistory,
} = require("../controllers/salaryManagementCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

router.use(validateUser);

// ==================== SALARY RECORD ROUTES ====================

// Admin - Create salary record
router.post("/record/create", allow("admin"), createSalaryRecord);

// Admin - Update salary record
router.put("/record/:id", allow("admin"), updateSalaryRecord);

// Admin - Delete salary record
router.delete("/record/:id", allow("admin"), deleteSalaryRecord);

// Admin + Staff/Teacher - Get salary record by ID
router.get("/record/:id", allow("admin", "staff", "teacher"), getSalaryRecordById);

// Admin + Staff/Teacher - Get staff salary by month and year
router.get(
  "/record/staff/:staffId/month/:month/:year",
  allow("admin", "staff", "teacher"),
  getStaffSalaryByMonth
);

// Admin + Staff/Teacher - Get all salary records of staff
router.get(
  "/record/staff/:staffId/all",
  allow("admin", "staff", "teacher"),
  getStaffAllSalaries
);

// ==================== ADMIN ANALYTICS ROUTES ====================

// Admin - Get salary matrix by month
router.get("/analytics/matrix-month", allow("admin"), getSalaryMatrixByMonth);

// Admin - Get yearly salary matrix for staff
router.get("/analytics/yearly", allow("admin"), getYearlySalaryMatrix);

// Admin - Get pending salaries
router.get("/analytics/pending", allow("admin"), getPendingSalaries);

// ==================== SALARY PAYMENT ROUTES ====================

// Admin - Record salary payment
router.post("/payment/create", allow("admin"), recordSalaryPayment);

// Admin - Get all payments for a salary record
router.get(
  "/payment/:salaryRecordId",
  allow("admin"),
  getSalaryPaymentsByRecord
);

// Admin + Staff/Teacher - Get payment history for staff
router.get(
  "/payment/staff/:staffId/history",
  allow("admin", "staff", "teacher"),
  getStaffPaymentHistory
);

module.exports = router;
