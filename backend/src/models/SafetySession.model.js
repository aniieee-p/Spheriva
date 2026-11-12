const mongoose = require('mongoose');

const locationPointSchema = new mongoose.Schema({
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  accuracy: { type: Number },
  recordedAt: { type: Date, default: Date.now }
}, { _id: false });

const safetySessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  locations: [locationPointSchema],
  lastLocation: { type: locationPointSchema }
}, {
  timestamps: true
});

// Ek user ka ek hi active session ho sakta hai (database level par bhi)
safetySessionSchema.index(
  { user: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

module.exports = mongoose.model('SafetySession', safetySessionSchema);