const Notice = require('../models/notice');

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const getSchoolIdFromReq = (req) => {
  if (req?.user?.school?._id) return req.user.school._id.toString();
  if (req?.user?.school) return req.user.school.toString();
  return null;
};

const isAdminUser = (req) => req?.user?.role?.role === 'admin';

const createNotice = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json(formatResponse(false, 'Only admin can create notice'));
    }

    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const { title, details, validity } = req.body;
    if (!title || !details || !validity) {
      return res.status(400).json(formatResponse(false, 'title, details and validity are required'));
    }

    const notice = await Notice.create({
      title,
      details,
      date: new Date(),
      validity: new Date(validity),
      school: schoolId,
      School: schoolId,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    return res.status(201).json(formatResponse(true, 'Notice created successfully', notice));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error creating notice', null, error.message));
  }
};

const updateNotice = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json(formatResponse(false, 'Only admin can update notice'));
    }

    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json(formatResponse(false, 'Notice not found'));
    }

    const noticeSchoolId = (notice.school || notice.School)?.toString();
    if (noticeSchoolId !== schoolId) {
      return res.status(403).json(formatResponse(false, 'Cannot update notice from another school'));
    }

    const { title, details, validity } = req.body;
    if (title !== undefined) notice.title = title;
    if (details !== undefined) notice.details = details;
    if (validity !== undefined) notice.validity = new Date(validity);
    notice.updatedBy = req.user._id;

    await notice.save();
    return res.status(200).json(formatResponse(true, 'Notice updated successfully', notice));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating notice', null, error.message));
  }
};

const deleteNotice = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json(formatResponse(false, 'Only admin can delete notice'));
    }

    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json(formatResponse(false, 'Notice not found'));
    }

    const noticeSchoolId = (notice.school || notice.School)?.toString();
    if (noticeSchoolId !== schoolId) {
      return res.status(403).json(formatResponse(false, 'Cannot delete notice from another school'));
    }

    await notice.deleteOne();
    return res.status(200).json(formatResponse(true, 'Notice deleted successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting notice', null, error.message));
  }
};

const getValidNoticesForSchool = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notices = await Notice.find({
      validity: { $gte: today },
      $or: [{ school: schoolId }, { School: schoolId }],
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.status(200).json(formatResponse(true, 'Valid notices fetched successfully', notices));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching notices', null, error.message));
  }
};

module.exports = {
  createNotice,
  updateNotice,
  deleteNotice,
  getValidNoticesForSchool,
};
