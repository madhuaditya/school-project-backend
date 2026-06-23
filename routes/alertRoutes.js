const express = require("express");
const { createAlert, getUnviewedAlerts, markAsViewed } = require("../controllers/alertCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

// ==================== ALERT ROUTES ====================

// Admin - Create alert for any user in school
router.post("/create", allow("admin","teacher"), createAlert);

// All users - Get unviewed alerts (admin sees all, others see own)
router.get("/unviewed", getUnviewedAlerts);

// Any user - Mark own alert as viewed
router.put("/:alertId/mark-viewed", markAsViewed);

module.exports = router;
