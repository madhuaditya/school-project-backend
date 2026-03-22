// const Transport = require('../models/Transport');

// // CREATE TRANSPORT (Manager)
// const createTransport = async (req, res) => {
//   const {
//     destination,
//     distanceKm,
//     vehicleNo,
//     fuelCost,
//     labourCost,
//     otherCost,
//     note,
//   } = req.body;

//   const total =
//     Number(fuelCost) +
//     Number(labourCost || 0) +
//     Number(otherCost || 0);

//   const t = await Transport.create({
//     destination,
//     distanceKm,
//     vehicleNo,
//     fuelCost,
//     labourCost,
//     otherCost,
//     totalCost: total,
//     note,
//     manager: req.user.id,
//   });

//   res.status(201).json(t);
// };

// // GET TRANSPORTS (Admin → all, Manager → own)
// const getTransports = async (req, res) => {
//   const f = {};

//   if (req.user.role === 'manager') {
//     f.manager = req.user.id;
//   }

//   const list = await Transport.find(f)
//     .populate('manager', 'name')
//     .sort({ createdAt: -1 });

//   res.json(list);
// };

// // UPDATE TRANSPORT (Admin or Owner Manager)
// const updateTransport = async (req, res) => {
//   const t = await Transport.findById(req.params.id);
//   if (!t) return res.sendStatus(404);

//   if (
//     req.user.role === 'manager' &&
//     t.manager.toString() !== req.user.id
//   ) {
//     return res.sendStatus(403);
//   }

//   Object.assign(t, req.body);

//   t.totalCost =
//     Number(t.fuelCost || 0) +
//     Number(t.labourCost || 0) +
//     Number(t.otherCost || 0);

//   await t.save();

//   res.json({ msg: 'Transport updated', data: t });
// };

// module.exports = {
//   createTransport,
//   getTransports,
//   updateTransport,
// };
