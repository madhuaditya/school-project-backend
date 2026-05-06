const mongoose = require("mongoose");
const Alert = require("../models/alert");
const User = require("../models/user");

const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

// ==================== ALERT MANAGEMENT ====================

const createAlert = async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json(formatResponse(false, "userId, title, and message are required"));
    }

    const targetUser = await User.findById(userId).populate("school", "_id");
    if (!targetUser) {
      return res.status(404).json(formatResponse(false, "Target user not found"));
    }

    // Ensure target user is in the same school
    if (targetUser.school._id.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Target user not in your school"));
    }

    const alert = await Alert.create({
      school: req.user.school._id,
      createdFor: userId,
      createdBy: req.user._id,
      title,
      message,
      viewed: false,
      viewedAt: null,
    });

    const populated = await Alert.findById(alert._id)
      .populate("createdFor", "_id name email")
      .populate("createdBy", "_id name email")
      .populate("school", "_id schoolName");

    return res
      .status(201)
      .json(formatResponse(true, "Alert created successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating alert", null, error.message));
  }
};

const getUnviewedAlerts = async (req, res) => {
  try {
    const userRole = req.user?.role?.role || req.user?.role;

    let query = {
      school: req.user.school._id,
      viewed: false,
    };

      query.createdFor = req.user._id;


    const alerts = await Alert.find(query)
      .populate("createdFor", "_id name email")
      .populate("createdBy", "_id name email")
      .populate("school", "_id schoolName")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json(formatResponse(true, "Unviewed alerts fetched successfully", alerts));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching alerts", null, error.message));
  }
};

const markAsViewed = async (req, res) => {
  try {
    const { alertId } = req.params;

    if (!alertId || !mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json(formatResponse(false, "Valid alertId is required"));
    }

    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json(formatResponse(false, "Alert not found"));
    }

    // Ensure current user is the target user
    if (alert.createdFor.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied. You can only mark your own alerts as viewed"));
    }

    // Ensure same school access
    if (alert.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    await alert.deleteOne();

    return res
      .status(200)
      .json(formatResponse(true, "Alert removed successfully after viewing"));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error updating alert", null, error.message));
  }
};

module.exports = {
  createAlert,
  getUnviewedAlerts,
  markAsViewed,
};
