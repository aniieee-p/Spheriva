const mongoose = require('mongoose');
const SafetySession = require('../models/SafetySession.model');

const handleError = (res, error, fallbackMessage) => {
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ success: false, message });
  }
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'A safety session is already active'
    });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const invalidId = (res) =>
  res.status(404).json({ success: false, message: 'Session not found' });

/**
 * @desc    Start a safety session
 * @route   POST /api/sessions
 * @access  Private
 */
const startSession = async (req, res) => {
  try {
    const existing = await SafetySession.findOne({
      user: req.user.id,
      status: 'active'
    }).select('-locations');

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A safety session is already active',
        data: { session: existing }
      });
    }

    const session = await SafetySession.create({ user: req.user.id });

    res.status(201).json({
      success: true,
      message: 'Safety session started',
      data: { session }
    });
  } catch (error) {
    handleError(res, error, 'Server error while starting session');
  }
};

/**
 * @desc    Session history of the logged-in user (latest first)
 * @route   GET /api/sessions
 * @access  Private
 */
const getSessions = async (req, res) => {
  try {
    const sessions = await SafetySession.find({ user: req.user.id })
      .select('-locations')
      .sort({ startedAt: -1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: { sessions }
    });
  } catch (error) {
    handleError(res, error, 'Server error while fetching sessions');
  }
};

/**
 * @desc    Get one session (with location trail)
 * @route   GET /api/sessions/:id
 * @access  Private
 */
const getSession = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

    const session = await SafetySession.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!session) return invalidId(res);

    res.status(200).json({ success: true, data: { session } });
  } catch (error) {
    handleError(res, error, 'Server error while fetching session');
  }
};

/**
 * @desc    Add a location point to an active session
 * @route   POST /api/sessions/:id/location
 * @access  Private
 */
const addLocation = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

    const { lat, lng, accuracy } = req.body || {};

    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: 'lat must be a number between -90 and 90'
      });
    }
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'lng must be a number between -180 and 180'
      });
    }

    const point = { lat, lng, recordedAt: new Date() };
    if (typeof accuracy === 'number') point.accuracy = accuracy;

    const session = await SafetySession.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, status: 'active' },
      { $push: { locations: point }, $set: { lastLocation: point } },
      { new: true }
    ).select('-locations');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Location updated',
      data: { session }
    });
  } catch (error) {
    handleError(res, error, 'Server error while updating location');
  }
};

/**
 * @desc    End a safety session
 * @route   PUT /api/sessions/:id/end
 * @access  Private
 */
const endSession = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

    const session = await SafetySession.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, status: 'active' },
      { $set: { status: 'ended', endedAt: new Date() } },
      { new: true }
    ).select('-locations');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Safety session ended',
      data: { session }
    });
  } catch (error) {
    handleError(res, error, 'Server error while ending session');
  }
};

module.exports = {
  startSession,
  getSessions,
  getSession,
  addLocation,
  endSession
};