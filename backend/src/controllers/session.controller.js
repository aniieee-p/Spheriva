const mongoose = require('mongoose');
const SafetySession = require('../models/SafetySession.model');

const isActiveSessionDuplicateKeyError = (error) =>
  error.code === 11000 &&
  error.keyPattern?.user === 1 &&
  Object.keys(error.keyPattern).length === 1 &&
  error.message?.includes('one_active_session_per_user');

const getSessionId = (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(404).json({ success: false, message: 'Safety session not found' });
    return null;
  }

  return id;
};

const respondForMissingActiveSession = async (res, sessionId, userId) => {
  const session = await SafetySession.findOne({ _id: sessionId, user: userId });

  if (!session) {
    res.status(404).json({ success: false, message: 'Safety session not found' });
    return;
  }

  if (session.status !== 'active') {
    res.status(409).json({ success: false, message: 'Safety session has ended' });
    return;
  }

  res.status(404).json({ success: false, message: 'Safety session not found' });
};

const handleError = (res, error, fallbackMessage) => {
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((item) => item.message).join(', ');
    return res.status(400).json({ success: false, message });
  }

  if (error.name === 'CastError') {
    return res.status(404).json({ success: false, message: 'Safety session not found' });
  }

  console.error(error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

/**
 * @desc    Create a safety session for the authenticated user
 * @route   POST /api/sessions
 * @access  Private
 */
const createSession = async (req, res) => {
  try {
    const session = await SafetySession.create({ user: req.user._id });

    return res.status(201).json({
      success: true,
      message: 'Safety session started successfully',
      data: { session }
    });
  } catch (error) {
    if (isActiveSessionDuplicateKeyError(error)) {
      return res.status(409).json({
        success: false,
        message: 'An active safety session already exists for this user'
      });
    }

    return handleError(res, error, 'Server error while creating safety session');
  }
};

/**
 * @desc    Save the latest location for an active session owned by the user
 * @route   POST /api/sessions/:id/location
 * @access  Private
 */
const updateLocation = async (req, res) => {
  const sessionId = getSessionId(req, res);
  if (!sessionId) return;

  const { latitude, longitude } = req.body || {};
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({
      success: false,
      message: 'Latitude must be between -90 and 90 and longitude between -180 and 180'
    });
  }

  try {
    const latestLocation = { latitude, longitude, timestamp: new Date() };
    const session = await SafetySession.findOneAndUpdate(
      { _id: sessionId, user: req.user._id, status: 'active' },
      { $set: { latestLocation } },
      { new: true, runValidators: true }
    );

    if (!session) {
      return await respondForMissingActiveSession(res, sessionId, req.user._id);
    }

    return res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: { session }
    });
  } catch (error) {
    return handleError(res, error, 'Server error while updating location');
  }
};

/**
 * @desc    End an active safety session owned by the user
 * @route   PATCH /api/sessions/:id/end
 * @access  Private
 */
const endSession = async (req, res) => {
  const sessionId = getSessionId(req, res);
  if (!sessionId) return;

  try {
    const session = await SafetySession.findOneAndUpdate(
      { _id: sessionId, user: req.user._id, status: 'active' },
      { $set: { status: 'ended', endedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!session) {
      return await respondForMissingActiveSession(res, sessionId, req.user._id);
    }

    return res.status(200).json({
      success: true,
      message: 'Safety session ended successfully',
      data: { session }
    });
  } catch (error) {
    return handleError(res, error, 'Server error while ending safety session');
  }
};

module.exports = {
  createSession,
  updateLocation,
  endSession
};
