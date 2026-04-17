const mongoose = require("mongoose");
const FeeStructure = require("../models/feeStructure");
const Class = require("../models/class");

const COMPONENT_KEYS = [
  "tuition",
  "exam",
  "transport",
  "hostel",
  "activity",
  "development",
];

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const toMoney = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const parseComponentValues = (components = {}, allowPartial = false) => {
  const parsed = {};

  for (const key of COMPONENT_KEYS) {
    if (!(key in components)) {
      if (!allowPartial) parsed[key] = 0;
      continue;
    }

    const value = Number(components[key]);
    if (!Number.isFinite(value) || value < 0) {
      return { error: `Invalid value for ${key}` };
    }

    parsed[key] = toMoney(value);
  }

  if (allowPartial && Object.keys(parsed).length === 0) {
    return { error: "At least one component is required" };
  }

  return { parsed };
};

const createFeeStructure = async (req, res) => {
  try {
    const { classId, components = {} } = req.body;

    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json(formatResponse(false, "Valid classId is required"));
    }

    const cls = await Class.findById(classId).select("_id school name grade section");
    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    const { parsed, error } = parseComponentValues(components);
    if (error) {
      return res.status(400).json(formatResponse(false, error));
    }

    const feeStructure = await FeeStructure.create({
      class: classId,
      school: req.user.school._id,
      components: parsed,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const populated = await FeeStructure.findById(feeStructure._id)
      .populate("class", "_id name grade section")
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email");

    return res
      .status(201)
      .json(formatResponse(true, "Fee structure created successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating fee structure", null, error.message));
  }
};

const getAllFeeStructures = async (req, res) => {
  try {
    const feeStructures = await FeeStructure.find({ school: req.user.school._id })
      .populate("class", "_id name grade section")
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json(formatResponse(true, "Fee structures fetched successfully", feeStructures));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching fee structures", null, error.message));
  }
};

const getFeeStructureByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json(formatResponse(false, "Valid classId is required"));
    }

    const cls = await Class.findById(classId).select("_id school name grade section");
    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    const feeStructures = await FeeStructure.find({
      class: classId,
      school: req.user.school._id,
    })
      .populate("class", "_id name grade section")
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json(formatResponse(true, "Fee structures fetched successfully", feeStructures));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching fee structures", null, error.message));
  }
};

const getFeeStructureById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const feeStructure = await FeeStructure.findById(id)
      .populate("class", "_id name grade section")
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email");

    if (!feeStructure) {
      return res.status(404).json(formatResponse(false, "Fee structure not found"));
    }

    if (!feeStructure.school || feeStructure.school._id.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    return res
      .status(200)
      .json(formatResponse(true, "Fee structure fetched successfully", feeStructure));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching fee structure", null, error.message));
  }
};

const updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { classId, components } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const feeStructure = await FeeStructure.findById(id).populate("class", "_id school").populate("school", "_id");
    if (!feeStructure) {
      return res.status(404).json(formatResponse(false, "Fee structure not found"));
    }

    if (!feeStructure.school || feeStructure.school._id.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json(formatResponse(false, "Valid classId is required"));
      }

      const cls = await Class.findById(classId).select("_id school");
      if (!cls) {
        return res.status(404).json(formatResponse(false, "Class not found"));
      }

      if (cls.school.toString() !== req.user.school._id.toString()) {
        return res.status(403).json(formatResponse(false, "Class not in your school"));
      }

      feeStructure.class = classId;
      feeStructure.school = req.user.school._id;
    }

    if (components !== undefined) {
      if (typeof components !== "object" || components === null || Array.isArray(components)) {
        return res.status(400).json(formatResponse(false, "components must be an object"));
      }

      const { parsed, error } = parseComponentValues(components, true);
      if (error) {
        return res.status(400).json(formatResponse(false, error));
      }

      feeStructure.components = {
        ...feeStructure.components.toObject(),
        ...parsed,
      };
    }

    feeStructure.updatedBy = req.user._id;
    await feeStructure.save();

    const populated = await FeeStructure.findById(feeStructure._id)
      .populate("class", "_id name grade section")
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email");

    return res
      .status(200)
      .json(formatResponse(true, "Fee structure updated successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error updating fee structure", null, error.message));
  }
};

const deleteFeeStructure = async (req, res) => {
  return res
    .status(405)
    .json(formatResponse(false, "Fee structure deletion is disabled. You can update structure instead."));
};

module.exports = {
  createFeeStructure,
  getAllFeeStructures,
  getFeeStructureByClass,
  getFeeStructureById,
  updateFeeStructure,
  deleteFeeStructure,
};
