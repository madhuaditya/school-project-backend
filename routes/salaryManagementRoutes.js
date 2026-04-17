const express = require("express");
const {
  getSalaryPaymentById,
  deleteSalaryPayment,
  getStaffSalaryByMonth,
  getSalaryMatrixByMonth,
  recordSalaryPayment,
  getStaffPaymentHistory,
} = require("../controllers/salaryManagementCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);
router.use(allow("admin"));

router.post("/payment/create", recordSalaryPayment);
router.get("/payment/:id", getSalaryPaymentById);
router.delete("/payment/:id", deleteSalaryPayment);

router.get("/summary/staff/:staffId/month/:month/:year", getStaffSalaryByMonth);
router.get("/summary/staff/:staffId/history", getStaffPaymentHistory);

router.get("/analytics/matrix-month", getSalaryMatrixByMonth);

module.exports = router;
