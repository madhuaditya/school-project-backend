const Role = require('../models/role');
const User = require('../models/user');
const ClassModel = require('../models/class');
const subject = require('../models/subject');

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const getSchoolOverview = async (req, res) => {
  try {
    const schoolId = req.user?.school?._id;
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const [adminRole, studentRole] = await Promise.all([
      Role.findOne({ role: 'admin' }).select('_id'),
      Role.findOne({ role: 'student' }).select('_id'),
    ]);

    if (!adminRole || !studentRole) {
      return res.status(500).json(formatResponse(false, 'Required roles are missing'));
    }

    const [totalAdmins, totalClasses, totalStudents , totalTeachers , totalStaff , totalSubjects] = await Promise.all([
      User.countDocuments({ school: schoolId, role: adminRole._id, active: { $ne: false } }),
      ClassModel.countDocuments({ school: schoolId }),
      User.countDocuments({ school: schoolId, role: studentRole._id, active: { $ne: false } }),
        User.countDocuments({ school: schoolId, role: await Role.findOne({ role: 'teacher' }).select('_id'), active: { $ne: false } }),
        User.countDocuments({ school: schoolId, role: await Role.findOne({ role: 'staff' }).select('_id'), active: { $ne: false } }),
      subject.countDocuments({ school: schoolId }),
    ]);

    return res.status(200).json(
      formatResponse(true, 'School overview fetched successfully', {
        totalAdmins,
        totalClasses,
        totalStudents,
        totalTeachers,
        totalStaff,
        totalSubjects
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, 'Error fetching school overview', null, error.message));
  }
};

module.exports = {
  getSchoolOverview,
};
