const Subject = require('../models/subject');
const Class = require('../models/class');
const Teacher = require('../models/teacher');
const Student = require('../models/student');
const Exam = require('../models/exam');
const Progress = require('../models/progress');
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

const resolveTeacherId = async (userId) => {
  const teacher = await Teacher.findOne({ user: userId }).select('_id');
  return teacher?._id || null;
};

const canTeacherAccessSubject = async (userId, subject) => {
  const teacherId = await resolveTeacherId(userId);
  if (!teacherId) return false;
  return subject.teacher?.toString() === teacherId.toString();
};

const computeAverage = (records = []) => {
  if (!records.length) return 0;
  const total = records.reduce((sum, record) => sum + Number(record?.percentage || 0), 0);
  return Number((total / records.length).toFixed(2));
};

const getGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'Fail';
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

    if (teacher.school.toString() !== school.toString())
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
    if(teacher.teachSubjects === undefined) {
      teacher.teachSubjects = [];
    }
    if(teacher.teachSclass === undefined) {
      teacher.teachSclass = [];
    }
    teacher.teachSubjects.push(sub._id);
    teacher.teachSclass.push(classId);
    await cls.save();
    await teacher.save();

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

const getSubject = async (req, res) => {
  try {
    const schoolId = req.user.school._id;
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }
    const subjects = await Subject.find({ school: schoolId })
      .populate('class', 'name')
      .populate({ path: 'teacher', populate: { path: 'user', select: '_id name email phone' } })
      .populate('school', '_id name')
      .populate('class', '_id name');
    if (!subjects) {
      return res.status(404).json(formatResponse(false, 'No subjects found for your school',[]));
    }
    return res.status(200).json(formatResponse(true, "Subjects fetched successfully", subjects));
  }catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching subjects", null, e.message));
  }
}

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

    const prevClassId = subject.class ? subject.class.toString() : null;

    // If subject already assigned to a class, remove it from that class first
    if (prevClassId && prevClassId !== classId) {
      console.log(`Subject ${subjectId} is being reassigned from class ${prevClassId} to class ${classId}`);
      const prevClass = await Class.findById(prevClassId);
      if (prevClass) {
        prevClass.subjects.pull(subject._id);
        await prevClass.save();
      }
    }


    // Add subject to class if not already present
    if (!cls.subjects.includes(subjectId)) {
      cls.subjects.push(subjectId);
      cls.updatedBy = adminInfo._id;
      await cls.save();
    }

    subject.class = classId;
    subject.updatedBy = adminInfo._id;
    await subject.save();
    

    return res.status(200).json(formatResponse(true, "Subject assigned to class successfully", {
      subject: subject._id,
      class: cls._id
    }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error assigning subject to class", null, e.message));
  }
};

const getSubjectDashboard = async (req, res) => {
  try {
    const schoolId = getSchoolId(req.user);
    const role = getUserRole(req.user);

    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const subjectFilter = { school: schoolId };
    if (role === 'teacher') {
      const teacherId = await resolveTeacherId(req.user._id);
      if (!teacherId) {
        return res.status(403).json(formatResponse(false, 'Teacher profile not found'));
      }
      subjectFilter.teacher = teacherId;
    }

    const subjects = await Subject.find(subjectFilter)
      .populate('class', '_id name section grade')
      .populate({ path: 'teacher', populate: { path: 'user', select: '_id name email phone' } })
      .sort({ name: 1 });

    const subjectIds = subjects.map((subject) => subject._id);
    const classes = Array.from(new Set(subjects.map((subject) => subject.class?._id?.toString()).filter(Boolean)));

    const [studentCounts, examCounts, progressAgg] = await Promise.all([
      classes.length
        ? Student.aggregate([
            { $match: { class: { $in: classes.map((id) => new mongoose.Types.ObjectId(id)) } } },
            { $group: { _id: '$class', count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      subjectIds.length
        ? Exam.aggregate([
            { $match: { subject: { $in: subjectIds } } },
            { $group: { _id: '$subject', count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      subjectIds.length
        ? Progress.aggregate([
            { $match: { subject: { $in: subjectIds }, school: new mongoose.Types.ObjectId(schoolId) } },
            {
              $group: {
                _id: '$subject',
                count: { $sum: 1 },
                totalMarks: { $sum: '$totalMarks' },
                obtainedMarks: { $sum: '$marksObtained' },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const studentCountMap = new Map(studentCounts.map((item) => [item._id.toString(), item.count]));
    const examCountMap = new Map(examCounts.map((item) => [item._id.toString(), item.count]));
    const progressMap = new Map(progressAgg.map((item) => [item._id.toString(), item]));

    const data = subjects.map((subject) => {
      const progress = progressMap.get(subject._id.toString()) || {};
      const totalMarks = Number(progress.totalMarks || 0);
      const obtainedMarks = Number(progress.obtainedMarks || 0);
      const averagePercentage = totalMarks > 0 ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2)) : 0;

      return {
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        class: subject.class,
        teacher: subject.teacher,
        maxMarks: subject.maxMarks,
        studentCount: studentCountMap.get(subject.class?._id?.toString() || '') || 0,
        examCount: examCountMap.get(subject._id.toString()) || 0,
        progressCount: Number(progress.count || 0),
        averagePercentage,
        grade: getGrade(averagePercentage),
      };
    });

    return res.status(200).json(formatResponse(true, 'Subject dashboard fetched successfully', data));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching subject dashboard', null, e.message));
  }
};

const getSubjectDetails = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { academicYear } = req.query;
    const schoolId = getSchoolId(req.user);
    const role = getUserRole(req.user);

    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json(formatResponse(false, 'Invalid subject ID'));
    }

    const subject = await Subject.findById(subjectId)
      .populate('class', '_id name section grade school')
      .populate({ path: 'teacher', populate: { path: 'user', select: '_id name email phone' } });

    if (!subject) {
      return res.status(404).json(formatResponse(false, 'Subject not found'));
    }

    if (!subject.school || subject.school.toString() !== schoolId.toString()) {
      return res.status(403).json(formatResponse(false, 'Unauthorized school access'));
    }

    if (role === 'teacher') {
      const canAccess = await canTeacherAccessSubject(req.user._id, subject);
      if (!canAccess) {
        return res.status(403).json(formatResponse(false, 'Teacher can access only assigned subjects'));
      }
    }

    const classId = subject.class?._id || subject.class;
    const [students, exams, progress, subjectRanking] = await Promise.all([
      Student.find({ class: classId })
        .populate({ path: 'user', select: '_id name email phone image' })
        .select('_id user class studentId rollNumber status')
        .sort({ rollNumber: 1, createdAt: 1 }),
      Exam.find({ subject: subject._id, school: schoolId, ...(academicYear ? { academicYear } : {}) })
        .sort({ sequenceOrder: 1, createdAt: 1 })
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name'),
      Progress.find({ subject: subject._id, school: schoolId, ...(academicYear ? { academicYear } : {}) })
        .populate({ path: 'student', populate: { path: 'user', select: '_id name email phone image' } })
        .sort({ date: -1, createdAt: -1 }),
      Progress.aggregate([
        {
          $match: {
            subject: new mongoose.Types.ObjectId(subject._id),
            school: new mongoose.Types.ObjectId(schoolId),
            ...(academicYear ? { academicYear } : {}),
          },
        },
        {
          $group: {
            _id: '$student',
            totalMarks: { $sum: '$totalMarks' },
            obtainedMarks: { $sum: '$marksObtained' },
          },
        },
        {
          $addFields: {
            percentage: {
              $cond: [
                { $gt: ['$totalMarks', 0] },
                { $multiply: [{ $divide: ['$obtainedMarks', '$totalMarks'] }, 100] },
                0,
              ],
            },
          },
        },
        { $sort: { percentage: -1 } },
      ]),
    ]);

    const latestProgressByStudent = new Map();
    progress.forEach((record) => {
      const studentId = record.student?._id?.toString() || record.student?.toString();
      if (!studentId) return;
      if (!latestProgressByStudent.has(studentId)) {
        latestProgressByStudent.set(studentId, []);
      }
      latestProgressByStudent.get(studentId).push(record);
    });

    const studentsWithSummary = students.map((student) => {
      const studentId = student._id.toString();
      const records = latestProgressByStudent.get(studentId) || [];
      const totalMarks = records.reduce((sum, record) => sum + Number(record.totalMarks || 0), 0);
      const obtainedMarks = records.reduce((sum, record) => sum + Number(record.marksObtained || 0), 0);
      const averagePercentage = totalMarks > 0 ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2)) : 0;

      return {
        _id: student._id,
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        status: student.status,
        user: student.user,
        class: student.class,
        progressCount: records.length,
        totalMarks,
        obtainedMarks,
        averagePercentage,
        grade: getGrade(averagePercentage),
      };
    });

    const totalStudents = studentsWithSummary.length;
    const totalExams = exams.length;
    const totalProgress = progress.length;
    const averagePercentage = computeAverage(progress);

    return res.status(200).json(
      formatResponse(true, 'Subject details fetched successfully', {
        subject,
        stats: {
          totalStudents,
          totalExams,
          totalProgress,
          averagePercentage,
          grade: getGrade(averagePercentage),
        },
        students: studentsWithSummary,
        exams,
        progress,
        ranking: subjectRanking.map((item, index) => ({
          ...item,
          rank: index + 1,
          grade: getGrade(item.percentage),
        })),
      })
    );
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching subject details', null, e.message));
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
  deleteSubject,
  getSubject,
  getSubjectDashboard,
  getSubjectDetails,
};