const User = require('../models/user');
const cloudinary = require('../config/cloudinary');

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

// GET OWN PROFILE
const getMe = async (req, res) => {
  try {
    const u = await User.findById(req.user._id).select('-password -refreshToken -resetToken -resetTokenExp -__v');
    if (!u) return res.status(404).json(formatResponse(false, "User not found"));
    
    return res.status(200).json(formatResponse(true, "Profile fetched successfully", u));
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error fetching profile", null, error.message));
  }
};

// UPDATE PROFILE (name, phone only)
const updateProfile = async (req, res) => {
  try {
    const { name, phone, address, city, state, pinCode } = req.body;
    
    if(name && name.length < 3) return res.status(400).json(formatResponse(false, 'Name must be at least 3 characters'));
    if(phone && !/^\d{10}$/.test(phone)) return res.status(400).json(formatResponse(false, 'Invalid phone number'));
    if(address && address.length < 5) return res.status(400).json(formatResponse(false, 'Address must be at least 5 characters'));
    if(city && city.length < 2) return res.status(400).json(formatResponse(false, 'City must be at least 2 characters'));
    if(state && state.length < 2) return res.status(400).json(formatResponse(false, 'State must be at least 2 characters'));
    if(pinCode && !/^\d{6}$/.test(pinCode)) return res.status(400).json(formatResponse(false, 'Invalid pin code'));

    const u = await User.findById(req.user._id);
    if (!u) return res.status(404).json(formatResponse(false, "User not found"));

    if (name) u.name = name;
    if (phone) u.phone = phone;
    if (address) u.address = address;
    if (city) u.city = city;
    if (state) u.state = state;
    if (pinCode) u.pinCode = pinCode;

    await u.save();
    
    return res.status(200).json(formatResponse(true, 'Profile updated successfully'));
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error updating profile", null, error.message));
  }
};

// UPLOAD PROFILE IMAGE
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json(formatResponse(false, 'Image required'));

    const r = await cloudinary.uploader.upload_stream(
      { folder: 'profiles' },
      async (e, result) => {
        try {
          if (e) return res.status(500).json(formatResponse(false, 'Upload failed', null, e.message));

          const u = await User.findById(req.user._id);
          if (!u) return res.status(404).json(formatResponse(false, "User not found"));
          
          u.image = result.secure_url;
          await u.save();

          return res.status(200).json(formatResponse(true, 'Profile image uploaded successfully', { 
            image: result.secure_url 
          }));
        } catch (error) {
          return res.status(500).json(formatResponse(false, 'Error saving image', null, error.message));
        }
      }
    );

    r.end(req.file.buffer);
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error uploading profile image", null, error.message));
  }
};

// GET BASIC PROFILE BY ID (same school only)
const getBasicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = await User.findById(req.user._id).populate('school', '_id');

    if (!requestingUser) return res.status(404).json(formatResponse(false, 'Requesting user not found'));

    const targetUser = await User.findById(id)
      .populate('school', '_id schoolName image')
      .populate('role', 'role');

    if (!targetUser) return res.status(404).json(formatResponse(false, 'User not found'));

    // Check if both users are in the same school
    if (requestingUser.school._id.toString() !== targetUser.school._id.toString()) {
      return res.status(403).json(formatResponse(false, 'Cannot view profile from different school'));
    }

    // If viewing own profile, return full data
    if (req.user._id.toString() === id) {
      const fullProfile = await User.findById(id)
        .select('-password -refreshToken -resetToken -resetTokenExp -__v');
      return res.status(200).json(formatResponse(true, 'Profile fetched successfully', fullProfile));
    }

    // Otherwise, return limited data: _id, name, email, school, role, image
    const limitedProfile = await User.findById(id).select('_id name email school role image');
    await limitedProfile.populate('school', 'schoolName image');
    await limitedProfile.populate('role', 'role');

    return res.status(200).json(formatResponse(true, 'Profile fetched successfully', limitedProfile));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching profile', null, error.message));
  }
};

module.exports = {
  getMe,
  updateProfile,
  uploadProfileImage,
  getBasicProfile,
};
