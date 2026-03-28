const Student = require('../models/student');
const Class = require('../models/class');
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

// ================= ADD STUDENT TO CLASS =================
const addStudentToClass = async (req, res) => {
  try {
    const { studentId, classId } = req.body;
    const adminInfo = req.user; // authenticated user (admin or teacher)

    // Validate student exists
    const student = await Student.findById(studentId).populate({
      path: 'user',
      select: 'school'
    });
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    // Validate class exists
    const cls = await Class.findById(classId).populate('school');
    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    // Check if both are in same school
    if (student.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Student not in your school"));

    if (cls.school._id.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Class not in your school"));

    // Check authorization - only admin and teacher allowed
    if (!(['admin', 'teacher'].includes(adminInfo.role.role)))
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    // Assign student to class
    student.class = classId;
    student.section = cls.section;
    
    await student.save();

    return res.status(201).json(formatResponse(true, "Student added to class successfully", {
      student: student._id,
      class: cls._id
    }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error adding student to class", null, e.message));
  }
};

// ================= REMOVE STUDENT FROM CLASS =================
const removeStudentFromClass = async (req, res) => {
  try {
    const { studentId } = req.body;
    const adminInfo = req.user;

    const student = await Student.findById(studentId).populate({
      path: 'user',
      select: 'school'
    });
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    // Check authorization
    if (student.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    if (!(['admin', 'teacher'].includes(adminInfo.role.role)))
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    student.class = null;
    await student.save();

    return res.status(200).json(formatResponse(true, "Student removed from class successfully"));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error removing student from class", null, e.message));
  }
};

// ================= GET STUDENT DETAILS =================
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id)
      .populate({
        path: 'user',
        select: '-password -refreshToken -resetToken -resetTokenExp -v',
      })
      .populate({
        path: 'class',
        select: 'name grade section'
      });

    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    if (!student.user || !student.user.school || !req.user || !req.user.school || !req.user.school._id) {
      return res.status(400).json(formatResponse(false, "School context missing"));
    }

    // Check school authorization
    if (student.user.school.toString() !== req.user.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    return res.status(200).json(formatResponse(true, "Student fetched successfully", { ...student.user.toObject(), ...student.toObject() }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching student", null, e.message));
  }
};

const updateStudentProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { fatherName, motherName, parentContact, address, dateOfBirth, gpa, gradeLevel, rollNumber, status } = req.body;
    const adminInfo = req.user;

    // Validate student exists
    const student = await Student.findById(id).populate({
      path: 'user',
      select: 'school _id'
    });
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    // Check school authorization
    if (student.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    // Authorization check
    const isAdmin = adminInfo.role.role === 'admin';
    const isTeacher = adminInfo.role.role === 'teacher';
    const isOwnProfile = student.user._id.toString() === adminInfo._id.toString();

    if (!isAdmin && !isTeacher && !isOwnProfile)
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    // Students can only update their own profile with limited fields
    if (!isAdmin && !isTeacher && isOwnProfile) {
      // Student can only update certain fields
      if (fatherName) student.fatherName = fatherName;
      if (motherName) student.motherName = motherName;
      if (parentContact) student.parentContact = parentContact;
      if (address) student.address = address;
      if (dateOfBirth) student.dateOfBirth = dateOfBirth;
    } else {
      // Admin and teacher can update all fields
      if (fatherName) student.fatherName = fatherName;
      if (motherName) student.motherName = motherName;
      if (parentContact) student.parentContact = parentContact;
      if (address) student.address = address;
      if (dateOfBirth) student.dateOfBirth = dateOfBirth;
      if (gpa !== undefined) student.gpa = gpa;
      if (gradeLevel) student.gradeLevel = gradeLevel;
      if (rollNumber) student.rollNumber = rollNumber;
      if (status) student.status = status;
    }

    await student.save();

    return res.status(200).json(formatResponse(true, "Student profile updated successfully", {
      studentId: student._id,
      updatedFields: {
        fatherName,
        motherName,
        parentContact,
        address,
        dateOfBirth,
        gpa,
        gradeLevel,
        rollNumber,
        status
      }
    }));

  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error updating student profile", null, error.message));
  }
};

module.exports = {
  addStudentToClass,
  removeStudentFromClass,
  getStudentById,
  updateStudentProfile
};
