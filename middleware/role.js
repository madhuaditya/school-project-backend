const allow = (...roles) => {
  return (req, res, next) => {
    // console.log("allow ", roles, req.user);
    if (!req.user || !roles.includes(req.user.role.role)) {
      return res.status(403).json({ msg: 'Access denied' });
    }
    console.log("Access granted for role:", req.user.role.role);
    next();
  };
};

module.exports = { allow };
