const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  timestamp: {
    type: Date,
    required: true
  }
}, {
  _id: false
});

const safetySessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  endedAt: {
    type: Date,
    default: null
  },
  latestLocation: {
    type: locationSchema,
    default: null
  }
}, {
  timestamps: true,
  autoIndex: false
});

safetySessionSchema.index(
  { user: 1 },
  {
    unique: true,
    name: 'one_active_session_per_user',
    partialFilterExpression: { status: 'active' }
  }
);

module.exports = mongoose.model('SafetySession', safetySessionSchema);
