const User = require('../models/user');
const Role = require('../models/role');
const School = require('../models/school');
const jwt = require('jsonwebtoken');
const sendMail = require('../utils/mailer');
const { genAT, genRT } = require('../utils/jwt');
const mongoose = require('mongoose');
const VALID_ROLES = ['admin', 'teacher', 'student', 'staff', 'school'];
const Teacher = require('../models/teacher');
const Admin = require('../models/admin');
const { validateStudentAndAdminofSchool } = require('../middleware/ValidateRelation');

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// REGISTER
const register = async (req, res) => {
  const session = await mongoose.startSession();
  let createdUser = null;

  try {
    const { name, email, phone, password, role, school, image } = req.body;
    const adminInfo = req.user;
    
    if(!adminInfo || (adminInfo.role.role !== 'admin' && adminInfo.role.role !== 'school' && adminInfo.role.role !== 'teacher')) {
      return res.status(403).json(formatResponse(false, 'Only admins can register new users'));
    }

    if (!password || (!email && !phone) || !role)
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

      let ex = null;
      if (email) {
        ex = await User.findOne({ email }).session(session);
      }
      if (!ex && phone) {
        ex = await User.findOne({ phone }).session(session);
      }
      if (ex) {
        throw createHttpError(409, 'User already exists');
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
        email,
        phone,
        image,
        password,
        address: req.body.address || '',
        city: req.body.city || '',
        state: req.body.state || '',
        pinCode: req.body.pinCode || '',
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
    const { name, phone, image, address, city, pinCode, state } = req.body;
    const u = await User.findById(req.user._id).populate('role', 'role').populate('school', 'id schoolName image');
    
    if (!u) return res.status(404).json(formatResponse(false, 'User not found'));
    
    u.name = name || u.name;
    u.phone = phone || u.phone;
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

// LOGIN
const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    const u = await User.findOne({ email }).populate('role', 'role').populate('school', 'id schoolName image');

    if (!u) return res.status(401).json(formatResponse(false, 'Invalid credentials'));
    
    const isMatch = await u.comparePassword(password);
    if (!isMatch) return res.status(401).json(formatResponse(false, 'Invalid credentials'));
    
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
      email: u.email,
      role: u.role,
      _id: u._id,
      phone: u.phone,
      school: u.school,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error during login', null, error.message));
  }
};

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
    const { email } = req.body;

    const u = await User.findOne({ email, active: true });
    if (!u) return res.status(404).json(formatResponse(false, 'User not found'));

    const token = jwt.sign(
      { id: u._id },
      process.env.RESET_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    u.resetToken = token;
    u.resetTokenExp = Date.now() + 15 * 60 * 1000;
    await u.save();

    const link = `${process.env.CLIENT_URL}/reset-password/${token}`;

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
    
    await sendMail(
      sch.email,
      'School Registration Successful', 
      `<p>Your school has been registered successfully!</p><p>School Name: ${sch.schoolName}</p><p>Email: ${sch.email}</p>`
    );
    
    return res.status(201).json(formatResponse(true, 'School registered successfully', { schoolId: sch._id }));
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
        role: sch.role 
      }, 
      token,
      refreshToken
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
  reinistateUser
};