const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.warn('\n⚠️  WARNING: MONGODB_URI not configured in .env file');
    console.warn('⚠️  Backend will run but database features are disabled');
    console.warn('⚠️  Copy .env.example to .env and add your MongoDB Atlas URI\n');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`✗ Error connecting to MongoDB: ${error.message}`);
    console.error('✗ Backend will run but database features are disabled\n');
  }
};

module.exports = connectDB;
