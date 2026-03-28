// src/server.js
require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');

// console.log("Connecting to MongoDB with URI: ", process.env.MONGO_URL);

const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL || process.env.MONGO_URI;

if (!MONGO_URL) {
  console.error('Missing MongoDB connection string. Set MONGO_URL (or MONGO_URI) in .env');
  process.exit(1);
}

mongoose
  .connect(MONGO_URL, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    if (err?.name === 'MongooseServerSelectionError') {
      console.error('Troubleshooting: check Atlas Network Access (allow your current IP or 0.0.0.0/0 for testing), DB user/password, and DNS access.');
    }
    process.exit(1);
  });
