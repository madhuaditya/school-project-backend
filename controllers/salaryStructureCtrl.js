const mongoose = require("mongoose");
const SalaryStructure = require("../models/salaryStructure");

const COMPONENT_KEYS = ["basic", "hra", "da", "bonus"];
const DEDUCTION_KEYS = ["pf", "tax", "other"];

const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

const normalizeRole = (role) => (typeof role === "string" ? role.trim().toUpperCase() : "");

const parseNumberGroup = (source = {}, keys = [], allowPartial = false, groupName = "values") => {
  const parsed = {};

  for (const key of keys) {
    if (!(key in source)) {
      if (!allowPartial) parsed[key] = 0;
      continue;
    }

    const value = Number(source[key]);
    if (!Number.isFinite(value) || value < 0) {
      return { error: `Invalid value for ${groupName}.${key}` };
    }
    parsed[key] = value;
  }

  if (allowPartial && Object.keys(parsed).length === 0) {
    return { error: `At least one ${groupName} field is required` };
  }

  return { parsed };
};

const createSalaryStructure = async (req, res) => {
  try {
    const { role, components = {}, deductions = {} } = req.body;
    const normalizedRole = normalizeRole(role);

    if (!normalizedRole) {
      return res.status(400).json(formatResponse(false, "Role is required"));
    }

    const existing = await SalaryStructure.findOne({
      school: req.user.school._id,
      role: normalizedRole,
    }).select("_id");

    if (existing) {
      return res
        .status(409)
        .json(formatResponse(false, "Salary structure already exists for this role in your school"));
    }

    const parsedComponents = parseNumberGroup(components, COMPONENT_KEYS, false, "components");
    if (parsedComponents.error) {
      return res.status(400).json(formatResponse(false, parsedComponents.error));
    }

    const parsedDeductions = parseNumberGroup(deductions, DEDUCTION_KEYS, false, "deductions");
    if (parsedDeductions.error) {
      return res.status(400).json(formatResponse(false, parsedDeductions.error));
    }

    const created = await SalaryStructure.create({
      role: normalizedRole,
      school: req.user.school._id,
      components: parsedComponents.parsed,
      deductions: parsedDeductions.parsed,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const populated = await SalaryStructure.findById(created._id)
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email");

    return res
      .status(201)
      .json(formatResponse(true, "Salary structure created successfully", populated));
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json(formatResponse(false, error.message));
    }
    return res
      .status(500)
      .json(formatResponse(false, "Error creating salary structure", null, error.message));
  }
};

const getAllSalaryStructures = async (req, res) => {
  try {
    const structures = await SalaryStructure.find({ school: req.user.school._id })
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json(formatResponse(true, "Salary structures fetched successfully", structures));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary structures", null, error.message));
  }
};

const getSalaryStructureById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const structure = await SalaryStructure.findById(id)
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email");

    if (!structure) {
      return res.status(404).json(formatResponse(false, "Salary structure not found"));
    }

    if (structure.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    return res
      .status(200)
      .json(formatResponse(true, "Salary structure fetched successfully", structure));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary structure", null, error.message));
  }
};

const getSalaryStructureByRole = async (req, res) => {
  try {
    const normalizedRole = normalizeRole(req.params.role);
    if (!normalizedRole) {
      return res.status(400).json(formatResponse(false, "Role is required"));
    }

    const structure = await SalaryStructure.findOne({
      school: req.user.school._id,
      role: normalizedRole,
    })
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email");

    if (!structure) {
      return res.status(404).json(formatResponse(false, "Salary structure not found"));
    }

    return res
      .status(200)
      .json(formatResponse(true, "Salary structure fetched successfully", structure));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary structure", null, error.message));
  }
};

const updateSalaryStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, components, deductions } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const structure = await SalaryStructure.findById(id);
    if (!structure) {
      return res.status(404).json(formatResponse(false, "Salary structure not found"));
    }

    if (structure.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    if (role !== undefined) {
      const normalizedRole = normalizeRole(role);
      if (!normalizedRole) {
        return res.status(400).json(formatResponse(false, "Role cannot be empty"));
      }

      const duplicate = await SalaryStructure.findOne({
        school: req.user.school._id,
        role: normalizedRole,
        _id: { $ne: id },
      }).select("_id");

      if (duplicate) {
        return res
          .status(409)
          .json(formatResponse(false, "Salary structure already exists for this role in your school"));
      }

      structure.role = normalizedRole;
    }

    if (components !== undefined) {
      if (typeof components !== "object" || components === null || Array.isArray(components)) {
        return res.status(400).json(formatResponse(false, "components must be an object"));
      }

      const parsedComponents = parseNumberGroup(components, COMPONENT_KEYS, true, "components");
      if (parsedComponents.error) {
        return res.status(400).json(formatResponse(false, parsedComponents.error));
      }

      structure.components = {
        ...structure.components.toObject(),
        ...parsedComponents.parsed,
      };
    }

    if (deductions !== undefined) {
      if (typeof deductions !== "object" || deductions === null || Array.isArray(deductions)) {
        return res.status(400).json(formatResponse(false, "deductions must be an object"));
      }

      const parsedDeductions = parseNumberGroup(deductions, DEDUCTION_KEYS, true, "deductions");
      if (parsedDeductions.error) {
        return res.status(400).json(formatResponse(false, parsedDeductions.error));
      }

      structure.deductions = {
        ...structure.deductions.toObject(),
        ...parsedDeductions.parsed,
      };
    }

    structure.updatedBy = req.user._id;
    await structure.save();

    const populated = await SalaryStructure.findById(structure._id)
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email");

    return res
      .status(200)
      .json(formatResponse(true, "Salary structure updated successfully", populated));
  } catch (error) {
    if (error?.name === "ValidationError") {
      return res.status(400).json(formatResponse(false, error.message));
    }
    return res
      .status(500)
      .json(formatResponse(false, "Error updating salary structure", null, error.message));
  }
};

const deleteSalaryStructure = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const structure = await SalaryStructure.findById(id);
    if (!structure) {
      return res.status(404).json(formatResponse(false, "Salary structure not found"));
    }

    if (structure.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    await structure.deleteOne();

    return res.status(200).json(formatResponse(true, "Salary structure deleted successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error deleting salary structure", null, error.message));
  }
};

module.exports = {
  createSalaryStructure,
  getAllSalaryStructures,
  getSalaryStructureById,
  getSalaryStructureByRole,
  updateSalaryStructure,
  deleteSalaryStructure,
};
