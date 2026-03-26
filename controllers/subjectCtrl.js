const Subject = require('../models/subject');
const Class = require('../models/class');
const Teacher = require('../models/teacher');

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

// ================= CREATE SUBJECT =================
const createSubject = async (req, res) => {
  try {
    const { name, code, classId, teacherId, maxMarks } = req.body;
    
    if (!name || !code || !classId || !teacherId || !maxMarks)
      return res.status(400).json(formatResponse(false, "All fields are required"));

    const school = req.user.school._id;

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json(formatResponse(false, "Teacher not found"));

    // school validation
    if (cls.school.toString() !== school.toString())
      return res.status(403).json(formatResponse(false, "Invalid school"));

    const sub = await Subject.create({
      name,
      code,
      class: classId,
      teacher: teacherId,
      school,
      maxMarks,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    // push subject into class
    cls.subjects.push(sub._id);
    await cls.save();

    return res.status(201).json(formatResponse(true, "Subject created successfully", sub));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error creating subject", null, e.message));
  }
};

// ================= GET SUBJECTS BY CLASS =================
const getSubjectsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    if(!classId || classId.trim().length === 0) return res.status(400).json(formatResponse(false, "Class ID required"));

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    if(cls.school.toString() !== req.user.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    const subjects = await Subject.find({ class: classId })
      .populate({
        path: 'teacher',
        populate: {
          path: 'user',
          select: '_id name email phone'
        }
      });

    return res.status(200).json(formatResponse(true, "Subjects fetched successfully", subjects));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching subjects", null, e.message));
  }
};

// ================= ASSIGN SUBJECT TO CLASS =================
const assignSubjectToClass = async (req, res) => {
  try {
    const { subjectId, classId } = req.body;
    const adminInfo = req.user; // authenticated user (admin or teacher)

    // Validate subject exists
    const subject = await Subject.findById(subjectId).populate('school');
    if (!subject) return res.status(404).json(formatResponse(false, "Subject not found"));

    // Validate class exists
    const cls = await Class.findById(classId).populate('school');
    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    // Check if both are in same school
    if (subject.school._id.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Subject not in your school"));

    if (cls.school._id.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Class not in your school"));

    // Check authorization - only admin and teacher allowed
    if (!(['admin', 'teacher'].includes(adminInfo.role.role)))
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    // If auth user is teacher, they can only add subject to their own subjects
    if (adminInfo.role.role === 'teacher') {
      const authTeacher = await Teacher.findOne({ user: adminInfo._id });
      if (!authTeacher) return res.status(403).json(formatResponse(false, "You are not a teacher"));

      if (subject.teacher.toString() !== authTeacher._id.toString())
        return res.status(403).json(formatResponse(false, "You can only add your own subjects to classes"));
    }

    // Add subject to class if not already present
    if (!cls.subjects.includes(subjectId)) {
      cls.subjects.push(subjectId);
      cls.updatedBy = adminInfo._id;
      await cls.save();
    }

    return res.status(200).json(formatResponse(true, "Subject assigned to class successfully", {
      subject: subject._id,
      class: cls._id
    }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error assigning subject to class", null, e.message));
  }
};

// ================= UPDATE SUBJECT =================
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, teacherId, maxMarks } = req.body;

    const sub = await Subject.findById(id);
    if (!sub) return res.status(404).json(formatResponse(false, "Subject not found"));

    if(sub.school.toString() !== req.user.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    if (name) sub.name = name;
    if (teacherId) sub.teacher = teacherId;
    if (maxMarks) sub.maxMarks = maxMarks;

    sub.updatedBy = req.user._id;

    await sub.save();

    return res.status(200).json(formatResponse(true, "Subject updated successfully"));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error updating subject", null, e.message));
  }
};

// ================= DELETE SUBJECT =================
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const sub = await Subject.findById(id);
    if (!sub) return res.status(404).json(formatResponse(false, "Subject not found"));

    if(sub.school.toString() !== req.user.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    // remove from class
    await Class.findByIdAndUpdate(sub.class, {
      $pull: { subjects: sub._id }
    });

    await sub.deleteOne();

    return res.status(200).json(formatResponse(true, "Subject deleted successfully"));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error deleting subject", null, e.message));
  }
};

module.exports = {
  createSubject,
  getSubjectsByClass,
  assignSubjectToClass,
  updateSubject,
  deleteSubject
};