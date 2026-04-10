const jwt = require('jsonwebtoken');
const User = require('../models/user');
const School = require('../models/school');
const mongoose = require('mongoose');
const validateUser = (req, res, next) => {
  const queryToken = req.query?.token;
  const h = req.headers.authorization || (queryToken ? `Bearer ${queryToken}` : undefined);
  // console.log("auth header ", h);
  if (!h || !h.startsWith('Bearer '))
    return res.sendStatus(401);

  const t = h.split(' ')[1];

  jwt.verify(t, process.env.JWT_ACCESS_SECRET, async (e, d) => {
    // console.log("jwt verify ", e, d);
      // console.log("nhi fata hai yahan par 000");
    if (e) return res.sendStatus(444);
    // console.log("yahi par fata hai");
    // console.log(d);
    // console.log("nhi fata hai yahan par 001");
    const user = await User.findById(new mongoose.Types.ObjectId(d._id)).populate('role', 'role').populate('school', '_id name');
      // console.log("nhi fata hai yahan par 002");
    // console.log("user ", user._id);
    const school = await School.findById(new mongoose.Types.ObjectId(d._id)).populate('role', 'role');
    // console.log("school ", school._id);
      // console.log("nhi fata hai yahan par 003");

    if(!school?._id && !user?._id) return res.sendStatus(444);
      // console.log("nhi fata hai yahan par 004");
    if(user)
    req.user = user;
  else if(school) {
    req.user = school;
    req.user.school = {
      _id: school._id,
      name: school.name,
      role: 'admin'
    };
    }else {
      return res.sendStatus(444);
    }
    // console.log(req.user)
      // console.log("nhi fata hai yahan par 005");
    next();
  });
};

module.exports = { validateUser };
