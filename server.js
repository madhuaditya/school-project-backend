// src/server.js
require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');
const dotenv = require("dotenv")
dotenv.config();

const PORT = process.env.PORT || 5000;
mongoose
  .connect('mongodb://127.0.0.1/smsproject')
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
