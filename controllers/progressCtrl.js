const Progress = require('../models/progress');
const Student = require('../models/student');
const Subject = require('../models/subject');
const PDFDocument = require('pdfkit');
const Class = require('../models/class');
const Teacher = require('../models/teacher');
const puppeteer = require("puppeteer");
const ejs = require("ejs");
const path = require("path");
const School = require("../models/school");
const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

const getUserRole = (user) => user?.role?.role || user?.role;
const getSchoolId = (user) => user?.school?._id || user?.school;

const resolveStudentByStudentOrUserId = async (id) => {
  let student = await Student.findById(id).populate('user', '_id name school').populate('class', '_id name section grade');
  if (student) return student;
  student = await Student.findOne({ user: id }).populate('user', '_id name school').populate('class', '_id name section grade');
  return student;
};

const ensureTeacherCanUseSubject = async (userId, subject) => {
  const teacher = await Teacher.findOne({ user: userId }).select('_id');
  if (!teacher) return false;
  return subject.teacher?.toString() === teacher._id.toString();
};

const getValidStudentAndSubject = async ({ studentId, subjectId, schoolId }) => {
  const student = await Student.findById(studentId)
    .populate({ path: 'user', select: '_id school' })
    .populate({ path: 'class', select: '_id name section' });
  const subject = await Subject.findById(subjectId)
    .populate({ path: 'teacher', select: '_id user' });

  if (!student || !subject) {
    return { error: formatResponse(false, 'Invalid student/subject'), status: 404 };
  }

  const studentSchoolId = student.user?.school;
  if (!studentSchoolId || studentSchoolId.toString() !== schoolId.toString()) {
    return { error: formatResponse(false, 'Student is not in your school'), status: 403 };
  }

  if (subject.school.toString() !== schoolId.toString()) {
    return { error: formatResponse(false, 'Subject is not in your school'), status: 403 };
  }

  if (!student.class || subject.class.toString() !== student.class._id.toString()) {
    return { error: formatResponse(false, 'Subject is not valid for this student class'), status: 400 };
  }

  return { student, subject };
};

const addProgress = async (req, res) => {
  try {
    const {
      studentId,
      subjectId,
      type,
      title,
      marksObtained,
      totalMarks,
      academicYear
    } = req.body;

    const school = getSchoolId(req.user);
    const role = getUserRole(req.user);

    if (!school) {
      return res.status(400).json(formatResponse(false, 'User school context missing'));
    }

    if (!studentId || !subjectId || !type || !title || marksObtained == null || totalMarks == null || !academicYear) {
      return res.status(400).json(formatResponse(false, 'Missing required fields'));
    }

    const marks = Number(marksObtained);
    const total = Number(totalMarks);
    if (!Number.isFinite(marks) || !Number.isFinite(total) || total <= 0 || marks < 0 || marks > total) {
      return res.status(400).json(formatResponse(false, 'Invalid marks data'));
    }

    const validated = await getValidStudentAndSubject({ studentId, subjectId, schoolId: school });
    if (validated.error) {
      return res.status(validated.status).json(validated.error);
    }
    const { student, subject } = validated;

    if (role === 'teacher') {
      const canUseSubject = await ensureTeacherCanUseSubject(req.user._id, subject);
      if (!canUseSubject) {
        return res.status(403).json(formatResponse(false, 'Teacher can add performance only for assigned subjects'));
      }
    }

    const percentage = (marks / total) * 100;
    const grade = getGrade(percentage);

    const prog = await Progress.create({
      student: studentId,
      subject: subjectId,
      class: student.class?._id || student.class,
      school,
      type,
      title,
      marksObtained: marks,
      totalMarks: total,
      percentage,
      grade,
      academicYear,
      createdBy: req.user._id
    });

    return res.status(201).json(formatResponse(true, "Progress added successfully", prog));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error adding progress", null, e.message));
  }
};

const getClassResult = async (req, res) => {
  try {
    const { classId } = req.params;
    const { type, academicYear } = req.query;
    const school = req.user.school._id;
    const classData = await Class.findById(classId);
    
    if (!classData) return res.status(404).json(formatResponse(false, "Class not found"));

    if(school.toString() !== classData.school.toString()) {
      return res.status(403).json(formatResponse(false, "Class is not belong to your school"));
    }

    const match = { class: classId };
    if (type) match.type = type;
    if (academicYear) match.academicYear = academicYear;

    let result = await Progress.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$student",
          totalMarks: { $sum: "$totalMarks" },
          obtained: { $sum: "$marksObtained" }
        }
      },
      {
        $addFields: {
          percentage: {
            $multiply: [{ $divide: ["$obtained", "$totalMarks"] }, 100]
          }
        }
      },
      { $sort: { percentage: -1 } }
    ]);

    // 🏆 Assign Rank
    result = result.map((r, i) => ({
      ...r,
      rank: i + 1,
      grade: getGrade(r.percentage)
    }));

    return res.status(200).json(formatResponse(true, "Class result fetched successfully", result));
  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching class result", null, e.message));
  }
};

const getSubjectRanking = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const school = req.user.school._id;
    const subjectData = await Subject.findById(subjectId);
    
    if (!subjectData) return res.status(404).json(formatResponse(false, "Subject not found"));

    if(school.toString() !== subjectData.school.toString()) {
      return res.status(403).json(formatResponse(false, "Subject is not belong to your school"));
    }

    let data = await Progress.aggregate([
      { $match: { subject: new mongoose.Types.ObjectId(subjectId) } },
      {
        $group: {
          _id: "$student",
          obtained: { $sum: "$marksObtained" },
          total: { $sum: "$totalMarks" }
        }
      },
      {
        $addFields: {
          percentage: {
            $multiply: [{ $divide: ["$obtained", "$total"] }, 100]
          }
        }
      },
      { $sort: { percentage: -1 } }
    ]);

    data = data.map((d, i) => ({
      ...d,
      rank: i + 1,
      grade: getGrade(d.percentage)
    }));

    return res.status(200).json(formatResponse(true, "Subject ranking fetched successfully", data));
  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching subject ranking", null, e.message));
  }
};

const getStudentPerformance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { type, subjectId, academicYear } = req.query;
    const school = getSchoolId(req.user);
    const role = getUserRole(req.user);
    const student = await resolveStudentByStudentOrUserId(studentId);
    
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    if(!student.user?.school || school.toString() !== student.user.school.toString()) {
      return res.status(403).json(formatResponse(false, "Student is not belong to your school"));
    }

    if (role === 'student' && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'Students can view only their own performance'));
    }

    const filter = { student: student._id, school };

    if (type) filter.type = type;
    if (subjectId) filter.subject = subjectId;
    if (academicYear) filter.academicYear = academicYear;

    const data = await Progress.find(filter)
      .populate('subject', 'name code class teacher')
      .populate({ path: 'class', select: 'name section grade' })
      .sort({ date: -1 });

    return res.status(200).json(formatResponse(true, "Student performance fetched successfully", data));
  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching student performance", null, e.message));
  }
};

const getProgressById = async (req, res) => {
  try {
    const school = getSchoolId(req.user);
    const { progressId } = req.params;

    const item = await Progress.findById(progressId)
      .populate('subject', 'name code class teacher')
      .populate('student', 'studentId rollNumber class')
      .populate('class', 'name section grade');

    if (!item) return res.status(404).json(formatResponse(false, 'Performance record not found'));
    if (item.school.toString() !== school.toString()) {
      return res.status(403).json(formatResponse(false, 'Record is outside your school'));
    }

    return res.status(200).json(formatResponse(true, 'Performance record fetched successfully', item));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching performance record', null, e.message));
  }
};

const updateProgress = async (req, res) => {
  try {
    const school = getSchoolId(req.user);
    const role = getUserRole(req.user);
    const { progressId } = req.params;
    const { subjectId, type, title, marksObtained, totalMarks, academicYear, remarks, date } = req.body;

    const item = await Progress.findById(progressId)
      .populate('student', 'class user')
      .populate({ path: 'subject', select: 'class teacher school' });
    if (!item) return res.status(404).json(formatResponse(false, 'Performance record not found'));
    if (item.school.toString() !== school.toString()) {
      return res.status(403).json(formatResponse(false, 'Record is outside your school'));
    }

    let nextSubject = item.subject;
    if (subjectId && subjectId.toString() !== item.subject?._id?.toString()) {
      const validated = await getValidStudentAndSubject({
        studentId: item.student?._id || item.student,
        subjectId,
        schoolId: school,
      });
      if (validated.error) return res.status(validated.status).json(validated.error);
      nextSubject = validated.subject;
      item.subject = subjectId;
    }

    if (role === 'teacher') {
      const canUseSubject = await ensureTeacherCanUseSubject(req.user._id, nextSubject);
      if (!canUseSubject) {
        return res.status(403).json(formatResponse(false, 'Teacher can update performance only for assigned subjects'));
      }
    }

    if (type) item.type = type;
    if (title) item.title = title;
    if (academicYear) item.academicYear = academicYear;
    if (remarks != null) item.remarks = remarks;
    if (date) item.date = date;

    if (marksObtained != null) item.marksObtained = Number(marksObtained);
    if (totalMarks != null) item.totalMarks = Number(totalMarks);

    if (!Number.isFinite(item.totalMarks) || item.totalMarks <= 0 || item.marksObtained < 0 || item.marksObtained > item.totalMarks) {
      return res.status(400).json(formatResponse(false, 'Invalid marks data'));
    }

    item.percentage = (item.marksObtained / item.totalMarks) * 100;
    item.grade = getGrade(item.percentage);
    item.updatedBy = req.user._id;

    await item.save();
    return res.status(200).json(formatResponse(true, 'Performance updated successfully', item));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error updating performance', null, e.message));
  }
};

const deleteProgress = async (req, res) => {
  try {
    const school = getSchoolId(req.user);
    const role = getUserRole(req.user);
    const { progressId } = req.params;

    const item = await Progress.findById(progressId).populate('subject', 'teacher');
    if (!item) return res.status(404).json(formatResponse(false, 'Performance record not found'));
    if (item.school.toString() !== school.toString()) {
      return res.status(403).json(formatResponse(false, 'Record is outside your school'));
    }

    if (role === 'teacher') {
      const canUseSubject = await ensureTeacherCanUseSubject(req.user._id, item.subject);
      if (!canUseSubject) {
        return res.status(403).json(formatResponse(false, 'Teacher can delete performance only for assigned subjects'));
      }
    }

    await item.deleteOne();
    return res.status(200).json(formatResponse(true, 'Performance deleted successfully'));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error deleting performance', null, e.message));
  }
};

const getValidSubjectsForStudent = async (req, res) => {
  try {
    const school = getSchoolId(req.user);
    const role = getUserRole(req.user);
    const { studentId } = req.params;

    const student = await Student.findById(studentId)
      .populate({ path: 'user', select: '_id school name' })
      .populate({ path: 'class', select: '_id name section grade' });
    if (!student) return res.status(404).json(formatResponse(false, 'Student not found'));

    if (!student.user?.school || student.user.school.toString() !== school.toString()) {
      return res.status(403).json(formatResponse(false, 'Student is not in your school'));
    }

    if (!student.class?._id) {
      return res.status(400).json(formatResponse(false, 'Student is not assigned to a class'));
    }

    const query = {
      class: student.class._id,
      school,
    };

    if (role === 'teacher') {
      const teacher = await Teacher.findOne({ user: req.user._id }).select('_id');
      if (!teacher) {
        return res.status(403).json(formatResponse(false, 'Teacher profile not found'));
      }
      query.teacher = teacher._id;
    }

    const subjects = await Subject.find(query)
      .select('_id name code maxMarks class teacher')
      .sort({ name: 1 });

    return res.status(200).json(formatResponse(true, 'Valid subjects fetched successfully', {
      student: {
        _id: student._id,
        name: student.user?.name,
        class: student.class,
      },
      subjects,
    }));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching valid subjects', null, e.message));
  }
};

// const getClassResult = async (req, res) => {
//   const { classId } = req.params;
//   const { type, academicYear } = req.query;

//   const match = { class: classId };
//   if (type) match.type = type;
//   if (academicYear) match.academicYear = academicYear;

//   const result = await Progress.aggregate([
//     { $match: match },
//     {
//       $group: {
//         _id: "$student",
//         totalMarks: { $sum: "$totalMarks" },
//         obtained: { $sum: "$marksObtained" }
//       }
//     },
//     {
//       $addFields: {
//         percentage: {
//           $multiply: [{ $divide: ["$obtained", "$totalMarks"] }, 100]
//         }
//       }
//     }
//   ]);

//   res.json(result);
// };

const getSubjectPerformance = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const school = getSchoolId(req.user);

    const data = await Progress.find({ subject: subjectId, school })
      .populate('student', 'studentId rollNumber class')
      .sort({ date: -1 });

    return res.status(200).json(formatResponse(true, 'Subject performance fetched successfully', data));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching subject performance', null, e.message));
  }
};

const generateStudentReport = async (req, res) => {
  const { studentId } = req.params;

  const data = await Progress.find({ student: studentId })
    .populate('subject', 'name');

  const doc = new PDFDocument();

  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  doc.fontSize(20).text("School Report Card", { align: 'center' });

  data.forEach(d => {
    doc
      .fontSize(12)
      .text(`${d.subject.name} - ${d.marksObtained}/${d.totalMarks}`);
  });

  doc.end();
};

const getStudentResultByYear = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear, type, subjectId } = req.query;

    const school = req.user.school._id;
    const role = getUserRole(req.user);

    const student = await resolveStudentByStudentOrUserId(studentId);
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    if (!student.user?.school || student.user.school.toString() !== school.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    if (role === 'student' && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'Students can view only their own performance'));
    }

    // ===== FILTER =====
    const match = {
      student: new mongoose.Types.ObjectId(studentId),
      school: school
    };

    match.student = new mongoose.Types.ObjectId(student._id);

    if (academicYear) match.academicYear = academicYear;
    if (type) match.type = type;
    if (subjectId) match.subject = new mongoose.Types.ObjectId(subjectId);

    // ===== AGGREGATION =====
    const data = await Progress.aggregate([
      { $match: match },

      {
        $lookup: {
          from: "subjects",
          localField: "subject",
          foreignField: "_id",
          as: "subject"
        }
      },
      { $unwind: "$subject" },

      {
        $group: {
          _id: "$subject._id",
          subjectName: { $first: "$subject.name" },
          totalMarks: { $sum: "$totalMarks" },
          obtained: { $sum: "$marksObtained" }
        }
      },

      {
        $addFields: {
          percentage: {
            $multiply: [
              { $divide: ["$obtained", "$totalMarks"] },
              100
            ]
          }
        }
      },

      { $sort: { subjectName: 1 } }
    ]);

    // ===== OVERALL =====
    let totalMarks = 0;
    let obtainedMarks = 0;

    const subjects = data.map(d => {
      totalMarks += d.totalMarks;
      obtainedMarks += d.obtained;

      return {
        subjectId: d._id,
        subjectName: d.subjectName,
        obtained: d.obtained,
        total: d.totalMarks,
        percentage: d.percentage.toFixed(2),
        grade: getGrade(d.percentage)
      };
    });

    const overallPercentage = totalMarks
      ? (obtainedMarks / totalMarks) * 100
      : 0;

    const response = {
      studentId,
      academicYear,
      type: type || "all",

      summary: {
        totalMarks,
        obtainedMarks,
        percentage: overallPercentage.toFixed(2),
        grade: getGrade(overallPercentage)
      },

      subjects
    };

    return res.status(200).json(formatResponse(true, "Student result by year fetched successfully", response));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching student result by year", null, e.message));
  }
};

const getGrade = (percentage) => {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "Fail";
};

const generateAdvancedReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const school = req.user.school._id;

    const student = await Student.findById(studentId)
      .populate({
        path: 'user',
        select: 'name school'
      });

    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    if(!student.user?.school || school.toString() !== student.user.school.toString()) {
      return res.status(403).json(formatResponse(false, "Student is not belong to your school"));
    }

    const classData = await Class.findById(student.class)
      .populate({
        path: 'classTeacher',
        populate: {
          path: 'user',
          select: 'name'
        }
      });

    const progress = await Progress.find({ student: studentId })
      .populate('subject', 'name');

    // group by subject
    const subjectMap = {};

    progress.forEach(p => {
      if (!subjectMap[p.subject.name]) {
        subjectMap[p.subject.name] = {
          total: 0,
          obtained: 0
        };
      }
      subjectMap[p.subject.name].total += p.totalMarks;
      subjectMap[p.subject.name].obtained += p.marksObtained;
    });

    const subjects = Object.keys(subjectMap);

    let totalMarks = 0;
    let obtainedMarks = 0;

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    // ===== HEADER =====
    doc
      .fontSize(20)
      .text("Your School Name", { align: "center" });

    doc
      .fontSize(10)
      .text("Address | Phone | Email", { align: "center" });

    doc.moveDown();

    doc
      .fontSize(14)
      .text("Report Card", { align: "center" });

    doc.moveDown();

    // ===== STUDENT INFO =====
    doc.fontSize(10);

    doc.text(`Student Name: ${student.user.name}`);
    doc.text(`Class: ${classData.name} - ${classData.section}`);
    doc.text(`Roll No: ${student.rollNumber}`);
    doc.text(`Father Name: ${student.fatherName}`);

    doc.moveDown();

    // ===== TABLE HEADER =====
    doc.fontSize(12).text("Scholastic Subjects");

    doc.moveDown();

    doc.fontSize(10);

    doc.text("Subject        Marks Obtained     Total     Grade");

    doc.moveDown();

    // ===== SUBJECT DATA =====
    subjects.forEach(sub => {
      const data = subjectMap[sub];

      const percent = (data.obtained / data.total) * 100;
      const grade = getGrade(percent);

      totalMarks += data.total;
      obtainedMarks += data.obtained;

      doc.text(
        `${sub}        ${data.obtained}        ${data.total}        ${grade}`
      );
    });

    doc.moveDown();

    // ===== SUMMARY =====
    const percentage = (obtainedMarks / totalMarks) * 100;

    doc.text(`Total Marks: ${obtainedMarks}/${totalMarks}`);
    doc.text(`Percentage: ${percentage.toFixed(2)}%`);
    doc.text(`Grade: ${getGrade(percentage)}`);

    doc.moveDown();

    // ===== REMARKS =====
    doc.text("Remarks: Good performance");

    doc.moveDown();

    // ===== SIGNATURE =====
    doc.text("Class Teacher Signature: __________");
    doc.text("Principal Signature: __________");

    doc.end();
  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error generating advanced report", null, e.message));
  }
};

const generateStyledReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const academicYear = req.params.academicYear;
    const school = req.user.school._id;
    const student = await Student.findById(studentId).populate('user', '_id name school');
    
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    if(!student.user?.school || school.toString() !== student.user.school.toString()) {
      return res.status(403).json(formatResponse(false, "Student is not belong to your school"));
    }

    const result = await buildCBSEData(studentId, academicYear);

    const html = await ejs.renderFile(
      path.join(__dirname, "../templates/reportCard.ejs"),
      result
    );

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=report.pdf"
    });

    res.send(pdf);

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error generating styled report", null, e.message));
  }
};

const generateCBSEReport = async (req, res) => {
  try {
    const academicYear = req.params.academicYear;
    const studentId = req.params.studentId;
    const school = req.user.school._id;
    const student = await Student.findById(studentId).populate('user', '_id name school');

    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    if(!student.user?.school || school.toString() !== student.user.school.toString()) {
      return res.status(403).json(formatResponse(false, "Student is not belong to your school"));
    }

    const data = await buildCBSEData(studentId, academicYear);

    const html = await ejs.renderFile(
      path.join(__dirname, "../templates/cbseReportCard.ejs"),
      data
    );

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "load" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=cbse-report.pdf"
    });

    res.send(pdf);
  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error generating CBSE report", null, e.message));
  }
};


const buildCBSEData = async (studentId, academicYear = "2025-26") => {
  try {
    // ===== STUDENT =====
    const student = await Student.findById(studentId)
      .populate({
        path: "user",
        select: "name image school"
      });

    if (!student) throw new Error("Student not found");

    // ===== CLASS =====
    const classData = await Class.findById(student.class);

    // ===== SCHOOL =====
    const school = await School.findById(student.user?.school);

    // ===== PROGRESS =====
    const progress = await Progress.find({
      student: studentId,
      academicYear
    }).populate("subject", "name");

    // ===== GROUP SUBJECTS =====
    const subjectMap = {};

    progress.forEach(p => {
      const subName = p.subject.name;

      if (!subjectMap[subName]) {
        subjectMap[subName] = {
          name: subName,
          term1: 0,
          term2: 0,
          total: 0
        };
      }

      if (p.type === "exam") {
        subjectMap[subName].term2 += p.marksObtained;
      } else {
        subjectMap[subName].term1 += p.marksObtained;
      }

      subjectMap[subName].total += p.marksObtained;
    });

    // ===== SUBJECT ARRAY =====
    let totalMarks = 0;
    let obtainedMarks = 0;

    const subjects = Object.values(subjectMap).map(s => {
      const term1Grade = getGrade((s.term1 / 100) * 100 || 0);
      const term2Grade = getGrade((s.term2 / 100) * 100 || 0);
      const finalPercent = (s.total / 200) * 100 || 0;

      totalMarks += 200;
      obtainedMarks += s.total;

      return {
        name: s.name,
        term1: s.term1,
        grade1: term1Grade,
        term2: s.term2,
        grade2: term2Grade,
        total: s.total,
        finalGrade: getGrade(finalPercent)
      };
    });

    // ===== SUMMARY =====
    const percentage = (obtainedMarks / totalMarks) * 100;

    // ===== RANK =====
    const classRankData = await Progress.aggregate([
      {
        $match: {
          class: new mongoose.Types.ObjectId(student.class),
          academicYear
        }
      },
      {
        $group: {
          _id: "$student",
          obtained: { $sum: "$marksObtained" },
          total: { $sum: "$totalMarks" }
        }
      },
      {
        $addFields: {
          percentage: {
            $multiply: [{ $divide: ["$obtained", "$total"] }, 100]
          }
        }
      },
      { $sort: { percentage: -1 } }
    ]);

    let rank = 0;
    classRankData.forEach((r, i) => {
      if (r._id.toString() === studentId.toString()) {
        rank = i + 1;
      }
    });

    // ===== ATTENDANCE =====
    const attendanceRecords = await Attendance.find({
      user: student.user._id
    });

    const present = attendanceRecords.filter(a => a.status === "present").length;
    const attendance = attendanceRecords.length
      ? ((present / attendanceRecords.length) * 100).toFixed(0) + "%"
      : "N/A";

    // ===== FINAL OBJECT =====
    return {
      school: {
        name: school?.schoolName || school?.name || 'School',
        address: school.address
      },

      student: {
        name: student.user.name,
        fatherName: student.fatherName,
        motherName: student.motherName,
        rollNumber: student.rollNumber,
        dob: student.dateOfBirth,
        photo: student.user.image || ""
      },

      classData: {
        name: classData.name,
        section: classData.section
      },

      academicYear,

      subjects,

      summary: {
        totalMarks,
        obtainedMarks,
        percentage: percentage.toFixed(2),
        grade: getGrade(percentage),
        rank,
        attendance
      },

      coScholastic: [
        { name: "Discipline", grade: "A" },
        { name: "Sports", grade: "B" }
      ],

      remarks:
        percentage > 75
          ? "Excellent performance"
          : percentage > 50
          ? "Good performance"
          : "Needs improvement"
    };
  } catch (e) {
    throw new Error(`Error building CBSE data: ${e.message}`);
  }
};


module.exports = {
  addProgress,
  updateProgress,
  deleteProgress,
  getProgressById,
  getValidSubjectsForStudent,
  getStudentPerformance,
  getClassResult,
  getSubjectRanking,
  getSubjectPerformance,
  getStudentResultByYear,
  generateStudentReport,
  generateAdvancedReport,
  generateStyledReport,
  generateCBSEReport,
  buildCBSEData,
  getGrade,
};