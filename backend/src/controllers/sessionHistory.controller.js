const SafetySession = require('../models/SafetySession.model');

/**
 * @desc    Get the logged-in user's safety sessions, newest first
 * @route   GET /api/sessions?limit=50
 * @access  Private
 */
const getSessionHistory = async (req, res) => {
  try {
    const requested = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(requested) ? 50 : Math.min(Math.max(requested, 1), 100);

    const sessions = await SafetySession.find({ user: req.user.id })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: { sessions }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching safety sessions'
    });
  }
};

module.exports = { getSessionHistory };
