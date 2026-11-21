
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');

const User = require('../models/User.model');
const TrustedContact = require('../models/TrustedContact.model');

const {
  generateCallingToken,
  getStreamClient
} = require('../services/stream.service');

// ========================================
// GET /api/calls/token
// Generate Stream authentication token
// ========================================

const getCallingToken = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const { apiKey, token } = generateCallingToken(userId);

    return res.status(200).json({
      success: true,
      message: 'Calling token generated successfully',
      data: {
        apiKey,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// POST /api/calls/resolve
// Find a registered trusted contact
// ========================================

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

// ========================================
// POST /api/calls
// Create a real voice or video call
// ========================================

const createCallingSession = async (req, res, next) => {
  try {
    const { contactId, type } = req.body || {};

    // Validate voice/video type
    if (!['voice', 'video'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Call type must be voice or video'
      });
    }

    // Validate trusted contact ID
    if (!mongoose.isValidObjectId(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid contact ID is required'
      });
    }

    // Find the caller's trusted contact
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

    // Find the registered recipient
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

    // Prevent self calling
    if (callerId === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot call yourself'
      });
    }

    // Select Stream call type
    const callType =
      type === 'voice' ? 'audio_call' : 'default';

    const callId = randomUUID();

    const client = getStreamClient();
    const call = client.video.call(callType, callId);

    // Create a secure ringing call
    await call.getOrCreate({
      ring: true,
      video: type === 'video',

      data: {
        created_by_id: callerId,

        // Authorized call members
        members: [
          {
            user_id: callerId,
            role: 'call_member'
          },
          {
            user_id: recipientId,
            role: 'call_member'
          }
        ],

        // 45-second ringing timeout
        settings_override: {
          ring: {
            incoming_call_timeout_ms: 45000,
            auto_cancel_timeout_ms: 45000,
            missed_call_timeout_ms: 48000
          }
        }
      }
    });

    // Return call information to frontend
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

// ========================================
// POST /api/calls/end
// End real call for all participants
// ========================================

const endCallingSession = async (req, res, next) => {
  try {
    const { callId, callType } = req.body || {};

    // Validate server-generated UUID
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      typeof callId !== 'string' ||
      !uuidPattern.test(callId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid call ID is required'
      });
    }

    // Validate Stream call type
    if (!['default', 'audio_call'].includes(callType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid call type'
      });
    }

    // Authenticated user requesting to end the call
    const userId = String(req.user._id);

    const client = getStreamClient();
    const call = client.video.call(callType, callId);

    // Verify membership directly with Stream
    // A user can end only a call they belong to
    const result = await call.queryMembers({
      filter_conditions: {
        user_id: { $eq: userId }
      },
      limit: 1
    });

    const isAuthorized = result.members?.some(
      (member) => String(member.user_id) === userId
    );

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to end this call'
      });
    }

    // Terminate the Stream call for everyone
    await call.end();

    return res.status(200).json({
      success: true,
      message: 'Call ended for all participants'
    });

  } catch (error) {
    next(error);
  }
};

// ========================================
// Export controllers
// ========================================

module.exports = {
  getCallingToken,
  resolveCallingContact,
  createCallingSession,
  endCallingSession
};
