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

router.post("/payment/create", allow("admin"), recordSalaryPayment);
router.get("/payment/:id", allow("admin"), getSalaryPaymentById);
router.delete("/payment/:id", allow("admin"), deleteSalaryPayment);

router.get("/summary/staff/:staffId/month/:month/:year", allow("admin", "teacher", "staff"), getStaffSalaryByMonth);
router.get("/summary/staff/:staffId/history", allow("admin", "teacher", "staff"), getStaffPaymentHistory);

router.get("/analytics/matrix-month", allow("admin"), getSalaryMatrixByMonth);

module.exports = router;
