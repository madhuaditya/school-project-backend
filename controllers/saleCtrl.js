// const Sale = require('../models/Sale');
// const BrickStock = require('../models/BrickStock');
// // CREATE BILL (Manager only)
// const createSale = async (req, res) => {
//   const {
//     billNo,
//     customerName,
//     brickType,
//     quantity,
//     rate,
//     gst,
//     gstPercent,
//     discount,
//     paymentStatus,
//   } = req.body;

//   // 1. Check stock
//   const stock = await BrickStock.findOne({ brickType , manager: req.user.id });
//   console.log(stock);

//   if (!stock || stock.totalQuantity < quantity) {
//     return res.status(400).json({
//       msg: 'Insufficient stock',
//     });
//   }

//   // 2. Calculate total
//   let total = quantity * rate;
//   if (gst) total += total * (gstPercent / 100);
//   if (discount) total -= discount;

//   // 3. Deduct stock
//   stock.totalQuantity -= quantity;
//   await stock.save();

//   // 4. Save sale
//   const sale = await Sale.create({
//     billNo,
//     customerName,
//     brickType,
//     quantity,
//     rate,
//     gst,
//     gstPercent,
//     discount,
//     totalAmount: total,
//     paymentStatus,
//     manager: req.user.id,
//     companyName: 'RHCC Pvt Ltd',
//     gstNumber: '22AAAAA0000A1Z5',
//   });

//   res.status(201).json(sale);
// };

// // GET SALES (Admin → all, Manager → own)
// const getSales = async (req, res) => {
//   let filter = {};

//   if (req.user.role === 'manager') {
//     filter.manager = req.user.id;
//   }

//   const sales = await Sale.find(filter)
//     .populate('manager', 'name email')
//     .sort({ createdAt: -1 });

//   res.json(sales);
// };

// // GET SINGLE BILL (Protected)
// const getSaleById = async (req, res) => {
//   const sale = await Sale.findById(req.params.id).populate(
//     'manager',
//     'name email'
//   );

//   if (!sale) return res.sendStatus(404);

//   if (
//     req.user.role === 'manager' &&
//     sale.manager._id.toString() !== req.user.id
//   ) {
//     return res.sendStatus(403);
//   }

//   res.json(sale);
// };

// // UPDATE PAYMENT STATUS (Admin or Owner Manager)
// const updatePaymentStatus = async (req, res) => {
//   const { status } = req.body;

//   if (!['paid', 'pending'].includes(status)) {
//     return res.status(400).json({ msg: 'Invalid payment status' });
//   }

//   const sale = await Sale.findById(req.params.id);
//   if (!sale) return res.sendStatus(404);

//   // Manager can update only own sale
//   if (
//     req.user.role === 'manager' &&
//     sale.manager.toString() !== req.user.id
//   ) {
//     return res.sendStatus(402);
//   }

//   sale.paymentStatus = status;
//   await sale.save();

//   res.json({
//     msg: 'Payment status updated',
//     paymentStatus: sale.paymentStatus,
//   });
// };

// module.exports = {
//   createSale,
//   getSales,
//   getSaleById,
//   updatePaymentStatus,
// };
