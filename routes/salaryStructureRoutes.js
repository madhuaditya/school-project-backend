const express = require("express");
const {
  createSalaryStructure,
  getAllSalaryStructures,
  getSalaryStructureById,
  getSalaryStructureByRole,
  updateSalaryStructure,
  deleteSalaryStructure,
} = require("../controllers/salaryStructureCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

router.use(validateUser);
router.use(allow("admin"));

router.post("/create", createSalaryStructure);
router.get("/all", getAllSalaryStructures);
router.get("/role/:role", getSalaryStructureByRole);
router.get("/:id", getSalaryStructureById);
router.put("/:id", updateSalaryStructure);
router.delete("/:id", deleteSalaryStructure);

module.exports = router;
