const { StreamClient } = require('@stream-io/node-sdk');

let streamClient = null;

const getStreamClient = () => {
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    const error = new Error('Stream calling is not configured');
    error.status = 503;
    throw error;
  }

  if (!streamClient) {
    streamClient = new StreamClient(apiKey, apiSecret);
  }

  return streamClient;
};

const generateCallingToken = (userId) => {
  if (!userId) {
    throw new Error('Authenticated user ID is required');
  }

  const client = getStreamClient();

  return {
    apiKey: process.env.STREAM_API_KEY,
    token: client.generateUserToken({
      user_id: String(userId),
      validity_in_seconds: 3600,
    }),
  };
};

module.exports = {
  getStreamClient,
  generateCallingToken,
};
