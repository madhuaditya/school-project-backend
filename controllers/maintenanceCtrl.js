// const Maintenance = require('../models/Maintenance');


// // ➕ ADD MAINTENANCE (MANAGER ONLY)
// const addMaintenance = async (req, res) => {
//   if (req.user.role !== 'manager') {
//     return res.sendStatus(403);
//   }

//   const data = {
//     ...req.body,
//     manager: req.user.id,
//   };

//   const m = await Maintenance.create(data);
//   res.status(201).json(m);
// };


// // ✏️ UPDATE MAINTENANCE (ONLY SAME MANAGER)
// const updateMaintenance = async (req, res) => {
//   if (req.user.role !== 'manager') {
//     return res.sendStatus(403);
//   }

//   const m = await Maintenance.findOne({
//     _id: req.params.id,
//     manager: req.user.id,
//   });

//   if (!m) return res.sendStatus(404);

//   Object.assign(m, req.body);
//   await m.save();

//   res.json(m);
// };


// // 👀 GET MAINTENANCE
// // Admin → all
// // Manager → own
// const getMaintenance = async (req, res) => {
//   let filter = {};

//   if (req.user.role === 'manager') {
//     filter.manager = req.user.id;
//   } else if (req.user.role !== 'admin') {
//     return res.sendStatus(403);
//   }

//   const list = await Maintenance.find(filter)
//     .populate('manager', 'name phone email')
//     .sort({ maintenanceDate: -1 });

//   res.json(list);
// };

// module.exports = {
//   addMaintenance,
//   updateMaintenance,
//   getMaintenance,
// };
