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

const toPlainId = (value) => {
  if (!value) return value;
  if (typeof value === 'string') return value;
  if (typeof value?.toString === 'function' && value.toString() !== '[object Object]') {
    return value.toString();
  }

  // Handle ObjectId-like structures serialized as buffer payloads.
  if (value?.buffer?.data && Array.isArray(value.buffer.data)) {
    return value.buffer.data.map((b) => Number(b).toString(16).padStart(2, '0')).join('');
  }

  return value;
};

const normalizeProfilePayload = (profile) => {
  if (!profile) return profile;

  const normalized = {
    ...profile,
    _id: toPlainId(profile._id),
  };

  if (normalized.role && typeof normalized.role === 'object') {
    normalized.role = {
      ...normalized.role,
      _id: toPlainId(normalized.role._id),
    };
  }

  if (normalized.school && typeof normalized.school === 'object') {
    normalized.school = {
      ...normalized.school,
      _id: toPlainId(normalized.school._id),
    };
  }

  return normalized;
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET OWN PROFILE
const getMe = async (req, res) => {
  try {
    const u = await User.findById(req.user._id)
      .select('-password -refreshToken -resetToken -resetTokenExp -__v')
      .lean();
    if (!u) return res.status(404).json(formatResponse(false, "User not found"));
    
    return res.status(200).json(formatResponse(true, "Profile fetched successfully", normalizeProfilePayload(u)));
  } catch (error) {
    console.error("Error in getMe:", error);
    return res.status(500).json(formatResponse(false, "Error fetching profile", null, error.message));
  }
};

// UPDATE PROFILE (name, phone only)
const updateProfile = async (req, res) => {
  try {
    const { name, phone, smsPhone, whatsappPhone, telegramChatId, address, city, state, pinCode } = req.body;
    const nextName = typeof name === 'string' ? name.trim() : undefined;
    const nextPhone = typeof phone === 'string' ? phone.trim() : undefined;
    const nextSmsPhone = typeof smsPhone === 'string' ? smsPhone.trim() : undefined;
    const nextWhatsappPhone = typeof whatsappPhone === 'string' ? whatsappPhone.trim() : undefined;
    const nextTelegramChatId = typeof telegramChatId === 'string' ? telegramChatId.trim() : undefined;
    const nextAddress = typeof address === 'string' ? address.trim() : undefined;
    const nextCity = typeof city === 'string' ? city.trim() : undefined;
    const nextState = typeof state === 'string' ? state.trim() : undefined;
    const nextPinCode = typeof pinCode === 'string' ? pinCode.trim() : undefined;
    
    if(nextName && nextName.length < 3) return res.status(400).json(formatResponse(false, 'Name must be at least 3 characters'));
    if(nextPhone && !/^\d{10}$/.test(nextPhone)) return res.status(400).json(formatResponse(false, 'Invalid phone number'));
    if(nextSmsPhone && !/^\d{10,15}$/.test(nextSmsPhone)) return res.status(400).json(formatResponse(false, 'Invalid SMS phone number'));
    if(nextWhatsappPhone && !/^\d{10,15}$/.test(nextWhatsappPhone)) return res.status(400).json(formatResponse(false, 'Invalid WhatsApp phone number'));
    if(nextAddress && nextAddress.length < 5) return res.status(400).json(formatResponse(false, 'Address must be at least 5 characters'));
    if(nextCity && nextCity.length < 2) return res.status(400).json(formatResponse(false, 'City must be at least 2 characters'));
    if(nextState && nextState.length < 2) return res.status(400).json(formatResponse(false, 'State must be at least 2 characters'));
    if(nextPinCode && !/^\d{6}$/.test(nextPinCode)) return res.status(400).json(formatResponse(false, 'Invalid pin code'));

    const u = await User.findById(req.user._id);
    if (!u) return res.status(404).json(formatResponse(false, "User not found"));

    if (nextName !== undefined) u.name = nextName;
    if (nextPhone !== undefined) u.phone = nextPhone;
    if (nextSmsPhone !== undefined) u.smsPhone = nextSmsPhone;
    if (nextWhatsappPhone !== undefined) u.whatsappPhone = nextWhatsappPhone;
    if (nextTelegramChatId !== undefined) u.telegramChatId = nextTelegramChatId;
    if (nextAddress !== undefined) u.address = nextAddress;
    if (nextCity !== undefined) u.city = nextCity;
    if (nextState !== undefined) u.state = nextState;
    if (nextPinCode !== undefined) u.pinCode = nextPinCode;

    await u.save();

    const updatedProfile = await User.findById(req.user._id)
      .select('-password -refreshToken -resetToken -resetTokenExp -__v')
      .lean();
    
    return res.status(200).json(
      formatResponse(true, 'Profile updated successfully', normalizeProfilePayload(updatedProfile))
    );
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
      .populate('role', '_id role');

    if (!targetUser) return res.status(404).json(formatResponse(false, 'User not found'));

    // Check if both users are in the same school
    if (requestingUser.school._id.toString() !== targetUser.school._id.toString()) {
      return res.status(403).json(formatResponse(false, 'Cannot view profile from different school'));
    }

    // If viewing own profile, return full data
    if (req.user._id.toString() === id) {
      // console.log('User is viewing their own profile, returning full data');
      const fullProfile = await User.findById(id)
        .select('-password -refreshToken -resetToken -resetTokenExp -__v')
        .lean();
      return res.status(200).json(formatResponse(true, 'Profile fetched successfully', normalizeProfilePayload(fullProfile)));
    }

    // Otherwise, return limited data: _id, name, email, school, role, image
    // console.log('User is viewing another profile, returning limited data');
    const limitedProfile = await User.findById(id)
      .select('-email -phone -address -city -state -pinCode -createdAt -updatedAt -__v -password -refreshToken -resetToken -resetTokenExp')
      .populate('school', '_id schoolName image')
      .populate('role', '_id role')
      .lean();

    return res.status(200).json(formatResponse(true, 'Profile fetched successfully', normalizeProfilePayload(limitedProfile)));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching profile', null, error.message));
  }
};

const searchSchoolUsers = async (req, res) => {
  try {
    const query = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(Math.max(Number(req.query?.limit) || 6, 1), 10);

    if (query.length < 3) {
      return res.status(200).json(formatResponse(true, 'Enter at least 3 characters to search users', []));
    }

    const schoolId = req.user?.school?._id || req.user?.school;
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context is required'));
    }

    const safeQuery = escapeRegex(query);
    const startsWithRegex = new RegExp(`^${safeQuery}`, 'i');
    const containsRegex = new RegExp(safeQuery, 'i');
    const digitsOnly = query.replace(/\D/g, '');

    const phoneRegex = digitsOnly ? new RegExp(`^${escapeRegex(digitsOnly)}`) : null;

    const candidates = await User.find({
      school: schoolId,
      active: true,
      $or: [
        { name: startsWithRegex },
        { username: startsWithRegex },
        ...(phoneRegex ? [{ phone: phoneRegex }] : []),
        { name: containsRegex },
        { username: containsRegex },
      ],
    })
      .populate('role', 'role')
      .select('_id name username email phone image role')
      .limit(18)
      .lean();

    const normalizedQuery = query.toLowerCase();

    const ranked = candidates
      .map((entry) => {
        const name = String(entry.name || '').toLowerCase();
        const username = String(entry.username || '').toLowerCase();
        const phone = String(entry.phone || '');

        let score = 0;
        if (name.startsWith(normalizedQuery)) score += 100;
        else if (name.includes(normalizedQuery)) score += 60;

        if (username.startsWith(normalizedQuery)) score += 90;
        else if (username.includes(normalizedQuery)) score += 50;

        if (digitsOnly && phone.startsWith(digitsOnly)) score += 95;
        else if (digitsOnly && phone.includes(digitsOnly)) score += 55;

        if (name === normalizedQuery || username === normalizedQuery || (digitsOnly && phone === digitsOnly)) {
          score += 30;
        }

        return {
          _id: entry._id.toString(),
          name: entry.name,
          username: entry.username,
          email: entry.email,
          phone: entry.phone,
          image: entry.image,
          role: entry.role?.role || '',
          score,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit)
      .map(({ score, ...entry }) => entry);

    return res.status(200).json(formatResponse(true, 'Users fetched successfully', ranked));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error searching users', null, error.message));
  }
};

module.exports = {
  getMe,
  updateProfile,
  uploadProfileImage,
  getBasicProfile,
  searchSchoolUsers,
};
