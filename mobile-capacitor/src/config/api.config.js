/**
 * API Configuration
 * Central configuration for API base URL and settings
 */

export const API_CONFIG = {
  // Base URL from environment variable with fallback
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  
  // Timeout for requests (ms)
  TIMEOUT: 30000,
  
  // API endpoints
  ENDPOINTS: {
    AUTH: {
      REGISTER: '/auth/register',
      LOGIN: '/auth/login',
      ME: '/auth/me',
      UPDATE_PROFILE: '/auth/profile',
    },
    SESSION: {
      CREATE: '/sessions',
      GET_ALL: '/sessions',
      GET_ONE: '/sessions/:id',
      UPDATE: '/sessions/:id',
      END: '/sessions/:id/end',
    },
    EMERGENCY: {
      ALERT: '/emergency/alert',
      CONTACTS: '/emergency/contacts',
    },
  },
};

export default API_CONFIG;
