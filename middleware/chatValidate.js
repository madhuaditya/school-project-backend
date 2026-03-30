// middleware/chatValidate.js
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

// Validate chat message
const validateChatMessage = (req, res, next) => {
  try {
    const { msg } = req.body;

    if (!msg || typeof msg !== 'string') {
      return res.status(400).json(formatResponse(false, 'Message is required'));
    }

    if (msg.trim().length === 0) {
      return res.status(400).json(formatResponse(false, 'Message cannot be empty'));
    }

    if (msg.trim().length > 5000) {
      return res.status(400).json(formatResponse(false, 'Message cannot exceed 5000 characters'));
    }

    req.body.msg = msg.trim();
    next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating message', null, error.message));
  }
};

// Validate reply message
const validateReplyMessage = (req, res, next) => {
  try {
    const { msg } = req.body;

    if (!msg || typeof msg !== 'string') {
      return res.status(400).json(formatResponse(false, 'Reply message is required'));
    }

    if (msg.trim().length === 0) {
      return res.status(400).json(formatResponse(false, 'Reply message cannot be empty'));
    }

    if (msg.trim().length > 5000) {
      return res.status(400).json(formatResponse(false, 'Reply message cannot exceed 5000 characters'));
    }

    req.body.msg = msg.trim();
    next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating reply message', null, error.message));
  }
};

// Validate pagination parameters
const validatePagination = (req, res, next) => {
  try {
    let { page = 1, size = 10 } = req.query;

    page = parseInt(page, 10);
    size = parseInt(size, 10);

    if (isNaN(page) || page < 1) {
      return res.status(400).json(formatResponse(false, 'Page must be a positive integer'));
    }

    if (isNaN(size) || size < 1 || size > 100) {
      return res.status(400).json(formatResponse(false, 'Size must be between 1 and 100'));
    }

    req.query.page = page;
    req.query.size = size;
    next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating pagination', null, error.message));
  }
};

module.exports = {
  validateChatMessage,
  validateReplyMessage,
  validatePagination,
};
