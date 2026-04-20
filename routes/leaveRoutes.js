const express = require("express");
const {
  applyLeave,
  getMyLeaves,
  deleteMyPendingLeave,
  getAdminLeaves,
  reviewLeave,
} = require("../controllers/leaveCtrl");
const { validateUser } = require("../middleware/auth");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");
const { allow } = require("../middleware/role");
const {
  validateApplyLeave,
  validateLeaveListQuery,
  validateLeaveIdParam,
  validateReviewLeave,
} = require("../middleware/leaveValidate");

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

router.post(
  "/apply",
  allow("admin", "teacher", "staff", "student", "accountant", "driver"),
  validateApplyLeave,
  applyLeave
);

router.get(
  "/my",
  allow("admin", "teacher", "staff", "student", "accountant", "driver"),
  validateLeaveListQuery,
  getMyLeaves
);

router.delete(
  "/my/:id",
  allow("admin", "teacher", "staff", "student", "accountant", "driver"),
  validateLeaveIdParam,
  deleteMyPendingLeave
);

router.get("/admin", allow("admin"), validateLeaveListQuery, getAdminLeaves);

router.patch(
  "/admin/:id/review",
  allow("admin"),
  validateLeaveIdParam,
  validateReviewLeave,
  reviewLeave
);

module.exports = router;
