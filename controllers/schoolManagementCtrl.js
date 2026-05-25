const mongoose = require('mongoose');
const User = require('../models/user');
const Role = require('../models/role');
const Subscription = require('../models/subscription');
const Class = require('../models/class');
const Subject = require('../models/subject');
const Student = require('../models/student');
const Teacher = require('../models/teacher');
const Staff = require('../models/staff');
const Admin = require('../models/admin');

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data ? { data } : {}),
  ...(error ? { error } : {}),
});

const getSchoolId = (req) => req.user?.school?._id || req.user?.school || req.user?._id;

const isValidId = (id) => Boolean(id) && mongoose.Types.ObjectId.isValid(id);

const getRoleDoc = async (roleName) => Role.findOne({ role: roleName }).select('_id role');

const baseUserProjection = '_id name username email phone smsPhone whatsappPhone telegramChatId image city state address pinCode gender active school role createdAt updatedAt';

const buildCommonUser = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  phone: user.phone,
  smsPhone: user.smsPhone,
  whatsappPhone: user.whatsappPhone,
  telegramChatId: user.telegramChatId,
  image: user.image,
  city: user.city,
  state: user.state,
  address: user.address,
  pinCode: user.pinCode,
  gender: user.gender,
  active: user.active,
  school: user.school,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const findProfileByRole = async (roleName, userId) => {
  if (roleName === 'admin') return Admin.findOne({ user: userId }).select('_id user');
  if (roleName === 'teacher') return Teacher.findOne({ user: userId }).populate('class', '_id name grade section school active').populate('classTeacher', '_id name grade section school active').populate('teachSubjects', '_id name code class school active').populate('teachSclass', '_id name grade section school active');
  if (roleName === 'staff') return Staff.findOne({ user: userId }).select('_id user staffId position department hireDate salary');
  if (roleName === 'student') return Student.findOne({ user: userId }).populate('class', '_id name grade section school active').populate('user', '_id name email phone');
  return null;
};

const buildUserRecord = async (user, roleName) => {
  const profileDoc = await findProfileByRole(roleName, user._id);
  const profile = profileDoc?.toObject ? profileDoc.toObject() : profileDoc;
  const common = buildCommonUser(user);
  return {
    ...common,
    ...(profile || {}),
    ...(roleName === 'staff' ? { designation: profile?.position || profile?.designation || '' } : {}),
    user: common,
    profile,
  };
};

const createAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const schoolId = getSchoolId(req);
    const { name, username, email, phone, password, city, state, address, pinCode, gender, image } = req.body;

    if (!name || !username || !password) {
      await session.abortTransaction();
      return res.status(400).json(formatResponse(false, 'Name, username, and password are required'));
    }

    const adminRole = await getRoleDoc('admin');
    if (!adminRole) {
      await session.abortTransaction();
      return res.status(400).json(formatResponse(false, 'Admin role not found'));
    }

    const existing = await User.findOne({
      school: schoolId,
      $or: [
        { username },
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    }).session(session);

    if (existing) {
      await session.abortTransaction();
      return res.status(409).json(formatResponse(false, 'Admin already exists with the same username, email, or phone'));
    }

    const createdUser = new User({
      name,
      username,
      email,
      phone,
      password,
      role: adminRole._id,
      school: schoolId,
      city,
      state,
      address,
      pinCode,
      gender,
      image,
      active: true,
    });

    await createdUser.save({ session });
    await Admin.create([{ user: createdUser._id }], { session });

    await session.commitTransaction();

    return res.status(201).json(formatResponse(true, 'Admin created successfully', await buildUserRecord(createdUser, 'admin')));
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json(formatResponse(false, 'Error creating admin', null, error.message));
  } finally {
    session.endSession();
  }
};

const listUsersByRole = (roleName) => async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    const classId = req.query?.classId;
    const includeInactive = req.query.includeInactive === 'true';
    const roleDoc = await getRoleDoc(roleName);
    if (!roleDoc) {
      return res.status(400).json(formatResponse(false, `${roleName} role not found`));
    }

    // if(roleName === 'student' && !classId) {
    //     return res.status(400).json(formatResponse(false, 'classId query parameter is required to list students'));
    // }

    // if(roleName === 'student' ) {
    //     const classDoc = await Class.findOne({ _id: classId, school: schoolId });
    //     if (!classDoc) {
    //         return res.status(404).json(formatResponse(false, 'Class not found'));
    //     }
    // }



    const users = await User.find({
      school: schoolId,
      role: roleDoc._id,
      ...(includeInactive ? {} : { active: true }),
    })
      .populate('school', '_id schoolName schoolId')
      .populate('role', 'role')
      .sort({ createdAt: -1 });

    const records = [];
    for (const user of users) {
      records.push(await buildUserRecord(user, roleName));
    }

    return res.status(200).json(formatResponse(true, `${roleName} list fetched successfully`, records));
  } catch (error) {
    return res.status(500).json(formatResponse(false, `Error fetching ${roleName} list`, null, error.message));
  }
};

const getUserByRoleAndId = (roleName) => async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);

    if (!isValidId(id)) {
      return res.status(400).json(formatResponse(false, 'Valid user id is required'));
    }

    const user = await User.findOne({ _id: id, school: schoolId }).populate('school', '_id schoolName schoolId').populate('role', 'role');
    if (!user || (user.role?.role || '') !== roleName) {
      return res.status(404).json(formatResponse(false, `${roleName} not found`));
    }

    return res.status(200).json(formatResponse(true, `${roleName} fetched successfully`, await buildUserRecord(user, roleName)));
  } catch (error) {
    return res.status(500).json(formatResponse(false, `Error fetching ${roleName}`, null, error.message));
  }
};

const updateUserByRole = (roleName) => async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);

    if (!isValidId(id)) {
      return res.status(400).json(formatResponse(false, 'Valid user id is required'));
    }

    const user = await User.findOne({ _id: id, school: schoolId }).populate('role', 'role');
    if (!user || (user.role?.role || '') !== roleName) {
      return res.status(404).json(formatResponse(false, `${roleName} not found`));
    }

    ['name', 'email', 'phone', 'smsPhone', 'whatsappPhone', 'telegramChatId', 'image', 'city', 'state', 'address', 'pinCode', 'gender'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    if (roleName === 'student') {
      const student = await Student.findOne({ user: user._id });
      if (student) {
        if (Object.prototype.hasOwnProperty.call(req.body, 'class')) student.class = req.body.class;
        if (Object.prototype.hasOwnProperty.call(req.body, 'status')) student.status = req.body.status;
        if (Object.prototype.hasOwnProperty.call(req.body, 'dateOfAdmission')) student.dateOfAdmission = req.body.dateOfAdmission;
        if (Object.prototype.hasOwnProperty.call(req.body, 'dateOfBirth')) student.dateOfBirth = req.body.dateOfBirth;
        if (Object.prototype.hasOwnProperty.call(req.body, 'fatherName')) student.fatherName = req.body.fatherName;
        if (Object.prototype.hasOwnProperty.call(req.body, 'motherName')) student.motherName = req.body.motherName;
        if (Object.prototype.hasOwnProperty.call(req.body, 'parentContact')) student.parentContact = req.body.parentContact;
        await student.save();
      }
    }

    if (roleName === 'teacher') {
      const teacher = await Teacher.findOne({ user: user._id });
      if (teacher) {
        if (Object.prototype.hasOwnProperty.call(req.body, 'class')) teacher.class = req.body.class;
        if (Object.prototype.hasOwnProperty.call(req.body, 'classTeacher')) teacher.classTeacher = req.body.classTeacher;
        if (Object.prototype.hasOwnProperty.call(req.body, 'teachSubjects')) teacher.teachSubjects = Array.isArray(req.body.teachSubjects) ? req.body.teachSubjects : teacher.teachSubjects;
        if (Object.prototype.hasOwnProperty.call(req.body, 'teachSclass')) teacher.teachSclass = Array.isArray(req.body.teachSclass) ? req.body.teachSclass : teacher.teachSclass;
        await teacher.save();
      }
    }

    if (roleName === 'staff') {
      const staff = await Staff.findOne({ user: user._id });
      if (staff) {
        if (Object.prototype.hasOwnProperty.call(req.body, 'staffId')) staff.staffId = req.body.staffId;
        if (Object.prototype.hasOwnProperty.call(req.body, 'position')) staff.position = req.body.position;
        if (Object.prototype.hasOwnProperty.call(req.body, 'department')) staff.department = req.body.department;
        if (Object.prototype.hasOwnProperty.call(req.body, 'hireDate')) staff.hireDate = req.body.hireDate;
        if (Object.prototype.hasOwnProperty.call(req.body, 'salary')) staff.salary = req.body.salary;
        await staff.save();
      }
    }

    return res.status(200).json(formatResponse(true, `${roleName} updated successfully`, await buildUserRecord(user, roleName)));
  } catch (error) {
    return res.status(500).json(formatResponse(false, `Error updating ${roleName}`, null, error.message));
  }
};

const changeUserPassword = (roleName) => async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    const password = String(req.body?.password || '').trim();

    if (!isValidId(id)) {
      return res.status(400).json(formatResponse(false, 'Valid user id is required'));
    }

    if (password.length < 6) {
      return res.status(400).json(formatResponse(false, 'Password must be at least 6 characters long'));
    }

    const user = await User.findOne({ _id: id, school: schoolId }).populate('role', 'role');
    if (!user || (user.role?.role || '') !== roleName) {
      return res.status(404).json(formatResponse(false, `${roleName} not found`));
    }

    user.password = password;
    await user.save();

    return res.status(200).json(formatResponse(true, `${roleName} password updated successfully`));
  } catch (error) {
    return res.status(500).json(formatResponse(false, `Error updating ${roleName} password`, null, error.message));
  }
};

const softDeleteUser = (roleName) => async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);

    if (!isValidId(id)) {
      return res.status(400).json(formatResponse(false, 'Valid user id is required'));
    }

    const user = await User.findOne({ _id: id, school: schoolId }).populate('role', 'role');
    if (!user || (user.role?.role || '') !== roleName) {
      return res.status(404).json(formatResponse(false, `${roleName} not found`));
    }

    user.active = false;
    await user.save();

    if (roleName === 'student') {
      await Student.updateOne({ user: user._id }, { $set: { status: 'inactive' } });
    }

    return res.status(200).json(formatResponse(true, `${roleName} soft deleted successfully`));
  } catch (error) {
    return res.status(500).json(formatResponse(false, `Error deleting ${roleName}`, null, error.message));
  }
};

const restoreUser = (roleName) => async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);

    if (!isValidId(id)) {
      return res.status(400).json(formatResponse(false, 'Valid user id is required'));
    }

    const user = await User.findOne({ _id: id, school: schoolId }).populate('role', 'role');
    if (!user || (user.role?.role || '') !== roleName) {
      return res.status(404).json(formatResponse(false, `${roleName} not found`));
    }

    user.active = true;
    await user.save();

    if (roleName === 'student') {
      await Student.updateOne({ user: user._id }, { $set: { status: 'active' } });
    }

    return res.status(200).json(formatResponse(true, `${roleName} restored successfully`));
  } catch (error) {
    return res.status(500).json(formatResponse(false, `Error restoring ${roleName}`, null, error.message));
  }
};

const hardDeleteUser = (roleName) => async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);

    if (!isValidId(id)) {
      return res.status(400).json(formatResponse(false, 'Valid user id is required'));
    }

    const user = await User.findOne({ _id: id, school: schoolId }).populate('role', 'role');
    if (!user || (user.role?.role || '') !== roleName) {
      return res.status(404).json(formatResponse(false, `${roleName} not found`));
    }

    if (roleName === 'admin') await Admin.deleteOne({ user: user._id });
    if (roleName === 'teacher') await Teacher.deleteOne({ user: user._id });
    if (roleName === 'staff') await Staff.deleteOne({ user: user._id });
    if (roleName === 'student') await Student.deleteOne({ user: user._id });

    await user.deleteOne();

    return res.status(200).json(formatResponse(true, `${roleName} permanently deleted successfully`));
  } catch (error) {
    return res.status(500).json(formatResponse(false, `Error permanently deleting ${roleName}`, null, error.message));
  }
};

const getSchoolOverview = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    const [adminRole, teacherRole, staffRole, studentRole, classes, subjects, subscription] = await Promise.all([
      getRoleDoc('admin'),
      getRoleDoc('teacher'),
      getRoleDoc('staff'),
      getRoleDoc('student'),
      Class.countDocuments({ school: schoolId, active: { $ne: false } }),
      Subject.countDocuments({ school: schoolId, active: { $ne: false } }),
      Subscription.findOne({ school: schoolId }).populate('school', '_id schoolName schoolId'),
    ]);

    const [admins, teachers, staff, students] = await Promise.all([
      adminRole ? User.countDocuments({ school: schoolId, role: adminRole._id, active: true }) : 0,
      teacherRole ? User.countDocuments({ school: schoolId, role: teacherRole._id, active: true }) : 0,
      staffRole ? User.countDocuments({ school: schoolId, role: staffRole._id, active: true }) : 0,
      studentRole ? User.countDocuments({ school: schoolId, role: studentRole._id, active: true }) : 0,
    ]);

    return res.status(200).json(
      formatResponse(true, 'School overview fetched successfully', {
        counts: {
          admins,
          teachers,
          staff,
          students,
          classes,
          subjects,
        },
        subscription,
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching school overview', null, error.message));
  }
};

const listClasses = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    console.log("schoolId ", schoolId);
    const includeInactive = req.query.includeInactive === 'true';
    const classes = await Class.find({ school: schoolId, ...(includeInactive ? {} : { active: { $ne: false } }) })
      .populate('classTeacher', '_id user')
      .populate('subjects', '_id name code class school active')
      .populate('school', '_id name schoolId image active')
      .populate({ path: 'classTeacher', populate: { path: 'user', select: '_id name email phone' } })
      .sort({ createdAt: -1 });

    return res.status(200).json(formatResponse(true, 'Classes fetched successfully', classes));
  } catch (error) {
    console.log(error)
    return res.status(500).json(formatResponse(false, 'Error fetching classes', null, error.message));
  }
};

const updateClassById = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    if (!isValidId(id)) {
      await session.abortTransaction();
      return res.status(400).json(formatResponse(false, 'Valid class id is required'));
    }

    const cls = await Class.findOne({ _id: id, school: schoolId }).session(session);
    if (!cls) {
      await session.abortTransaction();
      return res.status(404).json(formatResponse(false, 'Class not found'));
    }
    

    ['name', 'grade', 'section', 'capacity', 'room', 'active'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) cls[field] = req.body[field];
    });

    // if (Object.prototype.hasOwnProperty.call(req.body, 'subjects') && Array.isArray(req.body.subjects)) {
    //   cls.subjects = req.body.subjects;
    // }

    if (Object.prototype.hasOwnProperty.call(req.body, 'classTeacher')) {
      if (req.body.classTeacher && !isValidId(req.body.classTeacher)) {
        await session.abortTransaction();
        return res.status(400).json(formatResponse(false, 'Valid classTeacher id is required'));
      }
      let teacher = await Teacher.findOne({ _id: req.body.classTeacher }).session(session).populate('user', '_id name email phone school');
      if (!teacher) {
        await session.abortTransaction();
        return res.status(404).json(formatResponse(false, 'Class teacher not found'));
      }
      if (!teacher.user || teacher.user.school.toString() !== schoolId.toString()) {
        await session.abortTransaction();
        return res.status(400).json(formatResponse(false, 'Class teacher does not belong to this school'));
      }
      teacher.classTeacher = cls._id;
      await teacher.save({ session });
      cls.classTeacher = req.body.classTeacher;
    }

    await cls.save({ session });
    await session.commitTransaction();
    return res.status(200).json(formatResponse(true, 'Class updated successfully', cls));
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json(formatResponse(false, 'Error updating class', null, error.message));
  } finally {
    session.endSession();
  }
};

const softDeleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    const cls = await Class.findOne({ _id: id, school: schoolId });
    if (!cls) return res.status(404).json(formatResponse(false, 'Class not found'));
    cls.active = false;
    await cls.save();
    return res.status(200).json(formatResponse(true, 'Class soft deleted successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting class', null, error.message));
  }
};

const restoreClass = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    const cls = await Class.findOne({ _id: id, school: schoolId });
    if (!cls) return res.status(404).json(formatResponse(false, 'Class not found'));
    cls.active = true;
    await cls.save();
    return res.status(200).json(formatResponse(true, 'Class restored successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error restoring class', null, error.message));
  }
};

const hardDeleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    const cls = await Class.findOne({ _id: id, school: schoolId });
    if (!cls) return res.status(404).json(formatResponse(false, 'Class not found'));
    await cls.deleteOne();
    return res.status(200).json(formatResponse(true, 'Class permanently deleted successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting class permanently', null, error.message));
  }
};

const listSubjects = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    const includeInactive = req.query.includeInactive === 'true';
    const subjects = await Subject.find({ school: schoolId, ...(includeInactive ? {} : { active: { $ne: false } }) })
      .populate('class', '_id name grade section school active')
      .populate({ path: 'teacher', populate: { path: 'user', select: '_id name email phone' } })
      .sort({ createdAt: -1 });

    return res.status(200).json(formatResponse(true, 'Subjects fetched successfully', subjects));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching subjects', null, error.message));
  }
};

const updateSubjectById = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    if (!isValidId(id)) {
      await session.abortTransaction();
      return res.status(400).json(formatResponse(false, 'Valid subject id is required'));
    }

    let subject = await Subject.findOne({ _id: id, school: schoolId }).session(session);
    if (!subject) {
      await session.abortTransaction();
      return res.status(404).json(formatResponse(false, 'Subject not found'));
    }

    const { name, code, class : classId, teacher : teacherId, maxMarks, active } = req.body;
    console.log("classId ", classId, " teacherId ", teacherId , " name ", name, " code ", code, " maxMarks ", maxMarks, " active ", active , 'id ', id);
    if (name){ subject.name = name;}
    if (code) subject.code = code;
    let existingClass = null;
    let nextClass = null;
    let teacher = null;

    if (Object.prototype.hasOwnProperty.call(req.body, 'class')){
      
      if (!isValidId(classId)) {
        await session.abortTransaction();
        return res.status(400).json(formatResponse(false, 'Valid class id is required'));
      }
      nextClass = await Class.findOne({ _id: classId, school: schoolId }).session(session);
      if (!nextClass) {
        await session.abortTransaction();
        return res.status(404).json(formatResponse(false, 'Class not found'));
      }

      existingClass = subject.class ? await Class.findOne({ _id: subject.class, school: schoolId }).session(session) : null;
      if(existingClass) {
      existingClass.subjects = existingClass?.subjects?.filter(sub => sub.toString() !== subject._id.toString()) || []; 
      console.log("existingClass ", existingClass.subjects);
      }
      subject.class = classId;
      nextClass.subjects = nextClass.subjects || [];
      if (!nextClass.subjects.some(sub => sub.toString() === subject._id.toString())) {
        nextClass.subjects.push(subject._id);
        console.log("cls ", nextClass.subjects);
      }

    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'teacher')){
      if (!isValidId(teacherId)) {
        await session.abortTransaction();
        return res.status(400).json(formatResponse(false, 'Valid teacher id is required'));
      }
      teacher = await Teacher.findOne({ _id: teacherId}).session(session).populate('user', '_id name email phone school');
      if (!teacher) {
        await session.abortTransaction();
        return res.status(404).json(formatResponse(false, 'Teacher not found'));
      }
      if(!teacher.user || teacher.user.school.toString() !== schoolId.toString()) {
        await session.abortTransaction();
        return res.status(400).json(formatResponse(false, 'Teacher does not belong to this school'));
      }
      teacher.teachSubjects = teacher.teachSubjects || [];
      if (!teacher.teachSubjects.some(sub => sub.toString() === subject._id.toString())) {
        teacher.teachSubjects.push(subject._id);
      }
      subject.teacher = teacherId;
    }
    if (maxMarks !== undefined) subject.maxMarks = maxMarks;
    if (active !== undefined) subject.active = active;

    if (existingClass) {
      await existingClass.save({ session });
    }
    if (nextClass) {
      await nextClass.save({ session });
    }
    if (teacher) {
      await teacher.save({ session });
    }

    await subject.save({ session });
    await session.commitTransaction();
    return res.status(200).json(formatResponse(true, 'Subject updated successfully', subject));
  } catch (error) {
    await session.abortTransaction();
    console.log(error)
    return res.status(500).json(formatResponse(false, 'Error updating subject', null, error.message));
  } finally {
    session.endSession();
  }
};

const softDeleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    const subject = await Subject.findOne({ _id: id, school: schoolId });
    if (!subject) return res.status(404).json(formatResponse(false, 'Subject not found'));
    subject.active = false;
    await subject.save();
    return res.status(200).json(formatResponse(true, 'Subject soft deleted successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting subject', null, error.message));
  }
};

const restoreSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    const subject = await Subject.findOne({ _id: id, school: schoolId });
    if (!subject) return res.status(404).json(formatResponse(false, 'Subject not found'));
    subject.active = true;
    await subject.save();
    return res.status(200).json(formatResponse(true, 'Subject restored successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error restoring subject', null, error.message));
  }
};

const hardDeleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getSchoolId(req);
    const subject = await Subject.findOne({ _id: id, school: schoolId });
    if (!subject) return res.status(404).json(formatResponse(false, 'Subject not found'));
    await subject.deleteOne();
    return res.status(200).json(formatResponse(true, 'Subject permanently deleted successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting subject permanently', null, error.message));
  }
};

const getSchoolSubscription = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    const subscription = await Subscription.findOne({ school: schoolId }).populate('school', '_id schoolName schoolId');
    return res.status(200).json(formatResponse(true, 'Subscription fetched successfully', subscription));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching subscription', null, error.message));
  }
};

const updateSchoolSubscription = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    const subscription = await Subscription.findOne({ school: schoolId });
    if (!subscription) return res.status(404).json(formatResponse(false, 'Subscription not found'));

    ['planName', 'status', 'billingCycle', 'price', 'currency', 'startsAt', 'endsAt', 'trialEndsAt', 'autoRenew', 'features', 'notes', 'lastPaymentAt', 'nextBillingAt'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) subscription[field] = req.body[field];
    });

    await subscription.save();
    return res.status(200).json(formatResponse(true, 'Subscription updated successfully', subscription));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating subscription', null, error.message));
  }
};

const renewSchoolSubscription = async (req, res) => {
  try {
    const schoolId = getSchoolId(req);
    const subscription = await Subscription.findOne({ school: schoolId });
    if (!subscription) return res.status(404).json(formatResponse(false, 'Subscription not found'));

    const extensionDays = Math.max(1, Number(req.body?.extensionDays || 30));
    const baseDate = subscription.endsAt && subscription.endsAt > new Date() ? new Date(subscription.endsAt) : new Date();
    const nextEnd = new Date(baseDate);
    nextEnd.setDate(nextEnd.getDate() + extensionDays);

    subscription.status = 'active';
    subscription.endsAt = nextEnd;
    subscription.nextBillingAt = nextEnd;
    subscription.autoRenew = Boolean(req.body?.autoRenew ?? subscription.autoRenew);
    subscription.lastPaymentAt = new Date();
    if (Object.prototype.hasOwnProperty.call(req.body, 'planName')) subscription.planName = req.body.planName;
    await subscription.save();

    return res.status(200).json(formatResponse(true, 'Subscription renewed successfully', subscription));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error renewing subscription', null, error.message));
  }
};

module.exports = {
  createAdmin,
  getSchoolOverview,
  listAdmins: listUsersByRole('admin'),
  listTeachers: listUsersByRole('teacher'),
  listStaff: listUsersByRole('staff'),
  listStudents: listUsersByRole('student'),
  getAdminById: getUserByRoleAndId('admin'),
  getTeacherById: getUserByRoleAndId('teacher'),
  getStaffById: getUserByRoleAndId('staff'),
  getStudentById: getUserByRoleAndId('student'),
  updateAdmin: updateUserByRole('admin'),
  updateTeacher: updateUserByRole('teacher'),
  updateStaff: updateUserByRole('staff'),
  updateStudent: updateUserByRole('student'),
  changeAdminPassword: changeUserPassword('admin'),
  changeTeacherPassword: changeUserPassword('teacher'),
  changeStaffPassword: changeUserPassword('staff'),
  changeStudentPassword: changeUserPassword('student'),
  softDeleteAdmin: softDeleteUser('admin'),
  softDeleteTeacher: softDeleteUser('teacher'),
  softDeleteStaff: softDeleteUser('staff'),
  softDeleteStudent: softDeleteUser('student'),
  restoreAdmin: restoreUser('admin'),
  restoreTeacher: restoreUser('teacher'),
  restoreStaff: restoreUser('staff'),
  restoreStudent: restoreUser('student'),
  hardDeleteAdmin: hardDeleteUser('admin'),
  hardDeleteTeacher: hardDeleteUser('teacher'),
  hardDeleteStaff: hardDeleteUser('staff'),
  hardDeleteStudent: hardDeleteUser('student'),
  listClasses,
  updateClassById,
  softDeleteClass,
  restoreClass,
  hardDeleteClass,
  listSubjects,
  updateSubjectById,
  softDeleteSubject,
  restoreSubject,
  hardDeleteSubject,
  getSchoolSubscription,
  updateSchoolSubscription,
  renewSchoolSubscription,
};