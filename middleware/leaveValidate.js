const mongoose = require("mongoose");

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const LEAVE_TYPES = ["sick", "casual", "earned", "maternity", "paternity", "other"];
const LIST_STATUSES = ["all", "pending", "approved", "declined"];
const REVIEW_ACTIONS = ["approved", "declined", 'approve', 'decline' , 'approv', 'declin'];

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const validateApplyLeave = (req, res, next) => {
    console.log("Validating apply leave request with body:", req.body);
  try {
    const { leaveType, startDate, endDate, purpose } = req.body;

    if (!leaveType || !startDate || !endDate) {
      return res.status(400).json(formatResponse(false, "leaveType, startDate and endDate are required"));
    }

    if (!LEAVE_TYPES.includes(String(leaveType))) {
      return res
        .status(400)
        .json(formatResponse(false, `Invalid leaveType. Allowed: ${LEAVE_TYPES.join(", ")}`));
    }

    if (purpose != null) {
      if (typeof purpose !== "string") {
        return res.status(400).json(formatResponse(false, "purpose must be a string"));
      }
      if (purpose.trim().length > 1000) {
        return res.status(400).json(formatResponse(false, "purpose cannot exceed 1000 characters"));
      }
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json(formatResponse(false, "Invalid startDate or endDate"));
    }

    if (parsedStartDate > parsedEndDate) {
      return res.status(400).json(formatResponse(false, "startDate cannot be greater than endDate"));
    }

    req.body.leaveType = String(leaveType);
    req.body.purpose = purpose ? String(purpose).trim() : "";
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error validating leave apply request", null, error.message));
  }
};

const validateLeaveListQuery = (req, res, next) => {
  try {
    let { page = 1, size = 10, month, year, status = "all" } = req.query;

    page = parseInt(page, 10);
    size = parseInt(size, 10);

    if (Number.isNaN(page) || page < 1) {
      return res.status(400).json(formatResponse(false, "page must be a positive integer"));
    }

    if (Number.isNaN(size) || size < 1 || size > 100) {
      return res.status(400).json(formatResponse(false, "size must be between 1 and 100"));
    }

    status = String(status || "all").toLowerCase();
    if (!LIST_STATUSES.includes(status)) {
      return res.status(400).json(formatResponse(false, "status must be one of: all, pending, approved, declined"));
    }

    if ((month && !year) || (!month && year)) {
      return res.status(400).json(formatResponse(false, "month and year must be provided together"));
    }

    if (month && year) {
      month = parseInt(month, 10);
      year = parseInt(year, 10);

      if (Number.isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json(formatResponse(false, "month must be between 1 and 12"));
      }

      if (Number.isNaN(year) || year < 2000 || year > 3000) {
        return res.status(400).json(formatResponse(false, "year must be a valid 4-digit number"));
      }

      req.query.month = month;
      req.query.year = year;
    }

    req.query.page = page;
    req.query.size = size;
    req.query.status = status;
    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error validating leave list query", null, error.message));
  }
};

const validateLeaveIdParam = (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !isObjectId(id)) {
      return res.status(400).json(formatResponse(false, "Invalid leave id"));
    }

    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error validating leave id", null, error.message));
  }
};

const validateReviewLeave = (req, res, next) => {
  try {
    const { action, reviewRemark = "" } = req.body;

    if (!action) {
      return res.status(400).json(formatResponse(false, "action is required"));
    }

    const normalizedAction = String(action).toLowerCase();

    if (!REVIEW_ACTIONS.includes(normalizedAction)) {
      return res.status(400).json(formatResponse(false, "action must be either approved or declined"));
    }

    if (reviewRemark != null && typeof reviewRemark !== "string") {
      return res.status(400).json(formatResponse(false, "reviewRemark must be a string"));
    }

    if (String(reviewRemark).trim().length > 1000) {
      return res.status(400).json(formatResponse(false, "reviewRemark cannot exceed 1000 characters"));
    }

    req.body.action = normalizedAction;
    req.body.reviewRemark = String(reviewRemark || "").trim();

    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error validating leave review request", null, error.message));
  }
};

module.exports = {
  validateApplyLeave,
  validateLeaveListQuery,
  validateLeaveIdParam,
  validateReviewLeave,
};
