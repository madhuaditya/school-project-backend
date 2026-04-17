// src/routes/authRoutes.js (updated)

const express = require("express");
const {
  register,
  login,
  refresh,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  changeRole,
  registerSchool,
  loginSchool,
  refreshSchool,
  logoutSchool,
  sendSchoolForgotPasswordEmail,
  resetPasswordSchool,
  updateUser,
  deleteTemp,
  deletePermanently,
  reinistateUser,
  getAllAdminsInSchool,
  getSchoolInfo,
  getAllStaffInSchool
} = require("../controllers/authCtrl");
const {
  validateRegister,
  validateUpdate,
  validateSChoolRegister,
  validateUserLogin,
  validateForgotPassword,
  validateSchoolLogin,
} = require("../middleware/validate");
const { allow } = require("../middleware/role");
const { validateUser } = require("../middleware/auth");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");

const r = express.Router();

r.post(
  "/register",
  validateUser,
  checkSubscriptionActive,
  allow("admin", "teacher", "school"),
  validateRegister,
  register,
);
r.post("/login", validateUserLogin, login);
r.post("/refresh", refresh);
r.post("/logout", logout);
r.post("/change-password", validateUser, checkSubscriptionActive, changePassword);
r.post("/forgot-password", validateForgotPassword, forgotPassword);
r.post("/reset-password", resetPassword);
r.post("/change-role", validateUser, checkSubscriptionActive, allow("admin", ), changeRole);
r.post("/update-user/:id", validateUser, checkSubscriptionActive, validateUpdate, allow("admin",'teacher','staff' , 'student'), updateUser);
r.post("/delete-user/:id", validateUser, checkSubscriptionActive, allow("admin"), deleteTemp);
r.post("/delete-user-permanent/:id", validateUser, checkSubscriptionActive, allow("admin"), deletePermanently);
r.post("/reinstate-user/:id", validateUser, checkSubscriptionActive, allow("admin"), reinistateUser);
r.get("/admin/all", validateUser, checkSubscriptionActive, allow("admin"), getAllAdminsInSchool);
r.get("/staff/all", validateUser, checkSubscriptionActive, allow("admin"), getAllStaffInSchool);

// School routes
r.post("/school/register", validateSChoolRegister, registerSchool);
r.post("/school/login", validateSchoolLogin, loginSchool);
r.post("/school/refresh", refreshSchool);
r.post("/school/logout", logoutSchool);
r.post("/school/forgot-password", sendSchoolForgotPasswordEmail);
r.post("/school/reset-password", resetPasswordSchool);
r.get("/school/:id", getSchoolInfo);

module.exports = r;
