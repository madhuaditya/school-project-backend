import { body } from "express-validator";

export const registerValidation = [
  body("name").notEmpty().isLength({ min: 2 }),
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  body("phone").optional().isLength({ min: 10, max: 10 })
];

export const updateValidation = [
  body("name").optional().isLength({ min: 2 }),
  body("email").optional().isEmail(),
  body("phone").optional().isLength({ min: 10, max: 10 })
];

export const verifyLoginOTP = async (req, res) => {
  const { email, otp } = req.body;

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  const user = await User.findOne({
    email,
    otp: hashedOtp,
    otpExpire: { $gt: Date.now() }
  });

  if (!user)
    return res.status(400).json({ msg: "Invalid or expired OTP" });

  user.otp = undefined;
  user.otpExpire = undefined;
  user.isVerified = true;

  await user.save();

  res.json({
    token: generateToken(user._id, user.role),
    user
  });
};