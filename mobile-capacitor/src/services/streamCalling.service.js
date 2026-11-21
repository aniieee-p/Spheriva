import { StreamVideoClient } from '@stream-io/video-react-sdk';
import { apiService } from './api.service';

export const createStreamCallingClient = async (user) => {
  const userId = user?.id || user?._id;

  if (!userId) {
    throw new Error('Please log in before starting a call.');
  }

  const response = await apiService.getCallingToken();

  if (!response?.success) {
    throw new Error(response?.message || 'Calling service unavailable.');
  }

  const { token, apiKey } = response.data || {};

  if (!token || !apiKey) {
    throw new Error('Calling backend returned incomplete credentials.');
  }

  const tokenProvider = async () => {
    const result = await apiService.getCallingToken();
    const refreshedToken = result?.data?.token;

    if (!result?.success || !refreshedToken) {
      throw new Error('Unable to refresh calling token.');
    }

    return refreshedToken;
  };

  return new StreamVideoClient({
    apiKey,
    user: {
      id: String(userId),
      name: user.name || 'Spheriva User',
    },
    token,
    tokenProvider,
  });
};

export const disconnectStreamCallingClient = async (client) => {
  if (client) {
    await client.disconnectUser();
  }
};
