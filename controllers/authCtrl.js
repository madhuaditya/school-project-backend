const User = require('../models/user');
const Role = require('../models/Role');
const School = require('../models/school');
const jwt = require('jsonwebtoken');
const sendMail = require('../utils/mailer');
const { genAT, genRT } = require('../utils/jwt');
const mongoose = require('mongoose');
const VALID_ROLES = ['admin', 'teacher', 'student', 'staff', 'school'];
const Teacher = require('../models/teacher');
const { validateStudentAndAdminofSchool } = require('../middleware/ValidateRelation');


// REGISTER
const register = async (req, res) => {
  const { name, email, phone, password, role, school, image } = req.body;
  const adminInfo = req.user; // Assuming the authenticated user's info is available in req.user
  if(!adminInfo || (adminInfo.role.role !== 'admin' && adminInfo.role.role !== 'school' && adminInfo.role.role !== 'teacher')) {
    return res.status(403).json({ msg: 'Only admins can register new users' });
  }

  if (!password || (!email && !phone) || !role)
    return res.status(400).json({ msg: 'Invalid data' });

  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ msg: 'Invalid role' });
    const sch = await School.findById(new mongoose.Types.ObjectId(school) );
  if(!school || sch === null){
    return res.status(400).json({ msg: 'Invalid school' });
  }
  const ex = await User.findOne({
    $or: [{ email }, { phone }],
  });
  if (ex) return res.status(409).json({ msg: 'User exists' });
  // console.log("Admin info ", adminInfo);
  const roleDoc = await Role.findOne({ role });
  if (!roleDoc) return res.status(400).json({ msg: 'Role not found' });
    // two conditions for school  : is adding any one or admin is adding to some one so in this case we will check if school is same as admin's school or not
  console.log(adminInfo);
 if((adminInfo.schoolName === null) && sch._id.toString() !== adminInfo.school._id.toString()) {
    return res.status(403).json({ msg: 'Cannot assign user to a different school' });
 }
 if((adminInfo.schoolName !== null) && sch._id.toString() !== adminInfo.school._id.toString()) {
  return res.status(403).json({ msg: 'Cannot assign user to a different school' });
 }
  
  const u = await User.create({
    name,
    email,
    phone,
    image,
    password,
    role: roleDoc._id,
    school: sch._id,
    createdBy: adminInfo._id,
    updatedBy: adminInfo._id,
    active: true
  });

   if(role === 'teacher' && adminInfo.role.role === 'admin') {
    const Teacher = require('../models/teacher');
    console.log("Creating teacher with user id ", u._id, " and principal id ", adminInfo._id);
    await Teacher.create({
      _id: u._id,
      user: u._id,
      principal: adminInfo._id
    });
  }

  if(role === 'admin' && adminInfo.role.role === 'admin') {
    const Admin = require('../models/admin');
    console.log("Creating admin with user id ", u._id, " and principal id ", adminInfo._id);
    await Admin.create({
       _id: u._id,
      user: u._id
    });
  }

  else if(role === 'student') {
    const Student = require('../models/student');
    await Student.create({
          _id: u._id,
          user: u._id,
          studentId: req.body.studentId,
          gradeLevel: req.body.gradeLevel,
          rollNumber: req.body.rollNumber,
          section: req.body.section,
          dateOfAdmission: req.body.dateOfAdmission,
          fatherName: req.body.fatherName,
          motherName: req.body.motherName,
          parentContact: req.body.parentContact,
          dateOfBirth: req.body.dateOfBirth
    });
  }

  else if(role === 'staff' && adminInfo.role.role === 'admin') {
    const Staff = require('../models/staff');
    await Staff.create({
      user: u._id
    });
  }
   await sendMail(
    u.email,
    'Registration Successful',
    `<p>Welcome to our platform!</p><p>Your account has been created with the following details:</p><ul><li>Name: ${u.name}</li><li>Email: ${u.email}</li><li>Role: ${role}</li></ul><p>Please log in to your account to get started.</p>`
  );
  res.status(201).json({ msg: 'User created' });
};


const updateUser = async (req, res) => {
  const { name, phone, image , address , city , pinCode,state } = req.body;
  const u = await User.findById(req.user._id).populate('role', 'role').populate('school', 'id schoolName image');
  if (!u) return res.status(404).json({ msg: 'User not found' });
  u.name = name || u.name;
  u.phone = phone || u.phone;
  u.image = image || u.image;
  u.address = address || u.address;
  u.city = city || u.city;
  u.pinCode = pinCode || u.pinCode;
  u.state = state || u.state;
  await u.save();
  res.json({ msg: 'User updated' });
};

const deleteTemp = async (req, res) => {
  const admin = req.user;
  const userId = req.params.id;
  const userToDelete = await User.findById(userId).populate('role', 'role').populate('school', 'id schoolName image');
  if (!userToDelete) return res.status(404).json({ msg: 'User not found' });
  if(admin.role.role !== 'admin') {
    return res.status(403).json({ msg: 'Only admins can delete users' });
  }

  if(!validateStudentAndAdminofSchool(admin._id, req.params.id, admin.school._id)) {
    return res.status(403).json({ msg: 'Cannot delete user from a different school' });
  }
  userToDelete.active = false;
  await userToDelete.save();
  res.json({ msg: 'User deleted' });
 
};

const deletePermanently = async (req, res) => {
  const admin = req.user;
  const userId = req.params.id;
  const userToDelete = await User.findById(userId).populate('role', 'role').populate('school', 'id schoolName image');
  if (!userToDelete) return res.status(404).json({ msg: 'User not found' });
  if(admin.role.role !== 'admin') {
    return res.status(403).json({ msg: 'Only admins can delete users' });
  }

  if(!validateStudentAndAdminofSchool(admin._id, req.params.id, admin.school._id)) {
    return res.status(403).json({ msg: 'Cannot delete user from a different school' });
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

  await userToDelete.remove();
 
  res.json({ msg: 'User deleted' });
 
};

const reinistateUser = async (req, res) => {
   const admin = req.user;
  const userId = req.params.id;
  const userToDelete = await User.findById(userId).populate('role', 'role').populate('school', 'id schoolName image');
  if (!userToDelete) return res.status(404).json({ msg: 'User not found' });
  if(admin.role.role !== 'admin') {
    return res.status(403).json({ msg: 'Only admins can delete users' });
  }

  if(!validateStudentAndAdminofSchool(admin._id, req.params.id, admin.school._id)) {
    return res.status(403).json({ msg: 'Cannot delete user from a different school' });
  }
  userToDelete.active = true;
  await userToDelete.save();
  res.json({ msg: 'User reinstated' });
 
};

// LOGIN
const login = async (req, res) => {
  const { email, phone, password } = req.body;

  const u = await User.findOne({
    $or: [{ email }, { phone }],
    active: true,
  }).populate('role', 'role').populate('school', 'id schoolName image');

  if (!u) return res.status(401).json({ msg: 'Invalid credentials' });
  console.log("User found for login: ", u.email, " with role ", u.role.role);
  const isMatch = await u.comparePassword(password)
  // console.log(isMatch ? "Password match successful" : "Password match failed", " for user: ");
  if (!isMatch) return res.status(401).json({ msg: 'Invalid credentials' });
  console.log("Password match successful for user: ", u.email);
  const at = genAT(u);
  const rt = genRT(u);

  u.refreshToken = rt;
  await u.save();

   await sendMail(
    u.email,
    'Login Alert',
    `<p>You have successfully logged in to your account.</p><p>If this wasn't you, please reset your password immediately.</p>`
  );
  res.json({
    accessToken: at,
    refreshToken: rt,
    name: u.name,
    email: u.email,
    role: u.role,
    _id: u._id,
    phone: u.phone,
    school: u.school,
  });
};

// REFRESH
const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  console.log("Refresh token received: ", (refreshToken? 'yes' : "No token") );
  if (!refreshToken) return res.sendStatus(401);

  const u = await User.findOne({ refreshToken });
  console.log("User found for refresh: ", u ? u.email : "No user");
  if (!u) return res.sendStatus(403);

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (e, d) => {
    if (e || u._id.toString() !== d._id) return res.sendStatus(403);
    const at = genAT(u);
    res.json({ accessToken: at });
  });
};

// LOGOUT
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.sendStatus(204);

  const u = await User.findOne({ refreshToken });
  if (u) {
    u.refreshToken = null;
    await u.save();
  }
  res.sendStatus(204);
};

// CHANGE PASSWORD
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const u = await User.findById(req.user._id);
  if (!u) return res.status(404).json({ msg: 'User not found' });
  const ok = await u.comparePassword(oldPassword);
  if (!ok) return res.status(401).json({ msg: 'Wrong password' });
  if(newPassword === oldPassword) return res.status(400).json({ msg: 'New password cannot be same as old password' }); 

  if(newPassword.length < 6) return res.status(400).json({ msg: 'Password must be at least 6 characters long' });


  u.password = newPassword;
  await u.save();
  await sendMail(
    u.email,
    'Password Updated',
    `<p>Your password has been updated successfully.</p><p>If this wasn't you, please reset your password immediately.</p>`
  );
  res.json({ msg: 'Password updated' });
};

// FORGOT PASSWORD
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const u = await User.findOne({ email, active: true });
  if (!u) return res.status(404).json({ msg: 'User not found' });

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

  res.json({ msg: 'Reset link sent' });
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  const u = await User.findOne({
    resetToken: token,
    resetTokenExp: { $gt: Date.now() },
  });
   if(password.length < 6) return res.status(400).json({ msg: 'Password must be at least 6 characters long' });


  if (!u) return res.status(400).json({ msg: 'Invalid or expired token' });

  u.password = password;
  u.resetToken = null;
  u.resetTokenExp = null;

  await u.save();
  await sendMail(
    u.email,
    'Password Updated',
    `<p>Your password has been updated successfully.</p><p>If this wasn't you, please reset your password immediately.</p>`
  );
  res.json({ msg: 'Password reset successful' });
};

// CHANGE ROLE (ADMIN ONLY)
const changeRole = async (req, res) => {
  if (req.user.role.role !== 'admin')
    return res.status(403).json({ msg: 'Forbidden' });

  const { userId, role } = req.body;

  const roleDoc = await Role.findById(role);
  if (!roleDoc) return res.status(400).json({ msg: 'Invalid role' });

  const u = await User.findById(userId);
  if (!u) return res.status(404).json({ msg: 'User not found' });

  u.role = roleDoc._id;
  await u.save();
  await sendMail(
    u.email,
    'Role Updated',
    `<p>Your role has been updated successfully.</p><p>If this wasn't you, please reset your password immediately.</p>`
  );
  res.json({ msg: 'Role updated' });
};

// Additional functions for school management (registerSchool, loginSchool, etc.) would go here

const registerSchool = async (req, res) => {
  const { schoolId, email, password, schoolName, address, city, state, pinCode } = req.body;
  if (!schoolId || !email || !password || !schoolName || !address || !city || !state || !pinCode) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  const ex = await School.findOne({ $or: [{ email }, { schoolId }] });
  const roleDoc = await Role.findOne({ role: 'admin' });
  if (!roleDoc) return res.status(400).json({ msg: 'Admin role not found' });
  if (ex) return res.status(409).json({ msg: 'School already exists' });
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
  res.status(201).json({ msg: 'School registered' });
};

const loginSchool = async (req, res) => {
  const { email, password } = req.body;

  const sch = await School.findOne({ email }).populate('role', 'role');
  if (!sch) return res.status(401).json({ msg: 'Invalid credentials' });

  const isMatch = await sch.comparePassword(password);
  if (!isMatch) return res.status(401).json({ msg: 'Invalid credentials' });

  const token = genAT(sch);
  const refreshToken = genRT(sch);
  sch.refreshToken = refreshToken;
  await sch.save();
   await sendMail(
    sch.email,
    'School Login Alert',
    `<p>Your school has successfully logged in to the system.</p><p>If this wasn't you, please reset your password immediately.</p>`
  );

  res.json({ school:{_id: sch._id, email: sch.email, schoolName: sch.schoolName, image: sch.image, role: sch.role }, token ,refreshToken});
};

const refreshSchool = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.sendStatus(401);
  const sch = await School.findOne({ refreshToken: token });
  if (!sch) return res.sendStatus(403);
  jwt.verify(token, process.env.SCHOOL_JWT_SECRET, (e, d) => {
    if (e || sch._id.toString() !== d.id) return res.sendStatus(403);
    const newToken = jwt.sign(
      { _id: sch._id },
      process.env.SCHOOL_JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token: newToken });
  });
};

const logoutSchool = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.sendStatus(204);
  const sch = await School.findOne({ refreshToken: token });
  if (sch) {
    sch.refreshToken = null;
    await sch.save();
  }
  res.sendStatus(204);
};

const sendSchoolForgotPasswordEmail = async (sch) => {
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
};


const resetPasswordSchool = async (req, res) => {
  const { token, password } = req.body;
  const sch = await School.findOne({ refreshToken: token });
  if (!sch) return res.sendStatus(403);
  if(password.length < 8) return res.status(400).json({ msg: 'Password must be at least 8 characters long' });


  sch.password = password;
  await sch.save();
  res.json({ msg: 'Password reset successful' });
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
  updateUser,
  deleteTemp,
  deletePermanently,
  reinistateUser
};