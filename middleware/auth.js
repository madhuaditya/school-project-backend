const jwt = require('jsonwebtoken');
const User = require('../models/user');
const School = require('../models/school');
const mongoose = require('mongoose');
const validateUser = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer '))
    return res.sendStatus(401);

  const t = h.split(' ')[1];

  jwt.verify(t, process.env.JWT_ACCESS_SECRET, async (e, d) => {
    // console.log("jwt verify ", e, d);
    if (e) return res.sendStatus(403);
    console.log(d);
    const user = await User.findById(new mongoose.Types.ObjectId(d._id)).populate('role', 'role').populate('school', '_id name');
    // console.log("user ", user._id);
    // if (!user) return res.sendStatus(403);
    const school = await School.findById(new mongoose.Types.ObjectId(d._id)).populate('role', 'role');
    // console.log("school ", school._id);


    if(!school?._id && !user?._id) return res.sendStatus(403);
    if(user)
    req.user = user;
  else {
    req.school = {
      _id: school._id,
      name: school.name,
      role: 'admin'
    };
    req.user = school;}
    next();
  });
};

module.exports = { validateUser };
