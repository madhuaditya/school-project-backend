// const User = require('../models/user');
// const cloudinary = require('../config/cloudinary');

// // GET OWN PROFILE
// const getMe = async (req, res) => {
//     // console.log("user details", req.user);
//   const u = await User.findById(req.user.id).select('-password -refreshToken -resetToken -resetTokenExp -__v');
//   res.json(u);
// };

// // UPDATE PROFILE (name, phone only)
// const updateProfile = async (req, res) => {
//   const { name, phone } = req.body;

//   const u = await User.findById(req.user.id);
//   if (!u) return res.sendStatus(404);

//   if (name) u.name = name;
//   if (phone) u.phone = phone;

//   await u.save();
//   res.json({ msg: 'Profile updated' });
// };

// // UPLOAD PROFILE IMAGE
// const uploadProfileImage = async (req, res) => {
//   if (!req.file) return res.status(400).json({ msg: 'Image required' });

//   const r = await cloudinary.uploader.upload_stream(
//     { folder: 'profiles' },
//     async (e, result) => {
//       if (e) return res.status(500).json({ msg: 'Upload failed' });

//       const u = await User.findById(req.user.id);
//       u.profileImage = result.secure_url;
//       await u.save();

//       res.json({ image: result.secure_url });
//     }
//   );

//   r.end(req.file.buffer);
// };

// module.exports = {
//   getMe,
//   updateProfile,
//   uploadProfileImage,
// };
