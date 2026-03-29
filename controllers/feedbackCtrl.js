const Feedback = require('../models/feedback');

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;

const resolveSchoolId = (req) => {
  if (req?.user?.school?._id) return req.user.school._id;
  if (req?.user?.school) return req.user.school;
  return null;
};

const createFeedback = async (req, res) => {
  try {
    const { name, email, phone = '', message, rating = null, type = 'contact' } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json(formatResponse(false, 'name, email and message are required'));
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json(formatResponse(false, 'Enter a valid email address'));
    }

    if (phone && !PHONE_REGEX.test(phone)) {
      return res.status(400).json(formatResponse(false, 'Enter a valid 10-digit mobile number'));
    }

    if (String(message).trim().length < 10) {
      return res.status(400).json(formatResponse(false, 'Message should be at least 10 characters'));
    }

    const feedback = await Feedback.create({
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      message: String(message).trim(),
      rating: rating ? Number(rating) : null,
      type,
      source: 'web',
      createdBy: req.user?._id || null,
      school: resolveSchoolId(req),
    });

    return res.status(201).json(formatResponse(true, 'Thanks, your request has been submitted.', feedback));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error submitting feedback', null, error.message));
  }
};

const getFeedbackList = async (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const query = schoolId ? { school: schoolId } : {};

    const feedbackList = await Feedback.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json(formatResponse(true, 'Feedback fetched successfully', feedbackList));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching feedback', null, error.message));
  }
};

module.exports = {
  createFeedback,
  getFeedbackList,
};
