const express = require("express");
const {
  createSalaryStructure,
  getAllSalaryStructures,
  getSalaryStructureById,
  getSalaryStructureByRole,
  updateSalaryStructure,
} = require("../controllers/salaryStructureCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);
router.use(allow("admin"));

router.post("/create", createSalaryStructure);
router.get("/all", getAllSalaryStructures);
router.get("/role/:role", getSalaryStructureByRole);
router.get("/:id", getSalaryStructureById);
router.put("/:id", updateSalaryStructure);

module.exports = router;
