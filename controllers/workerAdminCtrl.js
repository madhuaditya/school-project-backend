// const ManagerWorker = require('../models/ManagerWorker');
// const User = require('../models/user');

// const assignWorker = async (req, res) => {
//   const { managerId, workerId } = req.body;

//   await ManagerWorker.deleteOne({ worker: workerId });

//   const map = await ManagerWorker.create({
//     manager: managerId,
//     worker: workerId,
//   });

//   res.json({ msg: 'Worker assigned', data: map });
// };

// const getWokerAssignments = async (req, res) => {
//   const assignments = await ManagerWorker.find().populate('manager worker', 'name email phone');
//   res.json(assignments);
// };

// const getUserAreNotAdmin = async (req, res) => {
//   const { role } = req.user;

//   if (role !== 'admin') {
//     return res.sendStatus(403);
//   }

//   const users = await User.find({
//     role: { $in: ['manager', 'worker'] },
//   })
//     .select('-password -refreshToken -resetToken -resetTokenExp -__v')
//     .lean();

//   // Get manager-worker mapping
//  const mappings = await ManagerWorker.find()
//     .populate({
//       path: 'manager',
//       select: 'name email phone role',
//     })
//     .populate({
//       path: 'worker',
//       select: 'name email phone role',
//     })
//     .lean();

//   res.json({
//     users,
//     mappings,
//   });
// };

// module.exports = { assignWorker, getWokerAssignments, getUserAreNotAdmin };