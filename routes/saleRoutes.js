// const express = require('express');
// const { validateUser } = require('../middleware/auth');
// const { allow } = require('../middleware/role');
// const {
//   createSale,
//   getSales,
//   getSaleById,updatePaymentStatus 
// } = require('../controllers/saleCtrl');

// const r = express.Router();

// // Manager creates bill
// r.post('/', validateUser, allow('manager'), createSale);

// // Admin & Manager view bills
// r.get('/', validateUser, allow('admin', 'manager'), getSales);

// // View single bill
// r.get('/:id', validateUser, allow('admin', 'manager'), getSaleById);

// // Update payment status
// r.patch('/:id/payment',validateUser,  allow('admin', 'manager'),  updatePaymentStatus);

// module.exports = r;
