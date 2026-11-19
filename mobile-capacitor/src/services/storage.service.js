/**
 * Storage Service
 * Handles secure storage using Capacitor Preferences plugin
 */

import { Preferences } from '@capacitor/preferences';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  REMEMBER_ME: 'remember_me',
  SESSION_CLEANUP: 'safety_session_cleanup',
};

export const storageService = {
  getPendingSessionCleanup: async (userId) => {
    if (!userId) return null;

    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.SESSION_CLEANUP });
      if (!value) return null;

      const pendingByUser = JSON.parse(value);
      return pendingByUser[String(userId)] || null;
    } catch (error) {
      console.error('Error reading pending session cleanup:', error);
      throw error;
    }
  },

  saveSessionTrackingState: async (userId, trackingRecord) => {
    if (!userId || !trackingRecord || typeof trackingRecord !== 'object') {
      throw new Error('User ID and tracking state are required');
    }

    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.SESSION_CLEANUP });
      const pendingByUser = value ? JSON.parse(value) : {};
      pendingByUser[String(userId)] = {
        ...pendingByUser[String(userId)],
        ...trackingRecord,
        userId: String(userId),
      };
      await Preferences.set({
        key: STORAGE_KEYS.SESSION_CLEANUP,
        value: JSON.stringify(pendingByUser),
      });
    } catch (error) {
      console.error('Error saving safety session tracking state:', error);
      throw error;
    }
  },

  savePendingSessionCleanup: async (userId, sessionId) => {
    if (!userId || !sessionId) {
      throw new Error('User ID and session ID are required for pending cleanup');
    }

    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.SESSION_CLEANUP });
      const pendingByUser = value ? JSON.parse(value) : {};
      pendingByUser[String(userId)] = {
        ...pendingByUser[String(userId)],
        userId: String(userId),
        sessionId: String(sessionId),
        lifecycleState: pendingByUser[String(userId)]?.lifecycleState || 'backend_cleanup_pending',
      };
      await Preferences.set({
        key: STORAGE_KEYS.SESSION_CLEANUP,
        value: JSON.stringify(pendingByUser),
      });
    } catch (error) {
      console.error('Error saving pending session cleanup:', error);
      throw error;
    }
  },

  clearPendingSessionCleanup: async (userId, sessionId) => {
    if (!userId || !sessionId) return;

    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.SESSION_CLEANUP });
      if (!value) return;

      const pendingByUser = JSON.parse(value);
      if (pendingByUser[String(userId)]?.sessionId !== String(sessionId)) return;

      delete pendingByUser[String(userId)];
      if (Object.keys(pendingByUser).length === 0) {
        await Preferences.remove({ key: STORAGE_KEYS.SESSION_CLEANUP });
      } else {
        await Preferences.set({
          key: STORAGE_KEYS.SESSION_CLEANUP,
          value: JSON.stringify(pendingByUser),
        });
      }
    } catch (error) {
      console.error('Error clearing pending session cleanup:', error);
      throw error;
    }
  },

  clearSessionTrackingState: async (userId, sessionId, lifecycleState) => {
    if (!userId) return;

    try {
      const { value } = await Preferences.get({ key: STORAGE_KEYS.SESSION_CLEANUP });
      if (!value) return;

      const pendingByUser = JSON.parse(value);
      const record = pendingByUser[String(userId)];
      if (!record) return;
      if (sessionId !== undefined && record.sessionId !== sessionId) return;
      if (lifecycleState && record.lifecycleState !== lifecycleState) return;

      delete pendingByUser[String(userId)];
      if (Object.keys(pendingByUser).length === 0) {
        await Preferences.remove({ key: STORAGE_KEYS.SESSION_CLEANUP });
      } else {
        await Preferences.set({
          key: STORAGE_KEYS.SESSION_CLEANUP,
          value: JSON.stringify(pendingByUser),
        });
      }
    } catch (error) {
      console.error('Error clearing safety session tracking state:', error);
      throw error;
    }
  },

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
      const { value: pendingCleanup } = await Preferences.get({
        key: STORAGE_KEYS.SESSION_CLEANUP,
      });
      await Preferences.clear();
      if (pendingCleanup) {
        await Preferences.set({
          key: STORAGE_KEYS.SESSION_CLEANUP,
          value: pendingCleanup,
        });
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },

  clearAuth: async () => {
    try {
      await Promise.all([
        Preferences.remove({ key: STORAGE_KEYS.AUTH_TOKEN }),
        Preferences.remove({ key: STORAGE_KEYS.USER_DATA }),
        Preferences.remove({ key: STORAGE_KEYS.REMEMBER_ME }),
      ]);
    } catch (error) {
      console.error('Error clearing authentication storage:', error);
      throw error;
    }
  },
};

export default storageService;
