import crypto from "crypto";

export const forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.status(404).json({ msg: "User not found" });

  const resetToken = crypto.randomBytes(20).toString("hex");

  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  await user.save();

  const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

  res.json({ resetUrl });
};