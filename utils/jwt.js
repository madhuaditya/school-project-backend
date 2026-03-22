const jwt = require('jsonwebtoken');


const genAT = (u) => {
  console.log("Generating access token for user ", u._id, " with role ", u.role);
  return jwt.sign(
    { _id: u._id, role: u.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '2h' }
  );
};

const genRT = (u) => {
  console.log("Generating refresh token for user ", u._id);
  return jwt.sign(
    { _id: u._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '90d' }
  );
};

module.exports = { genAT, genRT };
