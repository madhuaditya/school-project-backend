const requireSchoolAccount = (req, res, next) => {
  if (!req.user || !req.user.isSchoolAccount) {
    return res.status(403).json({ success: false, msg: 'School account access required' });
  }

  return next();
};

module.exports = { requireSchoolAccount };