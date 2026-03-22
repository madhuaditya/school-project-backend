// const MaterialAlert = require('../models/MaterialAlert');

// // Admin → all alerts
// // Manager → own alerts
// const getAlerts = async (req, res) => {
//   const f = {};

//   if (req.user.role === 'manager') {
//     f.manager = req.user.id;
//   }

//   const alerts = await MaterialAlert.find(f)
//     .populate('material', 'name')
//     .sort({ createdAt: -1 });

//   res.json(alerts);
// };

// module.exports = { getAlerts };
