// import User from "../models/user.js";
// import bcrypt from "bcryptjs";
// import generateToken from "../utils/generateToken.js";
// import crypto from "crypto";
// import { sendEmail } from "../services/emailService.js";

// export const register = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     const exists = await User.findOne({ email });
//     if (exists) return res.status(400).json({ msg: "User already exists" });

//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword
//     });

//     res.status(201).json({
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       role: user.role,
//       token: generateToken(user._id, user.role)
//     });
//   } catch (err) {
//     res.status(500).json({ msg: "Server Error" });
//   }
// };

// export const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     console.log("Login attempt:", email);
//     // console.log("Password provided:", password );

//     const user = await User.findOne({ email });
//     console.log("User found:", user ? user.email : "No user");
//     if (!user) return res.status(400).json({ msg: "User Not Exists" });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch)
//       return res.status(400).json({ msg: "Invalid credentials" });

//     res.json({
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       role: user.role,
//       token: generateToken(user._id, user.role),
//       user: { ...user.toObject(), password: undefined }
//     });
//   } catch (err) {
//     res.status(500).json({ msg: "Server Error" });
//   }
// };

// export const updateProfile = async (req, res) => {
//   const user = await User.findById(req.user._id);

//   if (!user) return res.status(404).json({ msg: "User not found" });

//   user.name = req.body.name || user.name;
//   user.phone = req.body.phone || user.phone;
//   user.dob = req.body.dob || user.dob;
//   user.address = req.body.address || user.address;

//   const updated = await user.save();
//   updated.password = undefined;

//   res.json(updated);
// };

// export const changePassword = async (req, res) => {
//   const { oldPassword, newPassword } = req.body;

//   const user = await User.findById(req.user._id);
//   if (!user) return res.status(404).json({ msg: "User not found" });

//   const isMatch = await bcrypt.compare(oldPassword, user.password);
//   if (!isMatch)
//     return res.status(400).json({ msg: "Old password incorrect" });

//   const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(newPassword, salt);
    
//   user.password = hashedPassword;
//   await user.save();

//   res.json({ msg: "Password updated successfully" });
// };


// export const sendLoginOTP = async (req, res) => {
//   const { email } = req.body;

//   console.log("Received email for OTP:", email);

//   const user = await User.findOne({ email });
//   if (!user) return res.status(404).json({ msg: "User not found" });

//   const otp = Math.floor(100000 + Math.random() * 900000).toString();

//   user.otp = otp;
//   user.otpExpire = Date.now() + 10 * 60 * 1000;

//   await user.save();

//   await sendEmail(
//     user.email,
//     "Your Login OTP",
//     `<h2>Your OTP is: ${otp}</h2><p>Valid for 10 minutes</p>`
//   );

//   res.json({ msg: "OTP sent to email" });
// };

// export const verifyLoginOTP = async (req, res) => {
//   const { email, otp } = req.body;

//   const hashedOtp = otp;

//   const user = await User.findOne({
//     email,
//     otp: hashedOtp,
//     otpExpire: { $gt: Date.now() }
//   });

//   if (!user)
//     return res.status(400).json({ msg: "Invalid or expired OTP" });

//   user.otp = undefined;
//   user.otpExpire = undefined;
//   user.isVerified = true;

//   await user.save();

//   res.json({
//     token: generateToken(user._id, user.role),
//     user: { ...user.toObject(), password: undefined }
//   });
// };

// export const forgotPassword = async (req, res) => {
//   const user = await User.findOne({ email: req.body.email });
//   if (!user) return res.status(404).json({ msg: "User not found" });

//   const resetToken = crypto.randomBytes(20).toString("hex");

//   user.resetPasswordToken = crypto
//     .createHash("sha256")
//     .update(resetToken)
//     .digest("hex");

//   user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

//   await user.save();

//   const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

//   await sendEmail(
//     user.email,
//     "Password Reset",
//     `<p>Click below to reset password</p>
//      <a href="${resetUrl}">${resetUrl}</a>`
//   );

//   res.json({ msg: "Reset link sent to email" });
// };

// export const resetPassword = async (req, res) => {
//   const hashedToken = crypto
//     .createHash("sha256")
//     .update(req.params.token)
//     .digest("hex");
//   // console.log("Received reset token:", req.params.token);
//   const user = await User.findOne({
//     resetPasswordToken: hashedToken,
//     resetPasswordExpire: { $gt: Date.now() }
//   });

//   if (!user)
//     return res.status(400).json({ msg: "Token invalid or expired" });
//   const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(req.body.password, salt);
//   user.password = hashedPassword;
//   user.resetPasswordToken = undefined;
//   user.resetPasswordExpire = undefined;

//   await user.save();

//   res.json({ msg: "Password reset successful" });
// };