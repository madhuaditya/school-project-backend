const express = require("express");
const {
  createFeeStructure,
  getAllFeeStructures,
  getFeeStructureByClass,
  getFeeStructureById,
  updateFeeStructure,
  deleteFeeStructure,
} = require("../controllers/feeStructureCtrl");
const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");

const router = express.Router();

router.use(validateUser);
router.use(allow("admin"));

router.post("/create", createFeeStructure);
router.get("/all", getAllFeeStructures);
router.get("/class/:classId", getFeeStructureByClass);
router.get("/:id", getFeeStructureById);
router.put("/:id", updateFeeStructure);
router.delete("/:id", deleteFeeStructure);

module.exports = router;
