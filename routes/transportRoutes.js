// const express = require('express');
// const { validateUser } = require('../middleware/auth');
// const { allow } = require('../middleware/role');
// const {
//   createTransport,
//   getTransports,
//   updateTransport,
// } = require('../controllers/transportCtrl');

// const r = express.Router();

// // Manager creates
// r.post('/', validateUser, allow('manager'), createTransport);

// // Admin + Manager view
// r.get('/', validateUser, allow('admin', 'manager'), getTransports);

// // Admin + Owner manager update
// r.put('/:id', validateUser, allow('admin', 'manager'), updateTransport);

// module.exports = r;
