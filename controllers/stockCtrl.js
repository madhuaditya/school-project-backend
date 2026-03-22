// const BrickStock = require('../models/BrickStock');

// // ➕ ADD STOCK (MANAGER ONLY)
// const addStock = async (req, res) => {
//   if (req.user.role !== 'manager') {
//     return res.sendStatus(403);
//   }

//   const { brickType, quantity, good, bad } = req.body;

//   if (!brickType || quantity == null) {
//     return res.status(400).json({ msg: 'Invalid input' });
//   }

//   const totalQuantity = Number(quantity);
//   const goodQuantity = Number(good || 0);
//   const badQuantity = Number(bad || 0);

//   if (goodQuantity + badQuantity > totalQuantity) {
//     return res
//       .status(400)
//       .json({ msg: 'Good + Bad cannot exceed total quantity' });
//   }

//   // Check if stock already exists for this manager & brickType
//   const existing = await BrickStock.findOne({
//     brickType,
//     manager: req.user.id,
//   });

//   if (existing) {
//     existing.totalQuantity += totalQuantity;
//     existing.goodQuantity += goodQuantity;
//     existing.badQuantity += badQuantity;

//     await existing.save();
//     return res.json(existing);
//   }

//   const stock = await BrickStock.create({
//     brickType,
//     totalQuantity,
//     goodQuantity,
//     badQuantity,
//     manager: req.user.id,
//   });

//   res.status(201).json(stock);
// };

// module.exports = { addStock };
