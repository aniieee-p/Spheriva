const mongoose = require('mongoose');
const SOSAlert = require('../models/SOSAlert.model');
const SafetySession = require('../models/SafetySession.model');

const {
  generateLocalEmergencyMessage
} = require('../services/ai.service');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @desc    Create SOS alert
 * @route   POST /api/sos
 * @access  Private
 */
const createSOS = async (req, res) => {
  try {
    const {
      sessionId,
      latitude,
      longitude,
      accuracy,
      clientRequestId,
      situation
    } = req.body || {};

    // Duplicate request protection
    if (clientRequestId) {
      const existingAlert = await SOSAlert.findOne({
        user: req.user._id,
        clientRequestId
      });

      if (existingAlert) {
        return res.status(200).json({
          success: true,
          message: 'SOS alert already exists',
          data: { alert: existingAlert }
        });
      }
    }

    // Validate session if provided
    let session = null;

    if (sessionId) {
      if (!isValidObjectId(sessionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid safety session ID'
        });
      }

      session = await SafetySession.findOne({
        _id: sessionId,
        user: req.user._id,
        status: 'active'
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Active safety session not found'
        });
      }
    }

    // Build location only when coordinates are provided
    const location =
      typeof latitude === 'number' && typeof longitude === 'number'
        ? {
            lat: latitude,
            lng: longitude,
            ...(typeof accuracy === 'number' ? { accuracy } : {})
          }
        : undefined;

    // Generate emergency message
    const userName = req.user.name || 'The user';

    const emergencySituation =
      situation?.trim() || 'User has triggered an SOS alert';

    const locationText =
      typeof latitude === 'number' && typeof longitude === 'number'
        ? `${latitude}, ${longitude}`
        : 'Location unavailable';

    let aiEmergencyMessage;

    try {
      aiEmergencyMessage = generateLocalEmergencyMessage({
        userName,
        situation: emergencySituation,
        location: locationText
      });
    } catch (aiError) {
      console.error('Emergency message generation failed:', aiError);
      aiEmergencyMessage = null;
    }

    // Create SOS alert
    const alert = await SOSAlert.create({
      user: req.user._id,
      session: session ? session._id : null,
      location,
      clientRequestId: clientRequestId || undefined,
      aiEmergencyMessage
    });

    return res.status(201).json({
      success: true,
      message: 'SOS alert created successfully',
      data: { alert }
    });
  } catch (error) {
    // Handles duplicate clientRequestId race condition
    if (error.code === 11000) {
      const existingAlert = await SOSAlert.findOne({
        user: req.user._id,
        clientRequestId: req.body?.clientRequestId
      });

      if (existingAlert) {
        return res.status(200).json({
          success: true,
          message: 'SOS alert already exists',
          data: { alert: existingAlert }
        });
      }
    }

    console.error('Create SOS error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while creating SOS alert'
    });
  }
};

/**
 * @desc    Get active SOS alerts of authenticated user
 * @route   GET /api/sos/active
 * @access  Private
 */
const getActiveSOS = async (req, res) => {
  try {
    const alerts = await SOSAlert.find({
      user: req.user._id,
      status: 'active'
    })
      .populate('session', 'status startedAt latestLocation')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: { alerts }
    });
  } catch (error) {
    console.error('Get active SOS error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving active SOS alerts'
    });
  }
};

/**
 * @desc    Acknowledge SOS alert
 * @route   PATCH /api/sos/:id/acknowledge
 * @access  Private
 */
const acknowledgeSOS = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: 'SOS alert not found'
      });
    }

    const alert = await SOSAlert.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
        status: 'active'
      },
      {
        $set: {
          status: 'acknowledged'
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Active SOS alert not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'SOS alert acknowledged successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Acknowledge SOS error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while acknowledging SOS alert'
    });
  }
};

/**
 * @desc    Resolve SOS alert
 * @route   PATCH /api/sos/:id/resolve
 * @access  Private
 */
const resolveSOS = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: 'SOS alert not found'
      });
    }

    const alert = await SOSAlert.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
        status: { $in: ['active', 'acknowledged'] }
      },
      {
        $set: {
          status: 'resolved',
          resolvedAt: new Date()
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'SOS alert not found or already resolved'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'SOS alert resolved successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Resolve SOS error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while resolving SOS alert'
    });
  }
};

/**
 * @desc    Cancel SOS alert
 * @route   PATCH /api/sos/:id/cancel
 * @access  Private
 */
const cancelSOS = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(404).json({
        success: false,
        message: 'SOS alert not found'
      });
    }

    const alert = await SOSAlert.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
        status: { $in: ['active', 'acknowledged'] }
      },
      {
        $set: {
          status: 'cancelled'
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'SOS alert not found or already closed'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'SOS alert cancelled successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Cancel SOS error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while cancelling SOS alert'
    });
  }
};

module.exports = {
  createSOS,
  getActiveSOS,
  acknowledgeSOS,
  resolveSOS,
  cancelSOS
};