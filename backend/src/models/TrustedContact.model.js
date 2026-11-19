const mongoose = require('mongoose');

const trustedContactSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please provide a contact name'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Please provide a phone number'],
    trim: true,
    match: [
      /^[6-9]\d{9}$/,
      'Please provide a valid 10-digit Indian phone number'
    ]
  },
  relationship: {
    type: String,
    enum: {
      values: ['Family', 'Friend', 'Parent', 'Sibling', 'Partner', 'Other'],
      message: 'Invalid relationship'
    },
    default: 'Family'
  }
}, {
  timestamps: true
});

// Ek user ke liye same number do baar nahi
trustedContactSchema.index({ user: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model('TrustedContact', trustedContactSchema);
