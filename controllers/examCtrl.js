const Exam = require('../models/exam');
const Subject = require('../models/subject');
const Class = require('../models/class');
const School = require('../models/school');
const Teacher = require('../models/teacher');
const mongoose = require('mongoose');

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

const getSchoolId = (user) => user?.school?._id || user?.school;
const getUserRole = (user) => user?.role?.role || user?.role;

// ==================== VALIDATION HELPERS ====================
const validateExamData = ({
  name,
  subject,
  class: classId,
  totalMarks,
  minimumPassingMarks,
  academicYear,
}) => {
  const errors = [];

  if (!name || !name.trim()) errors.push('Exam name is required');
  if (!subject) errors.push('Subject is required');
  if (!classId) errors.push('Class is required');
  if (!totalMarks || totalMarks <= 0) errors.push('Total marks must be greater than 0');
  if (minimumPassingMarks == null || minimumPassingMarks < 0)
    errors.push('Minimum passing marks cannot be negative');
  if (minimumPassingMarks > totalMarks)
    errors.push('Minimum passing marks cannot exceed total marks');
  if (!academicYear || !academicYear.trim()) errors.push('Academic year is required');

  return errors;
};

// ==================== CREATE EXAM ====================
const createExam = async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const school = getSchoolId(req.user);

    // Only admin can create exams
    if (role !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can create exams'));
    }

    const {
      name,
      code,
      description,
      subject,
      class: classId,
      totalMarks,
      minimumPassingMarks,
      gradingScale,
      term,
      sequenceOrder,
      scheduledDate,
      duration,
      academicYear,
      isActive,
    } = req.body;

    // Validate input
    const validationErrors = validateExamData({
      name,
      subject,
      class: classId,
      totalMarks,
      minimumPassingMarks,
      academicYear,
    });

    if (validationErrors.length > 0) {
      return res.status(400).json(
        formatResponse(false, 'Validation failed', null, validationErrors.join(', '))
      );
    }

    // Verify school, class, and subject exist and belong to the school
    const [schoolDoc, classDoc, subjectDoc] = await Promise.all([
      School.findById(school),
      Class.findById(classId),
      Subject.findById(subject),
    ]);

    if (!schoolDoc) {
      return res.status(404).json(formatResponse(false, 'School not found'));
    }

    if (!classDoc || classDoc.school.toString() !== school.toString()) {
      return res.status(400).json(formatResponse(false, 'Invalid class for this school'));
    }

    if (!subjectDoc || subjectDoc.school.toString() !== school.toString()) {
      return res.status(400).json(formatResponse(false, 'Invalid subject for this school'));
    }

    if (subjectDoc.class.toString() !== classId.toString()) {
      return res.status(400).json(
        formatResponse(false, 'Subject does not belong to the specified class')
      );
    }

    // Create exam
    const exam = new Exam({
      name: name.trim(),
      code: code?.trim(),
      description,
      school,
      class: classId,
      subject,
      totalMarks,
      minimumPassingMarks,
      gradingScale: gradingScale || {},
      term: term || '1',
      sequenceOrder: sequenceOrder || 1,
      scheduledDate,
      duration,
      academicYear: academicYear.trim(),
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });

    await exam.save();

    const populatedExam = await exam.populate([
      { path: 'school', select: 'schoolName' },
      { path: 'class', select: 'name section' },
      { path: 'subject', select: 'name code' },
      { path: 'createdBy', select: 'name' },
    ]);

    return res.status(201).json(
      formatResponse(true, 'Exam created successfully', populatedExam)
    );
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error creating exam', null, e.message));
  }
};

// ==================== GET ALL EXAMS ====================
const getExams = async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const school = getSchoolId(req.user);
    const { classId, subjectId, academicYear, term, isActive } = req.query;
    const { page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = { school };

    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json(formatResponse(false, 'Invalid class ID'));
      }
      filter.class = classId;
    }

    if (subjectId) {
      if (!mongoose.Types.ObjectId.isValid(subjectId)) {
        return res.status(400).json(formatResponse(false, 'Invalid subject ID'));
      }
      filter.subject = subjectId;
    }

    if (academicYear) {
      filter.academicYear = academicYear.trim();
    }

    if (term) {
      filter.term = term;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Get total count
    const totalItems = await Exam.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / parseInt(limit));

    // Get paginated results
    const exams = await Exam.find(filter)
      .populate([
        { path: 'school', select: 'schoolName' },
        { path: 'class', select: 'name section' },
        { path: 'subject', select: 'name code' },
        { path: 'createdBy', select: 'name' },
      ])
      .sort({ sequenceOrder: 1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return res.status(200).json(
      formatResponse(true, 'Exams fetched successfully', {
        exams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalItems,
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      })
    );
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching exams', null, e.message));
  }
};

// ==================== GET SINGLE EXAM ====================
const getExamById = async (req, res) => {
  try {
    const { examId } = req.params;
    const school = getSchoolId(req.user);

    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json(formatResponse(false, 'Invalid exam ID'));
    }

    const exam = await Exam.findById(examId).populate([
      { path: 'school', select: 'schoolName' },
      { path: 'class', select: 'name section' },
      { path: 'subject', select: 'name code teacher' },
      { path: 'createdBy', select: 'name' },
      { path: 'updatedBy', select: 'name' },
    ]);

    if (!exam) {
      return res.status(404).json(formatResponse(false, 'Exam not found'));
    }

    if (exam.school._id.toString() !== school.toString()) {
      return res.status(403).json(formatResponse(false, 'Unauthorized access to this exam'));
    }

    return res.status(200).json(formatResponse(true, 'Exam fetched successfully', exam));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching exam', null, e.message));
  }
};

// ==================== UPDATE EXAM ====================
const updateExam = async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const school = getSchoolId(req.user);
    const { examId } = req.params;

    // Only admin can update exams
    if (role !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can update exams'));
    }

    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json(formatResponse(false, 'Invalid exam ID'));
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json(formatResponse(false, 'Exam not found'));
    }

    if (exam.school.toString() !== school.toString()) {
      return res.status(403).json(formatResponse(false, 'Unauthorized access to this exam'));
    }

    const {
      name,
      code,
      description,
      totalMarks,
      minimumPassingMarks,
      gradingScale,
      term,
      sequenceOrder,
      scheduledDate,
      duration,
      isActive,
    } = req.body;

    // Validate if marks are being updated
    if (totalMarks !== undefined || minimumPassingMarks !== undefined) {
      const newTotal = totalMarks ?? exam.totalMarks;
      const newMinimum = minimumPassingMarks ?? exam.minimumPassingMarks;

      if (newTotal <= 0) {
        return res.status(400).json(formatResponse(false, 'Total marks must be greater than 0'));
      }

      if (newMinimum < 0) {
        return res.status(400).json(
          formatResponse(false, 'Minimum passing marks cannot be negative')
        );
      }

      if (newMinimum > newTotal) {
        return res.status(400).json(
          formatResponse(false, 'Minimum passing marks cannot exceed total marks')
        );
      }
    }

    // Update allowed fields
    if (name !== undefined) exam.name = name.trim();
    if (code !== undefined) exam.code = code?.trim();
    if (description !== undefined) exam.description = description;
    if (totalMarks !== undefined) exam.totalMarks = totalMarks;
    if (minimumPassingMarks !== undefined) exam.minimumPassingMarks = minimumPassingMarks;
    if (gradingScale !== undefined) exam.gradingScale = gradingScale;
    if (term !== undefined) exam.term = term;
    if (sequenceOrder !== undefined) exam.sequenceOrder = sequenceOrder;
    if (scheduledDate !== undefined) exam.scheduledDate = scheduledDate;
    if (duration !== undefined) exam.duration = duration;
    if (isActive !== undefined) exam.isActive = isActive;

    exam.updatedBy = req.user._id;
    await exam.save();

    const updatedExam = await exam.populate([
      { path: 'school', select: 'schoolName' },
      { path: 'class', select: 'name section' },
      { path: 'subject', select: 'name code' },
      { path: 'createdBy', select: 'name' },
      { path: 'updatedBy', select: 'name' },
    ]);

    return res.status(200).json(
      formatResponse(true, 'Exam updated successfully', updatedExam)
    );
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error updating exam', null, e.message));
  }
};

// ==================== DELETE EXAM ====================
const deleteExam = async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const school = getSchoolId(req.user);
    const { examId } = req.params;

    // Only admin can delete exams
    if (role !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can delete exams'));
    }

    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json(formatResponse(false, 'Invalid exam ID'));
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json(formatResponse(false, 'Exam not found'));
    }

    if (exam.school.toString() !== school.toString()) {
      return res.status(403).json(formatResponse(false, 'Unauthorized access to this exam'));
    }

    // Optional: Check if exam has associated results before deleting
    const Progress = require('../models/progress');
    const linkedResults = await Progress.countDocuments({ exam: examId });

    if (linkedResults > 0) {
      return res.status(400).json(
        formatResponse(false, `Cannot delete exam with ${linkedResults} linked results`)
      );
    }

    await Exam.findByIdAndDelete(examId);

    return res.status(200).json(formatResponse(true, 'Exam deleted successfully'));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error deleting exam', null, e.message));
  }
};

// ==================== GET EXAMS FOR A SUBJECT/CLASS ====================
const getExamsForSubject = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { academicYear } = req.query;
    const school = getSchoolId(req.user);

    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json(formatResponse(false, 'Invalid class or subject ID'));
    }

    // Verify subject belongs to class
    const subject = await Subject.findById(subjectId);
    if (!subject || subject.class.toString() !== classId) {
      return res.status(400).json(
        formatResponse(false, 'Subject does not belong to the specified class')
      );
    }

    const filter = {
      school,
      class: classId,
      subject: subjectId,
      isActive: true,
    };

    if (academicYear) {
      filter.academicYear = academicYear;
    }

    const exams = await Exam.find(filter)
      .populate([
        { path: 'subject', select: 'name code' },
        { path: 'createdBy', select: 'name' },
      ])
      .sort({ sequenceOrder: 1 });

    return res.status(200).json(
      formatResponse(true, 'Exams fetched successfully', exams)
    );
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching exams', null, e.message));
  }
};

module.exports = {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  getExamsForSubject,
};
