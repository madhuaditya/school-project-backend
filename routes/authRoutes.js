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
  getSchoolInfo
} = require("../controllers/authCtrl");
const { validateRegister,validateUpdate, validateLogin,validateSChoolRegister } = require("../middleware/validate");
const { allow } = require("../middleware/role");
const { validateUser } = require("../middleware/auth");

const r = express.Router();

r.post(
  "/register",
  validateUser,
  allow("admin", "teacher", "school"),
  validateRegister,
  register,
);
r.post("/login", validateLogin, login);
r.post("/refresh", refresh);
r.post("/logout", logout);
r.post("/change-password", validateUser, changePassword);
r.post("/forgot-password", forgotPassword);
r.post("/reset-password", resetPassword);
r.post("/change-role", validateUser, allow("admin", ), changeRole);
r.post("/update-user/:id", validateUser,validateUpdate, allow("admin",'teacher','staff' , 'student'), updateUser);
r.post("/delete-user/:id", validateUser, allow("admin"), deleteTemp);
r.post("/delete-user-permanent/:id", validateUser, allow("admin"), deletePermanently);
r.post("/reinstate-user/:id", validateUser, allow("admin"), reinistateUser);
r.get("/admin/all", validateUser, allow("admin"), getAllAdminsInSchool);

// School routes
r.post("/school/register", validateSChoolRegister, registerSchool);
r.post("/school/login", validateLogin, loginSchool);
r.post("/school/refresh", refreshSchool);
r.post("/school/logout", logoutSchool);
r.post("/school/forgot-password", sendSchoolForgotPasswordEmail);
r.post("/school/reset-password", resetPasswordSchool);
r.get("/school/:id", getSchoolInfo);

module.exports = r;
