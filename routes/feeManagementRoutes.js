const express = require("express");
const {
  createPayment,
  getPaymentById,
  getPaymentSlipHtml,
  deletePayment,
  getStudentFeeByMonthYear,
  getClassWiseFeeMatrix,
  getSchoolWiseFeeMatrix,
  getStudentPaymentHistory,
  getStudentByClassFeeByMonthYear
} = require("../controllers/feeManagementCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");
const router = express.Router();

router.use(validateUser, checkSubscriptionActive);
router.use(allow("admin"));

router.post("/payment/create", createPayment);
router.get("/payment/:id", getPaymentById);
router.get("/payment/:id/slip-html", getPaymentSlipHtml);
router.delete("/payment/:id", deletePayment);

router.post("/summary/class/month/:month/:year", getStudentByClassFeeByMonthYear);
router.get("/summary/student/:studentId/month/:month/:year", getStudentFeeByMonthYear);
router.get("/summary/student/:studentId/history", getStudentPaymentHistory);

router.get("/analytics/class-wise", getClassWiseFeeMatrix);
router.get("/analytics/school-wise", getSchoolWiseFeeMatrix);

module.exports = router;
