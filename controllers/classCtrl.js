const Class = require('../models/class');
const Student = require('../models/student');
const Teacher = require('../models/teacher');
const User = require('../models/user');
const Subject = require('../models/subject');

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
    const { name, grade, section, capacity=100, room='R001',classTeacher } = req.body;
    if(!name || !grade || !section) return res.status(400).json(formatResponse(false, "Name, grade and section are required"));

    const school = req.user.school._id;

    const getClass = await Class.findOne({ name, grade, section, school });
    if (getClass) return res.status(400).json(formatResponse(false, "Class with same name, grade and section already exists in your school"));

    // find the teacher if classteacher is provided and check if that is in same school and not class teacher of other class
   
    if(classTeacher){
      const teacher = await Teacher.findById(classTeacher).populate({ path: 'user', select: 'school' });
      if(!teacher) return res.status(404).json(formatResponse(false, "Class teacher not found"));
      if(teacher.user.school.toString() !== school.toString()) return res.status(403).json(formatResponse(false, "Class teacher not in your school"));
      if(teacher.classTeacher || teacher.class) return res.status(400).json(formatResponse(false, "Teacher is already assigned as class teacher for another class"));
    }

    const cls = await Class.create({
      name,
      grade,
      section,
      capacity,
      room,
      school,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      classTeacher: classTeacher || null
    });

    if(classTeacher){
      const teacher = await Teacher.findById(classTeacher).populate({ path: 'user', select: 'school' });
      teacher.classTeacher = cls._id; // Assigning the class to the teacher
      teacher.class = cls._id; // Assigning the class to the teacher
      await teacher.save();
    }

    
    return res.status(201).json(formatResponse(true, "Class created successfully", cls));

  } catch (e) {
    console.log("Error creating class: ", e);
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

    if (teacher.classTeacher && teacher.classTeacher.toString() !== classId){
      return res.status(400).json(formatResponse(false, "Teacher is already assigned as class teacher for another class"));
    }

    if(teacher.class && teacher.class.toString() !== classId){
      return res.status(400).json(formatResponse(false, "Teacher is already assigned to another class"));
    }

    // first remove the class teacher from the previous class if any for the teacher
    if (teacher.classTeacher && teacher.classTeacher.toString() !== classId) {
      const previousClass = await Class.findById(teacher.classTeacher);
      if (previousClass) {
        previousClass.classTeacher = null;
        await previousClass.save();
      }
      teacher.classTeacher = classId; // Assigning the new class to the teacher
      teacher.class = classId;
      await teacher.save();
    }

   // Class teacher is same then no need to update just throw success message
    if (cls.classTeacher && cls.classTeacher.toString() === teacherId) {
      return res.status(200).json(formatResponse(true, "Class teacher assigned successfully"));
    }

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

      cls.classTeacher = { ...cls.classTeacher, name: cls.classTeacher?.user?.name, email: cls.classTeacher?.user?.email, phone: cls.classTeacher?.user?.phone };

    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    if(cls.school.toString() !== req.user.school._id.toString())
      return res.status(403).json(formatResponse(false, "Class not in your school"));

    const students = await Student.find({ class: cls._id })
      .populate({
        path: 'user',
        select: '_id name email phone'
      });

      // console.log("Students in class: ", students);

    return res.status(200).json(formatResponse(true, "Class fetched successfully", {
      ...cls,
      students : [...students.map(s => ({ _id: s._id, name: s.user.name, email: s.user.email, phone: s.user.phone , rollNumber : s.rollNumber , user: s.user })) ]
    }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching class", null, e.message));
  }
};

const getClasses = async (req, res) => {
  try {
    const schoolId = req.user.school._id;
    // console.log("schoolId ", schoolId);
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

    const classIds = classes.map((cls) => cls._id);
    const studentCounts = await Student.aggregate([
      { $match: { class: { $in: classIds } } },
      { $group: { _id: '$class', count: { $sum: 1 } } },
    ]);

    const countMap = new Map(studentCounts.map((entry) => [entry._id.toString(), entry.count]));
    const classesWithCount = classes.map((cls) => ({
      ...cls,
      studentCount: countMap.get(cls._id.toString()) || 0,
    }));

    return res.status(200).json(formatResponse(true, "Classes fetched successfully", classesWithCount));
  } catch (e) {
    console.log("Error fetching classes: ", e);
    return res.status(500).json(formatResponse(false, "Error fetching classes", null, e.message));
  }
};

// ================= GET STUDENTS BY CLASS ID =================
const getClassStudents = async (req, res) => {
  try {
    const { classId } = req.params;

    const cls = await Class.findById(classId).select('_id school').lean();
    if (!cls) return res.status(404).json(formatResponse(false, 'Class not found'));

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, 'Class not in your school'));
    }

    const students = await Student.find({ class: classId })
      .populate({
        path: 'user',
        select: '_id name email phone',
      })
      .lean();

    const normalized = students.map((student) => ({
      _id: student._id,
      studentId: student.studentId,
      rollNumber: student.rollNumber,
      fatherName: student.fatherName,
      class: student.class,
      user: student.user,
      name: student?.user?.name || '',
      email: student?.user?.email || '',
      phone: student?.user?.phone || '',
    }));

    return res.status(200).json(formatResponse(true, 'Class students fetched successfully', normalized));
  } catch (e) {
    return res.status(500).json(formatResponse(false, 'Error fetching class students', null, e.message));
  }
};


// ================= GET COMPREHENSIVE CLASS INFO =================
/**
 * Get all class information including class details, teacher info, students, and subjects
 * Admin and Teacher only
 */
const getClassInfo = async (req, res) => {
  try {
    const { classId } = req.params;
    const currentUserSchool = req.user.school._id;

    if (!classId) {
      return res.status(400).json(formatResponse(false, "classId is required in path"));
    }

    // Fetch class with class teacher
    const cls = await Class.findById(classId)
      .populate({
        path: "classTeacher",
        populate: { path: "user", select: "_id name email phone image username" }
      })
      .populate("subjects")
      .lean();

    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    // School isolation check
    if (cls.school.toString() !== currentUserSchool.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    // Fetch all students in class
    const students = await Student.find({ class: classId })
      .populate({ path: "user", select: "_id name email phone image username" })
      .select("_id user rollNumber studentId fatherName motherName status")
      .lean();

    // Fetch all subjects for the class with teacher info
    const subjects = await Subject.find({ _id: { $in: cls.subjects } })
      .populate({
        path: "teacher",
        populate: { path: "user", select: "_id name email phone image username" }
      })
      .select("_id name code maxMarks teacher")
      .lean();

    // Build response: class teacher basic info
    const classTeacherInfo = cls.classTeacher
      ? {
          _id: cls.classTeacher._id,
          name: cls.classTeacher.user?.name || null,
          email: cls.classTeacher.user?.email || null,
          phone: cls.classTeacher.user?.phone || null,
          image: cls.classTeacher.user?.image || null,
          username: cls.classTeacher.user?.username || null
        }
      : null;

    // Build response: students with requested fields only
    const studentList = students.map(student => ({
      _id: student._id,
      studentId: student.studentId,
      rollNumber: student.rollNumber,
      name: student.user?.name || null,
      email: student.user?.email || null,
      phone: student.user?.phone || null,
      image: student.user?.image || null,
      username: student.user?.username || null,
      fatherName: student.fatherName || null,
      motherName: student.motherName || null
    })).sort((a, b) => {
      const aRoll = String(a.rollNumber).padStart(10, '0');
      const bRoll = String(b.rollNumber).padStart(10, '0');
      return aRoll.localeCompare(bRoll, undefined, { numeric: true });
    });

    // Build response: subjects with subject teacher basic info
    const subjectList = subjects.map(subject => ({
      _id: subject._id,
      name: subject.name,
      code: subject.code,
      maxMarks: subject.maxMarks,
      teacher: subject.teacher
        ? {
            _id: subject.teacher._id,
            name: subject.teacher.user?.name || null,
            email: subject.teacher.user?.email || null,
            phone: subject.teacher.user?.phone || null,
            image: subject.teacher.user?.image || null,
            username: subject.teacher.user?.username || null
          }
        : null
    }));

    // Build final response
    const response = {
      _id: cls._id,
      name: cls.name,
      grade: cls.grade,
      section: cls.section,
      capacity: cls.capacity,
      room: cls.room,
      classTeacher: classTeacherInfo,
      studentCount: students.length,
      students: studentList,
      subjectCount: subjects.length,
      subjects: subjectList,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt
    };

    return res.status(200).json(formatResponse(true, "Class information fetched successfully", response));
  } catch (e) {
    console.error("Error fetching class info:", e);
    return res.status(500).json(formatResponse(false, "Error fetching class info", null, e.message));
  }
};

module.exports = {
  createClass,
  assignClassTeacher,
  assignStudent,
  removeStudent,
  getClassById,
  getClasses,
  getClassStudents,
  getClassInfo
};