const generateEmergencyMessage = async (req, res) => {
  try {
    const {
      situation,
      userName,
      location
    } = req.body || {};

    if (!situation || !situation.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Situation is required'
      });
    }

    const name = userName?.trim() || 'The user';
    const currentLocation = location?.trim() || 'Location unavailable';
    const userSituation = situation.trim();

    const emergencyMessage =
      `Emergency! ${name} may need immediate help. ` +
      `Situation: ${userSituation}. ` +
      `Current location: ${currentLocation}. ` +
      `Please contact them and provide help as soon as possible.`;

    return res.status(200).json({
      success: true,
      message: 'Emergency message generated successfully',
      data: {
        emergencyMessage
      }
    });
  } catch (error) {
    console.error('Emergency message error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to generate emergency message'
    });
  }
};

module.exports = {
  generateEmergencyMessage
};