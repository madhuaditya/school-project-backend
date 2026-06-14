const User = require('../models/user');
const Role = require('../models/role');
const School = require('../models/school');
const jwt = require('jsonwebtoken');
const sendMail = require('../utils/sendEmailUsingResend');
const { genAT, genRT } = require('../utils/jwt');
const mongoose = require('mongoose');
const VALID_ROLES = ['admin', 'teacher', 'student', 'staff', 'school'];
const Teacher = require('../models/teacher');
const Admin = require('../models/admin');
const Subscription = require('../models/subscription');
const Student = require('../models/student');
const ClassModel = require('../models/class');
const cloudinary = require('../config/cloudinary');
const { validateStudentAndAdminofSchool } = require('../middleware/ValidateRelation');
const { UsernameGenerator } = require("@siantech/username-generator");
const generator = new UsernameGenerator();

const {
  sendOTP,
  verifyOTP,
} = require('../utils/twilioService');
// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

const serializeSubscription = (subscription) => {
  if (!subscription) return null;

  return {
    _id: subscription._id,
    school: subscription.school,
    planName: subscription.planName,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    price: subscription.price,
    currency: subscription.currency,
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    trialEndsAt: subscription.trialEndsAt,
    autoRenew: subscription.autoRenew,
    features: subscription.features || [],
    notes: subscription.notes,
    lastPaymentAt: subscription.lastPaymentAt,
    nextBillingAt: subscription.nextBillingAt,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
};

const uploadBufferToCloudinary = (buffer, folderName) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream(
    { folder: folderName },
    (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    }
  );

  stream.end(buffer);
});

const DEFAULT_TRIAL_FEATURES = [
  'attendance',
  'class-management',
  'subject-management',
  'teacher-management',
  'student-management',
  'progress',
  'dashboard',
  'notice',
  'timetable',
  'feedback',
  'chat',
  'reply',
  'fee-structure',
  'salary-structure',
  'fee-management',
  'salary-management',
  'alert',
  'broadcast',
  'profile',
];

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toSafeUpper = (value = '') => String(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const toSafeLower = (value = '') => String(value).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const getSchoolCode = (school) => {
  const schoolIdCode = toSafeUpper(school?.schoolId || '');
  if (schoolIdCode) return schoolIdCode;

  const words = String(school?.schoolName || '')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) return 'SCHL';
  const initials = words.map((word) => word[0]).join('');
  return toSafeUpper(initials).slice(0, 6) || 'SCHL';
};

const getNextNumericSuffix = (values, pattern) => {
  let max = 0;
  values.forEach((value) => {
    const match = String(value || '').match(pattern);
    if (!match) return;
    const num = Number(match[1]);
    if (!Number.isNaN(num) && num > max) max = num;
  });
  return max + 1;
};

const generateUniqueUsername = async (req, res) => {
  try {
    const currentRole = req.user?.role?.role;
    if (currentRole !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can generate username'));
    }

    const { name, role = 'user' } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json(formatResponse(false, 'Name is required to generate username'));
    }

    const schoolId = req.user?.school?._id || req.user?.school;
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school mapping for admin'));
    }

    // Generate username: <last2DigitsOfYear><month><firstName>_<incrementValue>
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstName = toSafeLower(name.split(/\s+/)[0]).slice(0, 14) || 'user';
    const prefix = `${firstName}${year}${month}`;

    let username = prefix;
    let suffix = 1;
    while (await User.exists({ username })) {
      username = `${prefix}_${suffix}`;
      suffix += 1;
    }

    return res.status(200).json(
      formatResponse(true, 'Username generated successfully', {
        username,
      })
    );
  } catch (error) {
    console.log('Error generating username: ', error);
    return res.status(500).json(formatResponse(false, 'Error generating username', null, error.message));
  }
};

const generateStudentId = async (req, res) => {
  try {
    const currentRole = req.user?.role?.role;
    if (currentRole !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can generate student ID'));
    }

    const schoolId = req.user?.school?._id || req.user?.school;
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school mapping for admin'));
    }

    const school = await School.findById(schoolId).select('_id schoolId schoolName');
    if (!school) {
      return res.status(404).json(formatResponse(false, 'School not found'));
    }

    const year = Number(req.body?.year) || new Date().getFullYear();
    const schoolCode = getSchoolCode(school);
    const prefix = `${schoolCode}-STD-${year}-`;

    const existing = await Student.find({ studentId: { $regex: `^${prefix}` } }).select('studentId');
    const next = getNextNumericSuffix(existing.map((row) => row.studentId), new RegExp(`^${prefix}(\\d+)$`));
    const studentId = `${prefix}${String(next).padStart(4, '0')}`;

    return res.status(200).json(
      formatResponse(true, 'Student ID generated successfully', {
        studentId,
        pattern: `${schoolCode}-STD-${year}-0001`,
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error generating student ID', null, error.message));
  }
};

const generateNextStudentRollNumber = async (req, res) => {
  try {
    const currentRole = req.user?.role?.role;
    if (currentRole !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can generate roll number'));
    }

    const { classId } = req.body || {};
    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json(formatResponse(false, 'Valid classId is required'));
    }

    const schoolId = req.user?.school?._id || req.user?.school;
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school mapping for admin'));
    }

    const classDoc = await ClassModel.findById(classId).select('_id name section grade school');
    if (!classDoc) {
      return res.status(404).json(formatResponse(false, 'Class not found'));
    }

    if (String(classDoc.school) !== String(schoolId)) {
      return res.status(403).json(formatResponse(false, 'Cannot generate roll number for another school class'));
    }

    const classPrefix = `${toSafeUpper(classDoc.name).slice(0, 3) || `G${classDoc.grade}`}-${toSafeUpper(classDoc.section).slice(0, 2) || 'A'}`;
    const prefix = `${classPrefix}-`;

    const existing = await Student.find({ class: classDoc._id }).select('rollNumber');
    const next = getNextNumericSuffix(existing.map((row) => row.rollNumber), new RegExp(`^${prefix}(\\d+)$`));
    const rollNumber = `${prefix}${String(next).padStart(3, '0')}`;

    return res.status(200).json(
      formatResponse(true, 'Roll number generated successfully', {
        classId: classDoc._id,
        className: classDoc.name,
        section: classDoc.section,
        grade: classDoc.grade,
        rollNumber,
        pattern: `${classPrefix}-001`,
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error generating roll number', null, error.message));
  }
};

// REGISTER
const register = async (req, res) => {
  const session = await mongoose.startSession();
  let createdUser = null;

  try {
    const {
      name,
      email,
      phone,
      smsPhone,
      whatsappPhone,
      telegramChatId,
      password,
      role,
      school,
      image,
      username,
      gender,
    } = req.body;
    const adminInfo = req.user;
    
    if(!adminInfo || (adminInfo.role.role !== 'admin' && adminInfo.role.role !== 'school' && adminInfo.role.role !== 'teacher')) {
      return res.status(403).json(formatResponse(false, 'Only admins can register new users'));
    }

    if (!password || !email || !phone || !username || !role)
      return res.status(400).json(formatResponse(false, 'Invalid data'));

    if (!VALID_ROLES.includes(role))
      return res.status(400).json(formatResponse(false, 'Invalid role'));

    if (!school || !mongoose.Types.ObjectId.isValid(school)) {
      return res.status(400).json(formatResponse(false, 'Invalid school'));
    }

    if(role === 'teacher' && adminInfo.role.role === 'teacher') {
      return res.status(403).json(formatResponse(false, 'Teachers cannot create other teachers'));
    }

    if(role === 'admin' && adminInfo.role.role === 'teacher') {
      return res.status(403).json(formatResponse(false, 'Teachers cannot create other admin'));
    }

    if(role === 'staff' && adminInfo.role.role === 'teacher') {
      return res.status(403).json(formatResponse(false, 'Teachers cannot create other staff'));
    }

    await session.withTransaction(async () => {
      const sch = await School.findById(new mongoose.Types.ObjectId(school)).session(session);
      if (!sch) {
        throw createHttpError(400, 'Invalid school');
      }

      let ex = await User.findOne({ username }).session(session);
      if (ex) {
        throw createHttpError(409, 'Username already exists username must be unique please choose another one');
      }

      const roleDoc = await Role.findOne({ role }).session(session);
      if (!roleDoc) {
        throw createHttpError(400, 'Role not found');
      }

      const adminSchoolId = adminInfo?.school?._id?.toString?.() || adminInfo?.school?.toString?.();
      if (!adminSchoolId || sch._id.toString() !== adminSchoolId) {
        throw createHttpError(403, 'Cannot assign user to a different school');
      }

      createdUser = new User({
        name,
        username,
        email,
        phone,
        smsPhone: smsPhone || phone || '',
        whatsappPhone: whatsappPhone || phone || '',
        telegramChatId: telegramChatId || '',
        image,
        password,
        address: req.body.address || '',
        city: req.body.city || '',
        state: req.body.state || '',
        pinCode: req.body.pinCode || '',
        gender: gender || 'Not specified',
        role: roleDoc._id,
        school: sch._id,
        createdBy: adminInfo._id,
        updatedBy: adminInfo._id,
        active: true,
      });
      await createdUser.save({ session });

      if (role === 'teacher' && adminInfo.role.role === 'admin') {
        const teacherDoc = new Teacher({
          _id: createdUser._id,
          user: createdUser._id,
          principal: adminInfo._id,
        });
        await teacherDoc.save({ session });
      } else if (role === 'admin' && adminInfo.role.role === 'admin') {
        const Admin = require('../models/admin');
        const adminDoc = new Admin({
          _id: createdUser._id,
          user: createdUser._id,
        });
        await adminDoc.save({ session });
      } else if (role === 'student') {
        const Student = require('../models/student');
        const studentDoc = new Student({
          _id: createdUser._id,
          user: createdUser._id,
          studentId: req.body.studentId,
          rollNumber: req.body.rollNumber,
          dateOfAdmission: req.body.dateOfAdmission,
          fatherName: req.body.fatherName,
          motherName: req.body.motherName,
          parentContact: req.body.parentContact,
          dateOfBirth: req.body.dateOfBirth,
        });
        await studentDoc.save({ session });
      } else if (role === 'staff' && adminInfo.role.role === 'admin') {
        const Staff = require('../models/staff');
        const staffDoc = new Staff({
          user: createdUser._id,
        });
        await staffDoc.save({ session });
      }
    });

    if (!createdUser) {
      throw new Error('User creation failed');
    }

    try {
      await sendMail(
        createdUser.email,
        'Registration Successful',
        `<p>Welcome to our platform!</p><p>Your account has been created with the following details:</p><ul><li>Name: ${createdUser.name}</li><li>Email: ${createdUser.email}</li><li>Role: ${role}</li></ul><p>Please log in to your account to get started.</p>`
      );
    } catch (mailError) {
      console.log('User created but registration email failed:', mailError.message);
    }

    return res.status(201).json(formatResponse(true, 'User created successfully', { userId: createdUser._id }));
  } catch (error) {
    console.log("Error registering user: ", error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json(formatResponse(false, error.message));
    }

    return res.status(500).json(formatResponse(false, 'Error registering user', null, error.message));
  } finally {
    await session.endSession();
  }
};


const updateUser = async (req, res) => {
  try {
    const { name, phone, smsPhone, whatsappPhone, telegramChatId, image, address, city, pinCode, state } = req.body;
    const u = await User.findById(req.user._id).populate('role', 'role').populate('school', 'id schoolName image');
    
    if (!u) return res.status(404).json(formatResponse(false, 'User not found'));
    
    u.name = name || u.name;
    u.phone = phone || u.phone;
    u.smsPhone = smsPhone || u.smsPhone;
    u.whatsappPhone = whatsappPhone || u.whatsappPhone;
    u.telegramChatId = telegramChatId || u.telegramChatId;
    u.image = image || u.image;
    u.address = address || u.address;
    u.city = city || u.city;
    u.pinCode = pinCode || u.pinCode;
    u.state = state || u.state;
    
    await u.save();
    return res.status(200).json(formatResponse(true, 'User updated successfully', u));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating user', null, error.message));
  }
};

const deleteTemp = async (req, res) => {
  try {
    const admin = req.user;
    const userId = req.params.id;
    const userToDelete = await User.findById(userId).populate('role', 'role').populate('school', 'id schoolName image');
    
    if (!userToDelete) return res.status(404).json(formatResponse(false, 'User not found'));
    
    if(admin.role.role !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can delete users'));
    }

    if(!validateStudentAndAdminofSchool(admin._id, req.params.id, admin.school._id)) {
      return res.status(403).json(formatResponse(false, 'Cannot delete user from a different school'));
    }
    
    userToDelete.active = false;
    await userToDelete.save();
    return res.status(200).json(formatResponse(true, 'User deleted temporarily', userToDelete));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting user', null, error.message));
  }
};

const deletePermanently = async (req, res) => {
  try {
    const admin = req.user;
    const userId = req.params.id;
    const userToDelete = await User.findById(userId).populate('role', 'role').populate('school', 'id schoolName image');
    
    if (!userToDelete) return res.status(404).json(formatResponse(false, 'User not found'));
    
    if(admin.role.role !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can delete users'));
    }

    if(!validateStudentAndAdminofSchool(admin._id, req.params.id, admin.school._id)) {
      return res.status(403).json(formatResponse(false, 'Cannot delete user from a different school'));
    }
    
    if(userToDelete.role.role === 'teacher') {
      const Teacher = require('../models/teacher');
      await Teacher.findOneAndDelete({ user: userId });
    }
    
    if(userToDelete.role.role === 'admin') {
      const Admin = require('../models/admin');
      await Admin.findOneAndDelete({ user: userId });
    }
    
    if(userToDelete.role.role === 'student') {
      const Student = require('../models/student');
      await Student.findOneAndDelete({ user: userId });
    }

    await userToDelete.deleteOne();
    return res.status(200).json(formatResponse(true, 'User permanently deleted'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error deleting user permanently', null, error.message));
  }
};

const reinistateUser = async (req, res) => {
  try {
    const admin = req.user;
    const userId = req.params.id;
    const userToDelete = await User.findById(userId).populate('role', 'role').populate('school', 'id schoolName image');
    
    if (!userToDelete) return res.status(404).json(formatResponse(false, 'User not found'));
    
    if(admin.role.role !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can reinstate users'));
    }

    if(!validateStudentAndAdminofSchool(admin._id, req.params.id, admin.school._id)) {
      return res.status(403).json(formatResponse(false, 'Cannot reinstate user from a different school'));
    }
    
    userToDelete.active = true;
    await userToDelete.save();
    return res.status(200).json(formatResponse(true, 'User reinstated successfully', userToDelete));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error reinstating user', null, error.message));
  }
};

const getAllAdminsInSchool = async (req, res) => {
  try {
    const currentUser = req.user;
    const currentRole = currentUser?.role?.role || currentUser?.role;

    if (!currentUser || currentRole !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can access admins list'));
    }

    const schoolId = currentUser.school?._id || currentUser.school;
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'Admin is not mapped to a school'));
    }

    const adminRole = await Role.findOne({ role: 'admin' }).select('_id');
    if (!adminRole) {
      return res.status(400).json(formatResponse(false, 'Admin role not found'));
    }

    const admins = await User.find({
      school: schoolId,
      role: adminRole._id,
      active: true,
    })
      .select('_id name email phone image city state address pinCode school active role createdAt')
      .populate('school', '_id schoolName')
      .populate('role', 'role')
      .sort({ createdAt: -1 });

    formattedAdmins = admins.map(a => ({
     user:{
       _id: a._id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      image: a.image,
      city: a.city,
      state: a.state,
      address: a.address,
      pinCode: a.pinCode,
      school: a.school,
      active: a.active,
      role: a.role,
      createdAt: a.createdAt,
     },
      _id: a._id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      image: a.image,
      city: a.city,
      state: a.state,
      address: a.address,
      pinCode: a.pinCode,
      school: a.school,
      active: a.active,
      role: a.role,
      createdAt: a.createdAt,
    }));
    return res
      .status(200)
      .json(formatResponse(true, 'Admins fetched successfully', formattedAdmins ));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching admins', null, error.message));
  }
};

const getAllStaffInSchool = async (req, res) => {
  try {
    const currentUser = req.user;
    const currentRole = currentUser?.role?.role || currentUser?.role;

    if (!currentUser || currentRole !== 'admin') {
      return res.status(403).json(formatResponse(false, 'Only admins can access staff list'));
    }

    const schoolId = currentUser.school?._id || currentUser.school;
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'Admin is not mapped to a school'));
    }

    const adminRole = await Role.findOne({ role: 'staff' }).select('_id');
    if (!adminRole) {
      return res.status(400).json(formatResponse(false, 'Staff role not found'));
    }

    const admins = await User.find({
      school: schoolId,
      role: adminRole._id,
      active: true,
    })
      .select('_id name email phone image city state address pinCode school active role createdAt')
      .populate('school', '_id schoolName')
      .populate('role', 'role')
      .sort({ createdAt: -1 });

    formattedAdmins = admins.map(a => ({
     user:{
       _id: a._id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      image: a.image,
      city: a.city,
      state: a.state,
      address: a.address,
      pinCode: a.pinCode,
      school: a.school,
      active: a.active,
      role: a.role,
      createdAt: a.createdAt,
     },
      _id: a._id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      image: a.image,
      city: a.city,
      state: a.state,
      address: a.address,
      pinCode: a.pinCode,
      school: a.school,
      active: a.active,
      role: a.role,
      createdAt: a.createdAt,
    }));
    return res
      .status(200)
      .json(formatResponse(true, 'Staff fetched successfully', formattedAdmins ));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching staff', null, error.message));
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username.trim();

    const u = await User.findOne({ username: normalizedUsername }).populate('role', 'role').populate('school', '_id schoolName email image');

    if (!u) return res.status(401).json(formatResponse(false, 'Invalid credentials'));
    
    const isMatch = await u.comparePassword(password);
    if (!isMatch) return res.status(401).json(formatResponse(false, 'Invalid credentials'));
    const phone = u.phone || u.smsPhone || u.whatsappPhone || '';
    if(!phone) {
      return res.status(400).json(formatResponse(false, 'No phone number associated with this account for OTP verification'));
    }
    const response = await sendOTPToPhone(phone);
    if(!!response.success){
      const token = jwt.sign({ _id: u._id }, process.env.JWT_OTP_SECRET, { expiresIn: '10m' });
      return res.status(200).json(formatResponse(true, `OTP sent to xxxxx${phone.slice(-4)} successfully`, { token: token }));
    }
    else {
      return res.status(500).json(formatResponse(false, 'Failed to send OTP please connect you administrator', null, response.error || 'Unknown error'));
    }
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error during login', null, error.message));
  }
};
const formatPhoneNumber = (phone) => {
  phone = phone.replace(/\s+/g, "");

  if (!phone.startsWith("+")) {
    phone = `+91${phone}`;
  }

  return phone;
};

const sendOTPToPhone = async (phone) => {
  try {

    const response = await sendOTP(formatPhoneNumber(phone));

    return {
      success: true,
      status: response.status,
    }

  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const verifyOTPToPhone = async (req, res) => {
  try {
    const { token, code } = req.body;
    if(!token || !code) {
      return res.status(400).json(formatResponse(false, 'Token and code are required for OTP verification'));
    }
    const decoded = jwt.verify(token, process.env.JWT_OTP_SECRET);
    const userId = decoded._id;
    const u = await User.findById(userId).populate('role', '_id role').populate('school', '_id schoolName email image');
    if (!u) return res.status(401).json(formatResponse(false, 'Invalid token'));
    const phone = u.phone || u.smsPhone || u.whatsappPhone || '';
    if(!phone) {
      return res.status(400).json(formatResponse(false, 'No phone number associated with this account for OTP verification'));
    }
    const formattedPhone = formatPhoneNumber(phone);
    const response = await verifyOTP(formattedPhone, code);

    if (response.status === "approved") {
    const at = genAT(u);
    const rt = genRT(u);

    u.refreshToken = rt;
    await u.save();

    await sendMail(
      u.email,
      'Login Alert',
      `<p>You have successfully logged in to your account.</p><p>If this wasn't you, please reset your password immediately.</p>`
    );
    
    return res.status(200).json(formatResponse(true, 'Login successful', {
      accessToken: at,
      refreshToken: rt,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      _id: u._id,
      phone: u.phone,
      school: u.school,
      image: u.image || "",
      type: 'user',
    }));
  } else {
        return res.status(401).json(formatResponse(false, 'Invalid OTP', null, response.error || 'OTP verification failed'));
  }
  } catch (error) {
        return res.status(500).json(formatResponse(false, 'Error during OTP verification', null, error.message));
      }
}

// REFRESH
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) return res.status(401).json(formatResponse(false, 'Refresh token required'));

    const u = await User.findOne({ refreshToken });
    if (!u) return res.status(403).json(formatResponse(false, 'Invalid refresh token'));

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (e, d) => {
      if (e || u._id.toString() !== d._id) return res.status(403).json(formatResponse(false, 'Invalid token'));
      const at = genAT(u);
      return res.status(200).json(formatResponse(true, 'Token refreshed', { accessToken: at }));
    });
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error refreshing token', null, error.message));
  }
};

// LOGOUT
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(204).json(formatResponse(true, 'Logout successful'));

    const u = await User.findOne({ refreshToken });
    if (u) {
      u.refreshToken = null;
      await u.save();
    }
    
    return res.status(200).json(formatResponse(true, 'Logout successful'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error during logout', null, error.message));
  }
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const u = await User.findById(req.user._id);
    if (!u) return res.status(404).json(formatResponse(false, 'User not found'));
    
    const ok = await u.comparePassword(oldPassword);
    if (!ok) return res.status(401).json(formatResponse(false, 'Wrong password'));
    
    if(newPassword === oldPassword) return res.status(400).json(formatResponse(false, 'New password cannot be same as old password'));

    if(newPassword.length < 6) return res.status(400).json(formatResponse(false, 'Password must be at least 6 characters long'));

    u.password = newPassword;
    await u.save();
    
    await sendMail(
      u.email,
      'Password Updated',
      `<p>Your password has been updated successfully.</p><p>If this wasn't you, please reset your password immediately.</p>`
    );
    
    return res.status(200).json(formatResponse(true, 'Password changed successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error changing password', null, error.message));
  }
};

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  try {
    const { email, username } = req.body;
    const normalizedEmail = email.trim();
    const normalizedUsername = username.trim();

    const u = await User.findOne({ email: normalizedEmail, username: normalizedUsername, active: true });
    if (!u) return res.status(404).json(formatResponse(false, 'User not found'));

    const token = jwt.sign(
      { id: u._id },
      process.env.RESET_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    u.resetToken = token;
    u.resetTokenExp = Date.now() + 15 * 60 * 1000;
    await u.save();

    const link = `${process.env.CLIENT_URL}/#/reset-password/${token}`;

    await sendMail(
      u.email,
      'Reset Password',
      `<p>Click to reset password:</p><a href="${link}">${link}</a>`
    );

    return res.status(200).json(formatResponse(true, 'Reset link sent to email'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error sending reset link', null, error.message));
  }
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if(password.length < 6) return res.status(400).json(formatResponse(false, 'Password must be at least 6 characters long'));

    const u = await User.findOne({
      resetToken: token,
      resetTokenExp: { $gt: Date.now() },
    });

    if (!u) return res.status(400).json(formatResponse(false, 'Invalid or expired token'));

    u.password = password;
    u.resetToken = null;
    u.resetTokenExp = null;

    await u.save();
    
    await sendMail(
      u.email,
      'Password Updated',
      `<p>Your password has been updated successfully.</p><p>If this wasn't you, please reset your password immediately.</p>`
    );
    
    return res.status(200).json(formatResponse(true, 'Password reset successful'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error resetting password', null, error.message));
  }
};

// CHANGE ROLE (ADMIN ONLY)
const changeRole = async (req, res) => {
  try {
    if (req.user.role.role !== 'admin')
      return res.status(403).json(formatResponse(false, 'Only admins can change roles'));

    const { userId, role } = req.body;

    const roleDoc = await Role.findById(role);
    if (!roleDoc) return res.status(400).json(formatResponse(false, 'Invalid role'));

    const u = await User.findById(userId);
    if (!u) return res.status(404).json(formatResponse(false, 'User not found'));

    u.role = roleDoc._id;
    await u.save();
    
    await sendMail(
      u.email,
      'Role Updated',
      `<p>Your role has been updated successfully.</p><p>If this wasn't you, please reset your password immediately.</p>`
    );
    
    return res.status(200).json(formatResponse(true, 'Role updated successfully', u));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error changing role', null, error.message));
  }
};

// Additional functions for school management (registerSchool, loginSchool, etc.) would go here

const registerSchool = async (req, res) => {
  try {
    const { schoolId, email, password, schoolName, address, city, state, pinCode } = req.body;
    
    if (!schoolId || !email || !password || !schoolName || !address || !city || !state || !pinCode) {
      return res.status(400).json(formatResponse(false, 'All fields are required'));
    }

    const ex = await School.findOne({ $or: [{ email }, { schoolId }] });
    if (ex) return res.status(409).json(formatResponse(false, 'School already exists'));
    
    const roleDoc = await Role.findOne({ role: 'admin' });
    if (!roleDoc) return res.status(400).json(formatResponse(false, 'Admin role not found'));
    
    const sch = await School.create({
      schoolId,
      email,
      password,
      schoolName,
      address,
      city,
      state,
      pinCode,
      role: roleDoc._id
    });

    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setMonth(trialEnd.getMonth() + 6);

    const trialSubscription = await Subscription.create({
      school: sch._id,
      planName: 'Startup Trial',
      status: 'trial',
      billingCycle: 'custom',
      price: 0,
      currency: 'INR',
      startsAt: trialStart,
      endsAt: trialEnd,
      trialEndsAt: trialEnd,
      autoRenew: true,
      features: DEFAULT_TRIAL_FEATURES,
      notes: 'Auto-created 6 month trial at school registration',
      lastPaymentAt: trialStart,
      nextBillingAt: trialEnd,
    });

    sch.subscription = trialSubscription._id;
    await sch.save();
    
    await sendMail(
      sch.email,
      'School Registration Successful', 
      `<p>Your school has been registered successfully!</p><p>School Name: ${sch.schoolName}</p><p>Email: ${sch.email}</p>`
    );
    
    return res.status(201).json(
      formatResponse(true, 'School registered successfully', {
        schoolId: sch._id,
        subscription: serializeSubscription(trialSubscription),
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error registering school', null, error.message));
  }
};

const loginSchool = async (req, res) => {
  try {
    const { email, password } = req.body;

    const sch = await School.findOne({ email }).populate('role', 'role');
    if (!sch) return res.status(401).json(formatResponse(false, 'Invalid credentials'));

    const isMatch = await sch.comparePassword(password);
    if (!isMatch) return res.status(401).json(formatResponse(false, 'Invalid credentials'));

    const token = genAT(sch);
    const refreshToken = genRT(sch);
    sch.refreshToken = refreshToken;
    await sch.save();

    let subscription = await Subscription.findOne({ school: sch._id }).populate('school', '_id schoolName schoolId');
    if (!subscription) {
      subscription = await Subscription.create({
        school: sch._id,
        planName: 'Basic',
        status: 'inactive',
        billingCycle: 'monthly',
        price: 0,
        currency: 'INR',
        startsAt: null,
        endsAt: null,
        autoRenew: false,
        features: [],
        notes: 'Subscription record created automatically on school login',
      });
      subscription = await Subscription.findById(subscription._id).populate('school', '_id schoolName schoolId');
    }

    sch.subscription = subscription?._id || sch.subscription;
    await sch.save();
    
    await sendMail(
      sch.email,
      'School Login Alert',
      `<p>Your school has successfully logged in to the system.</p><p>If this wasn't you, please reset your password immediately.</p>`
    );

    return res.status(200).json(formatResponse(true, 'School login successful', { 
      school: {
        _id: sch._id, 
        email: sch.email, 
        schoolName: sch.schoolName, 
        image: sch.image, 
        role: sch.role,
        subscription: serializeSubscription(subscription),
        type: 'school',
      }, 
      token,
      type: 'school',
      refreshToken,
      subscription: serializeSubscription(subscription)
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error during school login', null, error.message));
  }
};

const refreshSchool = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json(formatResponse(false, 'Refresh token required'));
    
    const sch = await School.findOne({ refreshToken: token });
    if (!sch) return res.status(403).json(formatResponse(false, 'Invalid refresh token'));
    
    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (e, d) => {
      if (e || sch._id.toString() !== d._id) return res.status(403).json(formatResponse(false, 'Invalid token'));
      
      const newToken = jwt.sign(
        { _id: sch._id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '1h' }
      );
      
      return res.status(200).json(formatResponse(true, 'Token refreshed', { token: newToken }));
    });
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error refreshing school token', null, error.message));
  }
};

const logoutSchool = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(200).json(formatResponse(true, 'Logout successful'));
    
    const sch = await School.findOne({ refreshToken: token });
    if (sch) {
      sch.refreshToken = null;
      await sch.save();
    }
    
    return res.status(200).json(formatResponse(true, 'School logout successful'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error during school logout', null, error.message));
  }
};

const sendSchoolForgotPasswordEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json(formatResponse(false, 'Email is required'));
    }

    const sch = await School.findOne({ email });
    if (!sch) {
      return res.status(404).json(formatResponse(false, 'School not found'));
    }

    const token = jwt.sign(
      { _id: sch._id },
      process.env.SCHOOL_RESET_TOKEN_SECRET,
      { expiresIn: '15m' }
    );
    sch.resetToken = token;
    sch.resetTokenExp = Date.now() + 15 * 60 * 1000;
    await sch.save();
    const resetUrl = `${process.env.CLIENT_URL}/school-reset-password/${token}`;
    await sendMail(
      sch.email,
      'School Password Reset',
      `<p>Click below to reset your school's password:</p><a href="${resetUrl}">${resetUrl}</a>`
    );

    return res.status(200).json(formatResponse(true, 'School reset link sent to email'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error sending school reset link', null, error.message));
  }
};


const resetPasswordSchool = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if(password.length < 8) return res.status(400).json(formatResponse(false, 'Password must be at least 8 characters long'));

    const sch = await School.findOne({
      resetToken: token,
      resetTokenExp: { $gt: Date.now() },
    });
    if (!sch) return res.status(400).json(formatResponse(false, 'Invalid or expired token'));

    sch.password = password;
    sch.resetToken = null;
    sch.resetTokenExp = null;
    await sch.save();
    
    return res.status(200).json(formatResponse(true, 'School password reset successful'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error resetting school password', null, error.message));
  }
};

const getSchoolInfo = async (req, res) => {
  try {
    const schoolId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school ID'));
    }

    const sch = await School.findById(schoolId).select('_id schoolId schoolName email address city state pinCode image');
    if (!sch) {
      return res.status(404).json(formatResponse(false, 'School not found'));
    }

    return res.status(200).json(formatResponse(true, 'School info retrieved', sch));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error retrieving school info', null, error.message));
  }
};

const getMySchoolInfo = async (req, res) => {
  try {
    const schoolId = req.user?._id;

    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'School account is required'));
    }

    const sch = await School.findById(schoolId)
      .select('_id schoolId schoolName phone email address city state pinCode image slug idCardLogo idCardSettings createdAt updatedAt')
      .populate('role', 'role')
      .populate('subscription');

    if (!sch) {
      return res.status(404).json(formatResponse(false, 'School not found'));
    }

    return res.status(200).json(formatResponse(true, 'School profile retrieved', sch));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error retrieving school profile', null, error.message));
  }
};

const updateMySchoolInfo = async (req, res) => {
  try {
    const schoolId = req.user?._id;

    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'School account is required'));
    }

    const sch = await School.findById(schoolId);
    if (!sch) {
      return res.status(404).json(formatResponse(false, 'School not found'));
    }

    const {
      schoolName,
      phone,
      email,
      address,
      city,
      state,
      pinCode,
      image,
      slug,
      idCardLogo,
      idCardSettings,
    } = req.body;

    if (schoolName !== undefined) sch.schoolName = String(schoolName).trim();
    if (phone !== undefined) sch.phone = String(phone).trim();
    if (email !== undefined) sch.email = String(email).trim().toLowerCase();
    if (address !== undefined) sch.address = String(address).trim();
    if (city !== undefined) sch.city = String(city).trim();
    if (state !== undefined) sch.state = String(state).trim();
    if (pinCode !== undefined) sch.pinCode = String(pinCode).trim();
    if (image !== undefined) sch.image = String(image).trim();
    if (slug !== undefined) sch.slug = String(slug).trim();
    if (idCardLogo !== undefined) sch.idCardLogo = String(idCardLogo).trim();
    if (idCardSettings && typeof idCardSettings === 'object') {
      sch.idCardSettings = {
        ...sch.idCardSettings,
        ...idCardSettings,
      };
    }

    if (!sch.schoolName || !sch.email || !sch.address || !sch.city || !sch.state || !sch.pinCode) {
      return res.status(400).json(formatResponse(false, 'School name, email, address, city, state, and pin code are required'));
    }

    await sch.save();

    const updated = await School.findById(schoolId)
      .select('_id schoolId schoolName phone email address city state pinCode image slug idCardLogo idCardSettings createdAt updatedAt')
      .populate('role', 'role')
      .populate('subscription');

    return res.status(200).json(formatResponse(true, 'School profile updated successfully', updated));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error updating school profile', null, error.message));
  }
};

const uploadMySchoolLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json(formatResponse(false, 'School logo image is required'));

    const school = await School.findById(req.user?._id);
    if (!school) return res.status(404).json(formatResponse(false, 'School not found'));

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'schools/profile/logo');
    school.image = uploadResult.secure_url;
    await school.save();

    return res.status(200).json(formatResponse(true, 'School logo updated successfully', {
      image: uploadResult.secure_url,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error uploading school logo', null, error.message));
  }
};

const uploadMySchoolIdCardLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json(formatResponse(false, 'ID card logo image is required'));

    const school = await School.findById(req.user?._id);
    if (!school) return res.status(404).json(formatResponse(false, 'School not found'));

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'schools/id-cards/logos');
    school.idCardLogo = uploadResult.secure_url;
    await school.save();

    return res.status(200).json(formatResponse(true, 'ID card logo updated successfully', {
      idCardLogo: uploadResult.secure_url,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error uploading ID card logo', null, error.message));
  }
};

const uploadMySchoolPrincipalSignature = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json(formatResponse(false, 'Principal signature image is required'));

    const school = await School.findById(req.user?._id);
    if (!school) return res.status(404).json(formatResponse(false, 'School not found'));

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'schools/id-cards/signatures');

    if (!school.idCardSettings) school.idCardSettings = {};
    school.idCardSettings.principalSignatureUrl = uploadResult.secure_url;
    await school.save();

    return res.status(200).json(formatResponse(true, 'Principal signature updated successfully', {
      principalSignatureUrl: uploadResult.secure_url,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error uploading principal signature', null, error.message));
  }
};

module.exports = {
  register,
  registerSchool,
  loginSchool,
  refreshSchool,
  logoutSchool,
  resetPasswordSchool,
  sendSchoolForgotPasswordEmail,
  login,
  refresh,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  changeRole,
  getAllAdminsInSchool,
  updateUser,
  deleteTemp,
  deletePermanently,
  reinistateUser,
  getSchoolInfo,
  getMySchoolInfo,
  updateMySchoolInfo,
  uploadMySchoolLogo,
  uploadMySchoolIdCardLogo,
  uploadMySchoolPrincipalSignature,
  getAllStaffInSchool,
  generateUniqueUsername,
  generateStudentId,
  generateNextStudentRollNumber,
  verifyOTPToPhone,
};
