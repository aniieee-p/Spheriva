/**
 * API Service
 * Centralized service for all API calls using Axios
 */

import axios from 'axios';
import { API_CONFIG } from '../config/api.config';
import { storageService } from './storage.service';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
apiClient.interceptors.request.use(
  async (config) => {
    const token = await storageService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle common response scenarios
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Defer auth cleanup so active tracking can be stopped first.
      if (status === 401) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('spheriva:unauthorized'));
        }
      }

      return Promise.reject({
        status,
        message: data?.message || 'An error occurred',
        errors: data?.errors,
      });
    }

    // No response received: timeout or network error
    if (error.request) {
      const timedOut =
        error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '');
      return Promise.reject({
        status: 0,
        code: error.code,
        message: timedOut
          ? 'The server is taking too long to respond. It may be waking up, please try again in a minute.'
          : 'Network error. Please check your connection.',
      });
    }

    return Promise.reject({
      status: -1,
      message: error.message || 'An unexpected error occurred',
    });
  }
);

/**
 * API Service Methods
 */
export const apiService = {
  // ==================== Authentication ====================
  
  register: async (userData) => {
    return await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.REGISTER, userData);
  },

  login: async (credentials) => {
    return await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN, credentials);
  },

  getMe: async () => {
    return await apiClient.get(API_CONFIG.ENDPOINTS.AUTH.ME);
  },

  updateProfile: async (userData) => {
    return await apiClient.put(API_CONFIG.ENDPOINTS.AUTH.UPDATE_PROFILE, userData);
  },

  // ==================== Safety Sessions ====================
  
  createSession: async (sessionData) => {
    return await apiClient.post(API_CONFIG.ENDPOINTS.SESSION.CREATE, sessionData);
  },

  getActiveSession: async () => {
    return await apiClient.get(API_CONFIG.ENDPOINTS.SESSION.ACTIVE);
  },

  updateSessionLocation: async (sessionId, location) => {
    const url = API_CONFIG.ENDPOINTS.SESSION.LOCATION.replace(':id', sessionId);
    return await apiClient.post(url, location);
  },

  getSessions: async () => {
    return await apiClient.get(API_CONFIG.ENDPOINTS.SESSION.GET_ALL);
  },

  getSession: async (sessionId) => {
    const url = API_CONFIG.ENDPOINTS.SESSION.GET_ONE.replace(':id', sessionId);
    return await apiClient.get(url);
  },

  updateSession: async (sessionId, updateData) => {
    const url = API_CONFIG.ENDPOINTS.SESSION.UPDATE.replace(':id', sessionId);
    return await apiClient.put(url, updateData);
  },

  endSession: async (sessionId) => {
    const url = API_CONFIG.ENDPOINTS.SESSION.END.replace(':id', sessionId);
    return await apiClient.post(url);
  },

  // ==================== Emergency & Contacts ====================
  
  sendEmergencyAlert: async (alertData) => {
    return await apiClient.post(API_CONFIG.ENDPOINTS.EMERGENCY.ALERT, alertData);
  },

  getEmergencyContacts: async () => {
    return await apiClient.get(API_CONFIG.ENDPOINTS.EMERGENCY.CONTACTS);
  },

  addEmergencyContact: async (contactData) => {
    return await apiClient.post(API_CONFIG.ENDPOINTS.EMERGENCY.CONTACTS, contactData);
  },

  updateEmergencyContact: async (contactId, contactData) => {
    return await apiClient.put(
      `${API_CONFIG.ENDPOINTS.EMERGENCY.CONTACTS}/${contactId}`,
      contactData
    );
  },

  deleteEmergencyContact: async (contactId) => {
    return await apiClient.delete(
      `${API_CONFIG.ENDPOINTS.EMERGENCY.CONTACTS}/${contactId}`
    );
  },
};

export default apiService;
