const Class = require('../models/class');
const Student = require('../models/student');
const Teacher = require('../models/teacher');
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

// ================= CREATE CLASS =================
const createClass = async (req, res) => {
  try {
    const { name, grade, section, capacity=100, room='R001' } = req.body;
    if(!name || !grade || !section) return res.status(400).json(formatResponse(false, "Name, grade and section are required"));

    const school = req.user.school._id;

    const getClass = await Class.findOne({ name, grade, section, school });
    if (getClass) return res.status(400).json(formatResponse(false, "Class with same name, grade and section already exists in your school"));

    const cls = await Class.create({
      name,
      grade,
      section,
      capacity,
      room,
      school,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    return res.status(201).json(formatResponse(true, "Class created successfully", cls));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error creating class", null, e.message));
  }
};

// ================= ASSIGN CLASS TEACHER =================
const assignClassTeacher = async (req, res) => {
  try {
    const { classId, teacherId } = req.body;
    const adminInfo = req.user; // authenticated user (admin or teacher)

    const cls = await Class.findById(classId).populate('school');
    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    const teacher = await Teacher.findById(teacherId).populate({
      path: 'user',
      select: 'school'
    });
    if (!teacher) return res.status(404).json(formatResponse(false, "Teacher not found"));

    // School validation - both class and teacher must be in same school
    if (cls.school._id.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Class not in your school"));

    if (teacher.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Teacher not in your school"));

    // Authorization check - only admin and teacher allowed
    if (!(['admin', 'teacher'].includes(adminInfo.role.role)))
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    // If auth user is teacher, they cannot assign themselves or others
    if (adminInfo.role.role === 'teacher')
      return res.status(403).json(formatResponse(false, "Only admin can assign class teachers"));

    cls.classTeacher = teacherId;
    cls.updatedBy = adminInfo._id;

    await cls.save();

    return res.status(200).json(formatResponse(true, "Class teacher assigned successfully"));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error assigning teacher", null, e.message));
  }
};

// ================= ASSIGN STUDENT =================
const assignStudent = async (req, res) => {
  try {
    const { studentId, classId } = req.body;
    const adminInfo = req.user;

    const student = await Student.findById(studentId).populate({ path: 'user',
      select: 'school'});
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    if (cls.school._id.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Class not in your school"));


    // school validation
    if (student.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Different school"));

    student.class = classId;
    const user = await User.findById(studentId)
    user.updatedBy= req.user._id;
    await user.save();
    await student.save();

    return res.status(200).json(formatResponse(true, "Student assigned to class successfully"));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error assigning student", null, e.message));
  }
};

// ================= REMOVE STUDENT =================
const removeStudent = async (req, res) => {
  try {
    const { studentId } = req.body;

    const student = await Student.findById(studentId).populate({ path: 'user',
      select: 'school'});
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    if (student.user.school.toString() !== req.user.school._id.toString())
      return res.status(403).json(formatResponse(false, "Different school"));


    student.class = null;
    await student.save();

    return res.status(200).json(formatResponse(true, "Student removed from class successfully"));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error removing student", null, e.message));
  }
};

// ================= GET CLASS DETAILS =================
const getClassById = async (req, res) => {
  try {
    const { id } = req.params;



    const cls = await Class.findById(id)
      .populate({
        path: 'classTeacher',
        populate: {
          path: 'user',
          select: '_id name email phone'
        }
      })
      .populate('subjects', '_id name')
      .lean();

    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    if(cls.school.toString() !== req.user.school._id.toString())
      return res.status(403).json(formatResponse(false, "Class not in your school"));

    const students = await Student.find({ class: id })
      .populate({
        path: 'user',
        select: '_id name email phone'
      });

    return res.status(200).json(formatResponse(true, "Class fetched successfully", {
      ...cls,
      students
    }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching class", null, e.message));
  }
};

const getClasses = async (req, res) => {
  try {
    const classes = await Class.find({ school: req.user.school._id })
      .populate({
        path: 'classTeacher',
        populate: {
          path: 'user',
          select: '_id name email phone'
        }
      })
      .populate('subjects', '_id name')
      .lean();

    return res.status(200).json(formatResponse(true, "Classes fetched successfully", classes));
  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching classes", null, e.message));
  }
};


module.exports = {
  createClass,
  assignClassTeacher,
  assignStudent,
  removeStudent,
  getClassById,
  getClasses
};