const Teacher = require('../models/teacher');
const Subject = require('../models/subject');
const User = require('../models/user');

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

// ================= ADD TEACHER TO SUBJECT =================
const addTeacherToSubject = async (req, res) => {
  try {
    const { teacherId, subjectId } = req.body;
    const adminInfo = req.user; // authenticated user (admin or teacher)

    // Validate teacher exists
    const teacher = await Teacher.findById(teacherId).populate('user', 'school');
    if (!teacher) return res.status(404).json(formatResponse(false, "Teacher not found"));

    // Validate subject exists
    const subject = await Subject.findById(subjectId).populate('class').populate('school');
    if (!subject) return res.status(404).json(formatResponse(false, "Subject not found"));

    // Check if both are in same school
    if (teacher.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Teacher not in your school"));

    if (subject.school._id.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Subject not in your school"));

    // Check authorization - only admin and teacher allowed
    if (!(['admin', 'teacher'].includes(adminInfo.role.role)))
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    // If auth user is teacher, they can only add teacher to their own subjects
    if (adminInfo.role.role === 'teacher') {
      const authTeacher = await Teacher.findOne({ user: adminInfo._id });
      if (!authTeacher) return res.status(403).json(formatResponse(false, "You are not a teacher"));

      if (subject.teacher.toString() !== authTeacher._id.toString())
        return res.status(403).json(formatResponse(false, "You can only add teachers to your own subjects"));
    }

    // Add subject to teacher's teachSubjects array
    if (!teacher.teachSubjects.includes(subjectId)) {
      teacher.teachSubjects.push(subjectId);
    }

    // Update subject's teacher reference (can assign multiple teachers, but primary teacher in subject.teacher)
    subject.teacher = teacherId;
    subject.updatedBy = adminInfo._id;

    await teacher.save();
    await subject.save();

    return res.status(201).json(formatResponse(true, "Teacher added to subject successfully", {
      teacher: teacher._id,
      subject: subject._id
    }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error adding teacher to subject", null, e.message));
  }
};

// ================= GET TEACHER DETAILS =================
const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;

    const adminInfo = req.user; // authenticated user

    const teacher = await Teacher.findById(id)
      .populate({
        path: 'user',
        select: 'name email phone image school'
      })
      .populate({
        path: 'teachSubjects',
        populate: {
          path: 'class',
          select: 'name grade section'
        }
      });

    if (!teacher) return res.status(404).json(formatResponse(false, "Teacher not found"));

    // Check school authorization
    if (teacher.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    return res.status(200).json(formatResponse(true, "Teacher fetched successfully", teacher));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching teacher", null, e.message));
  }
};

// ================= GET ALL TEACHERS IN SCHOOL =================
const getAllTeachers = async (req, res) => {
  try {
    const adminInfo = req.user;

    const teachers = await Teacher.find()
      .populate({
        path: 'user',
        select: 'name email phone image school city state address pinCode',
      })
      .populate({
        path: 'teachSubjects',
        select: 'name code',
      })
      .populate({
        path: 'classTeacher',
        select: 'name grade section',
      })
      .populate({
        path: 'teachSclass',
        select: 'name grade section',
      });

    const schoolTeachers = teachers.filter(
      (teacher) => teacher?.user?.school?.toString() === adminInfo.school._id.toString()
    );

    return res
      .status(200)
      .json(formatResponse(true, 'Teachers fetched successfully', schoolTeachers));
  } catch (e) {
    return res
      .status(500)
      .json(formatResponse(false, 'Error fetching teachers', null, e.message));
  }
};

module.exports = {
  addTeacherToSubject,
  getTeacherById,
  getAllTeachers,
};
