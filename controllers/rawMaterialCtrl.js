// const RawMaterial = require('../models/RawMaterial');
// const MaterialConsumption = require('../models/MaterialConsumption');
// const MaterialAlert = require('../models/MaterialAlert');

// // ADD MATERIAL (Manager)
// const addMaterial = async (req, res) => {
//   const { name, unit, quantity, threshold } = req.body;

//   const m = await RawMaterial.create({
//     name,
//     unit,
//     quantity,
//     threshold,
//     manager: req.user.id,
//   });

//   res.status(201).json(m);
// };

// // GET MATERIALS
// // Admin → all
// // Manager → own
// const getMaterials = async (req, res) => {
//   const f = {};
//   if (req.user.role === 'manager') {
//     f.manager = req.user.id;
//   }

//   const list = await RawMaterial.find(f)
//     .populate('manager', 'name')
//     .sort({ createdAt: -1 });

//   res.json(list);
// };

// // CONSUME MATERIAL (Manager)
// const consumeMaterial = async (req, res) => {
//   const { materialId, quantityUsed, purpose } = req.body;

//   const m = await RawMaterial.findById(materialId);
//   if (!m) return res.sendStatus(404);

//   // Ownership check
//   if (m.manager.toString() !== req.user.id) {
//     return res.sendStatus(403);
//   }

//   // Stock check
//   if (m.quantity < quantityUsed) {
//     return res.status(400).json({
//       msg: 'Insufficient material stock',
//     });
//   }

//   // Deduct
//   m.quantity -= quantityUsed;
//   await m.save();

//   // Log consumption
//   await MaterialConsumption.create({
//     material: m._id,
//     quantityUsed,
//     purpose,
//     manager: req.user.id,
//   });

//   // Threshold alert
//   if (m.quantity <= m.threshold) {
//     await MaterialAlert.create({
//       material: m._id,
//       manager: req.user.id,
//       message: `${m.name} stock below threshold`,
//     });
//   }

//   res.json({
//     msg: 'Material consumed',
//     remaining: m.quantity,
//   });
// };

// module.exports = {
//   addMaterial,
//   getMaterials,
//   consumeMaterial,
// };
