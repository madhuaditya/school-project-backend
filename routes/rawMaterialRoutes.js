// const express = require('express');
// const { validateUser } = require('../middleware/auth');
// const { allow } = require('../middleware/role');
// const {
//   addMaterial,
//   getMaterials,
//   consumeMaterial,
// } = require('../controllers/rawMaterialCtrl');

// const r = express.Router();

// r.post('/', validateUser, allow('manager'), addMaterial);
// r.get('/', validateUser, allow('admin', 'manager'), getMaterials);
// r.post(
//   '/consume',
//   validateUser,
//   allow('manager'),
//   consumeMaterial
// );

// module.exports = r;
