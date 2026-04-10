// src/middleware/validate.js

const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isPhone = (p) => /^[6-9]\d{9}$/.test(p);



const validateUpdate = (req, res, next) => {
  const { name, pincode, address, city, state, phone } = req.body;

  if (name && (name.trim().length < 2))
    return res.status(400).json({ msg: 'Invalid name' });

  if (phone && !isPhone(phone))
    return res.status(400).json({ msg: 'Invalid phone number' });

  if(address && address.trim().length < 5)
    return res.status(400).json({ msg: 'Invalid address' });

  if(city && city.trim().length < 2)
    return res.status(400).json({ msg: 'Invalid city' });

  if(state && state.trim().length < 2)
    return res.status(400).json({ msg: 'Invalid state' });

  if(pincode && !/^\d{6}$/.test(pincode))
    return res.status(400).json({ msg: 'Invalid pincode' });

  next();
};

const validateUserLogin = (req, res, next) => {
  const { username, password } = req.body;

  if (!username || username.trim().length < 5)
    return res.status(400).json({ msg: 'Username required' });

  if (!password)
    return res.status(400).json({ msg: 'Password required' });

  next();
};

const validateForgotPassword = (req, res, next) => {
  const { username, email } = req.body;

  if (!username || username.trim().length < 5)
    return res.status(400).json({ msg: 'Username required' });

  if (!email)
    return res.status(400).json({ msg: 'Email required' });

  if (!isEmail(email))
    return res.status(400).json({ msg: 'Invalid email' });

  next();
};

const validateSchoolLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email)
    return res.status(400).json({ msg: 'Email required' });

  if (!isEmail(email))
    return res.status(400).json({ msg: 'Invalid email' });

  if (!password)
    return res.status(400).json({ msg: 'Password required' });

  next();
};

const validateRegister = (req, res, next) => {
  const { name, email, phone, password, role,username } = req.body;

  if (!name || name.trim().length < 5)
    return res.status(400).json({ msg: 'Invalid name' });

  if ( !username || username?.trim().length < 5)
    return res.status(400).json({ msg: 'Invalid username' });

  if (!email && !phone && !username)
    return res.status(400).json({ msg: 'Email, phone or username required' });

  if (email && !isEmail(email))
    return res.status(400).json({ msg: 'Invalid email' });

  if (phone && !isPhone(phone))
    return res.status(400).json({ msg: 'Invalid phone number' });

  if (!password || password.length < 6)
    return res.status(400).json({ msg: 'Password must be 6+ chars' });

  if (!role || !['admin', 'teacher', 'student', 'staff', 'school'].includes(role))
    return res.status(400).json({ msg: 'Invalid role' });
  next();
};

const validateSChoolRegister = (req, res, next) => {
  const { schoolId, schoolName, email, phone, password, role } = req.body;

  if (!schoolId)
    return res.status(400).json({ msg: 'Invalid school ID' });

  if (!schoolName || schoolName.trim().length < 2)
    return res.status(400).json({ msg: 'Invalid school name' });

  if (!email && !phone)
    return res.status(400).json({ msg: 'Email or phone required' });

  if (email && !isEmail(email))
    return res.status(400).json({ msg: 'Invalid email' });

  if (phone && !isPhone(phone))
    return res.status(400).json({ msg: 'Invalid phone number' });

  if (!password || password.length < 6)
    return res.status(400).json({ msg: 'Password must be 6+ chars' });

  if (!role || !['admin', 'teacher', 'student', 'staff', 'school'].includes(role))
    return res.status(400).json({ msg: 'Invalid role' });
  next();
};

const validateLogin = (req, res, next) => {
  const { username, email, phone, password } = req.body;

  if (!password)
    return res.status(400).json({ msg: 'Password required' });

  if (!email && !phone && !username)
    return res.status(400).json({ msg: 'Email, phone or username required' });

  if(username && username.trim().length < 5)
    return res.status(400).json({ msg: 'Invalid username' });

  if (email && !isEmail(email))
    return res.status(400).json({ msg: 'Invalid email' });

  if (phone && !isPhone(phone))
    return res.status(400).json({ msg: 'Invalid phone number' });

  next();
};

module.exports = {
  validateRegister,
  validateSChoolRegister,
  validateLogin,
  validateUpdate,
  validateUserLogin,
  validateForgotPassword,
  validateSchoolLogin,
};
