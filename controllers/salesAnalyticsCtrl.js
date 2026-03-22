// const Sale = require('../models/Sale');
// const mongoose = require('mongoose');

// const getSalesSummary = async (req, res) => {
//   const { type, date, month, year } = req.query;

//   let match = {};

//   // 🔒 Role based filter
//   if (req.user.role === 'manager') {
//     match.manager = new mongoose.Types.ObjectId(req.user.id);
//   } else if (req.user.role !== 'admin') {
//     return res.sendStatus(403);
//   }

//   // 🕒 Date filter
//   if (type === 'day') {
//     if (!date) return res.status(400).json({ msg: 'date required' });

//     const start = new Date(date);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(start);
//     end.setDate(end.getDate() + 1);

//     match.createdAt = { $gte: start, $lt: end };
//   }

//   if (type === 'month') {
//     if (!month || !year)
//       return res.status(400).json({ msg: 'month & year required' });

//     const start = new Date(year, month - 1, 1);
//     const end = new Date(year, month, 1);

//     match.createdAt = { $gte: start, $lt: end };
//   }

//   if (type === 'year') {
//     if (!year) return res.status(400).json({ msg: 'year required' });

//     const start = new Date(year, 0, 1);
//     const end = new Date(Number(year) + 1, 0, 1);

//     match.createdAt = { $gte: start, $lt: end };
//   }

//   // 📊 Aggregation
//   const result = await Sale.aggregate([
//     { $match: match },

//     {
//       $group: {
//         _id: '$brickType',
//         totalAmount: { $sum: '$totalAmount' },
//         totalQuantity: { $sum: '$quantity' },
//         count: { $sum: 1 },
//       },
//     },

//     {
//       $group: {
//         _id: null,
//         grandTotalAmount: { $sum: '$totalAmount' },
//         grandTotalQuantity: { $sum: '$totalQuantity' },
//         categories: {
//           $push: {
//             brickType: '$_id',
//             totalAmount: '$totalAmount',
//             totalQuantity: '$totalQuantity',
//             count: '$count',
//           },
//         },
//       },
//     },

//     {
//       $project: {
//         _id: 0,
//         grandTotalAmount: 1,
//         grandTotalQuantity: 1,
//         categories: 1,
//       },
//     },
//   ]);

//   res.json(result[0] || {
//     grandTotalAmount: 0,
//     grandTotalQuantity: 0,
//     categories: [],
//   });
// };

// module.exports = { getSalesSummary };
