const express = require("express");
const { createAlert, getUnviewedAlerts, markAsViewed } = require("../controllers/alertCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

router.use(validateUser);

// ==================== ALERT ROUTES ====================

// Admin - Create alert for any user in school
router.post("/create", allow("admin"), createAlert);

// All users - Get unviewed alerts (admin sees all, others see own)
router.get("/unviewed", getUnviewedAlerts);

// Any user - Mark own alert as viewed
router.put("/:alertId/mark-viewed", markAsViewed);

module.exports = router;
