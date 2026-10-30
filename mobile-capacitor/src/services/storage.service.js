/**
 * Storage Service
 * Handles secure storage using Capacitor Preferences plugin
 */

import { Preferences } from '@capacitor/preferences';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  REMEMBER_ME: 'remember_me',
};

export const storageService = {
  /**
   * Save authentication token
   */
  saveToken: async (token) => {
    try {
      await Preferences.set({
        key: STORAGE_KEYS.AUTH_TOKEN,
        value: token,
      });
    } catch (error) {
      console.error('Error saving token:', error);
      throw error;
    }
  },

  /**
   * Get authentication token
   */
  getToken: async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.AUTH_TOKEN });
      return value;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  /**
   * Remove authentication token
   */
  removeToken: async () => {
    try {
      await Preferences.remove({ key: STORAGE_KEYS.AUTH_TOKEN });
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },

  /**
   * Save user data
   */
  saveUser: async (userData) => {
    try {
      await Preferences.set({
        key: STORAGE_KEYS.USER_DATA,
        value: JSON.stringify(userData),
      });
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  },

  /**
   * Get user data
   */
  getUser: async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.USER_DATA });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  },

  /**
   * Remove user data
   */
  removeUser: async () => {
    try {
      await Preferences.remove({ key: STORAGE_KEYS.USER_DATA });
    } catch (error) {
      console.error('Error removing user data:', error);
    }
  },

  /**
   * Save remember me preference
   */
  saveRememberMe: async (remember) => {
    try {
      await Preferences.set({
        key: STORAGE_KEYS.REMEMBER_ME,
        value: remember.toString(),
      });
    } catch (error) {
      console.error('Error saving remember me:', error);
    }
  },

  /**
   * Get remember me preference
   */
  getRememberMe: async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.REMEMBER_ME });
      return value === 'true';
    } catch (error) {
      console.error('Error getting remember me:', error);
      return false;
    }
  },

  /**
   * Clear all storage
   */
  clearAll: async () => {
    try {
      await Preferences.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },
};

export default storageService;
