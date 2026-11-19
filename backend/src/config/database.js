const mongoose = require('mongoose');
const SafetySession = require('../models/SafetySession.model');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required before the backend can start');
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    await SafetySession.createIndexes();

    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    console.log('✓ Safety session indexes initialized');
    return conn;
  } catch (error) {
    console.error(`✗ Error connecting to MongoDB: ${error.message}`);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error(`✗ Error disconnecting MongoDB after startup failure: ${disconnectError.message}`);
    }

    throw error;
  }
};

module.exports = connectDB;
