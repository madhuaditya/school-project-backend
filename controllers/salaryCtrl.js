// const Salary = require('../models/salary');
// const ManagerWorker = require('../models/ManagerWorker');

// const addSalary = async (req, res) => {
//   const { userId, amount, type, periodStart, periodEnd } = req.body;

//   if (req.user.role === 'manager') {
//     const ok = await ManagerWorker.findOne({
//       manager: req.user.id,
//       worker: userId,
//     });
//     if (!ok) return res.sendStatus(403);
//   }

//   const s = await Salary.create({
//     user: userId,
//     amount,
//     type,
//     periodStart,
//     periodEnd,
//     addedBy: req.user.id,
//   });

//   res.status(201).json(s);
// };

// const getSalaryLogs = async (req, res) => {
//   const { userId } = req.query;

//   const logs = await Salary.find({ user: userId }).sort({
//     createdAt: -1,
//   });

//   res.json(logs);
// };

// module.exports = { addSalary, getSalaryLogs };
