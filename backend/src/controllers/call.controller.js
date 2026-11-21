const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const User = require('../models/User.model');
const TrustedContact = require('../models/TrustedContact.model');
const { generateCallingToken, getStreamClient } = require('../services/stream.service');

// GET /api/calls/token
const getCallingToken = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const { apiKey, token } = generateCallingToken(userId);

    return res.status(200).json({
      success: true,
      message: 'Calling token generated successfully',
      data: {
        apiKey,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};


// POST /api/calls/resolve
const resolveCallingContact = async (req, res, next) => {
  try {
    const { contactId } = req.body || {};

    if (!mongoose.isValidObjectId(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid contact ID is required'
      });
    }

    const contact = await TrustedContact.findOne({
      _id: contactId,
      user: req.user._id
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Trusted contact not found'
      });
    }

    const recipient = await User.findOne({
      phoneNumber: contact.phoneNumber,
      isActive: true
    });

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'This contact is not available for Spheriva calling'
      });
    }

    if (String(recipient._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot call yourself'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Contact resolved successfully',
      data: {
        recipientId: String(recipient._id),
        displayName: contact.name
      }
    });
  } catch (error) {
    next(error);
  }
};


// POST /api/calls
const createCallingSession = async (req, res, next) => {
  try {
    const { contactId, type } = req.body || {};

    if (!['voice', 'video'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Call type must be voice or video'
      });
    }

    if (!mongoose.isValidObjectId(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid contact ID is required'
      });
    }

    const contact = await TrustedContact.findOne({
      _id: contactId,
      user: req.user._id
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Trusted contact not found'
      });
    }

    const recipient = await User.findOne({
      phoneNumber: contact.phoneNumber,
      isActive: true
    });

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient is not registered or active'
      });
    }

    const callerId = String(req.user._id);
    const recipientId = String(recipient._id);

    if (callerId === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot call yourself'
      });
    }

    const callType = type === 'voice' ? 'audio_call' : 'default';
    const callId = randomUUID();

    const client = getStreamClient();
    const call = client.video.call(callType, callId);

    await call.getOrCreate({
      ring: true,
      video: type === 'video',
      data: {
        created_by_id: callerId,
        members: [
          { user_id: callerId },
          { user_id: recipientId }
        ]
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Call initiated',
      data: {
        callId,
        callType,
        type,
        recipientId,
        displayName: contact.name
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCallingToken,
  resolveCallingContact,
  createCallingSession,
};
