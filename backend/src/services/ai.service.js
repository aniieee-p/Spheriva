const generateLocalEmergencyMessage = ({
  userName,
  situation,
  location
}) => {
  const name = userName?.trim() || 'The user';
  const currentLocation = location?.trim() || 'Location unavailable';
  const userSituation = situation?.trim() || 'Emergency assistance may be required';

  return (
    `Emergency! ${name} may need immediate help. ` +
    `Situation: ${userSituation}. ` +
    `Current location: ${currentLocation}. ` +
    `Please contact them and provide help as soon as possible.`
  );
};

module.exports = {
  generateLocalEmergencyMessage
};