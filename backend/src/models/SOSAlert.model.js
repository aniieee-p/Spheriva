const mongoose = require('mongoose');
const crypto = require('crypto');

const acknowledgementSchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'TrustedContact' },
  name: { type: String, trim: true, maxlength: 50 },
  acknowledgedAt: { type: Date, default: Date.now }
}, { _id: false });

const sosAlertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SafetySession',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'cancelled'],
    default: 'active'
  },
  // GPS na mile tab bhi SOS ban sakta hai, isliye lat/lng optional hain
  location: {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    accuracy: { type: Number }
  },
  // Mobile har SOS ke saath ek unique id bhejega, retry par duplicate alert na bane
  clientRequestId: { type: String, trim: true, maxlength: 100 },
  // Trusted contact ko dashboard link isi token se milta hai
  aiEmergencyMessage: {
  type: String,
  trim: true,
  maxlength: 500
},
  shareToken: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(24).toString('hex')
  },
  acknowledgements: [acknowledgementSchema],
  resolvedAt: { type: Date }
}, {
  timestamps: true
});

// Ek user ki same clientRequestId do baar nahi (duplicate/retry protection)
sosAlertSchema.index(
  { user: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } }
);

module.exports = mongoose.model('SOSAlert', sosAlertSchema);