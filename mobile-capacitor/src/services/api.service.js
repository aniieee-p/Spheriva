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

      // Unauthorized - Clear token
      if (status === 401) {
        await storageService.clearAll();
        console.log('Unauthorized - token cleared');
      }

      return Promise.reject({
        status,
        message: data?.message || 'An error occurred',
        errors: data?.errors,
      });
    }

    // Network error
    if (error.request) {
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
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
};

export default apiService;
