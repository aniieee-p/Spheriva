/**
 * Location Tracking Service
 * 
 * Wraps react-native-background-geolocation library for Spheriva safety sessions.
 * Handles configuration, lifecycle, and location updates during active sessions.
 * 
 * Key Features:
 * - Battery-efficient motion detection
 * - Foreground service with persistent notification
 * - Offline queue with auto-sync
 * - Session-based authorization
 * - Network failure handling
 */

import BackgroundGeolocation from 'react-native-background-geolocation';
import { Platform, Alert } from 'react-native';
import api from './api';

class LocationTrackingService {
  constructor() {
    this.initialized = false;
    this.currentSessionId = null;
    this.currentSessionToken = null;
    this.locationSubscription = null;
    this.authorizationSubscription = null;
    this.httpSubscription = null;
  }

  /**
   * Initialize the background geolocation service
   * Must be called before starting tracking
   * @param {string} sessionId - Active safety session ID
   * @param {string} sessionToken - Session authorization token
   */
  async initialize(sessionId, sessionToken) {
    if (this.initialized) {
      console.log('[LocationService] Already initialized');
      return;
    }

    console.log('[LocationService] Initializing for session:', sessionId);

    this.currentSessionId = sessionId;
    this.currentSessionToken = sessionToken;

    try {
      // Configure the plugin
      await BackgroundGeolocation.ready({
        // Geolocation Config
        geolocation: {
          // High accuracy for safety tracking
          desiredAccuracy: BackgroundGeolocation.DesiredAccuracy.High,
          
          // Update every 50 meters
          distanceFilter: 50,
          
          // Update interval (milliseconds) - 30 seconds
          locationUpdateInterval: 30000,
          fastestLocationUpdateInterval: 20000,
          
          // Motion detection for battery saving
          // Tracking pauses when stationary, resumes on movement
          stopOnStationary: false,
          
          // Don't automatically detect stops (for continuous tracking)
          stopTimeout: 5, // minutes before detected as stationary
          
          // Request location permission
          locationAuthorizationRequest: 'Always',
          
          // Background location permission rationale (Android 11+)
          backgroundPermissionRationale: {
            title: 'Allow Background Location Access',
            message:
              'Spheriva needs to track your location in the background during safety sessions. ' +
              'This ensures your trusted contacts can see your real-time location even when the app is closed.\n\n' +
              'Please select "Allow all the time" on the next screen.',
            positiveAction: 'Enable',
            negativeAction: 'Cancel',
          },
        },

        // Application Config
        app: {
          // Continue tracking when app terminates
          stopOnTerminate: false,
          
          // Start tracking on device boot (only if session was active)
          startOnBoot: true,
          
          // Prevent OS from suspending tracking
          preventSuspend: true,
          
          // Heartbeat interval for stationary detection (seconds)
          heartbeatInterval: 60,
          
          // Foreground service notification (Android)
          notification: {
            title: 'Spheriva Safety Session Active',
            text: 'Your location is being shared with trusted contacts',
            color: '#FF5733',
            channelName: 'Spheriva Safety Tracking',
            smallIcon: 'mipmap/ic_launcher',
            largeIcon: 'mipmap/ic_launcher',
            priority: BackgroundGeolocation.NotificationPriority.High,
            sticky: true, // Cannot be dismissed by user
          },
        },

        // HTTP / Sync Config
        // Automatically POST locations to backend
        http: {
          url: `${api.defaults.baseURL}/location/${sessionId}`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
          autoSync: true, // Auto-upload queued locations when online
          autoSyncThreshold: 10, // Upload after 10 locations queued
          maxBatchSize: 50, // Max locations per HTTP request
          batchSync: true, // Upload multiple locations in one request
          maxRecordsToPersist: 100, // SQLite cache size
          locationsOrderDirection: 'ASC', // Oldest first
          extras: {
            // Additional data sent with each location
            source: 'mobile_app',
            platform: Platform.OS,
          },
        },

        // Logger Config (disable in production)
        logger: {
          debug: __DEV__,
          logLevel: __DEV__
            ? BackgroundGeolocation.LogLevel.Verbose
            : BackgroundGeolocation.LogLevel.Error,
        },
      });

      // Register event listeners
      this._registerEventListeners();

      this.initialized = true;
      console.log('[LocationService] Initialization complete');
    } catch (error) {
      console.error('[LocationService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register event listeners for location updates and errors
   * @private
   */
  _registerEventListeners() {
    // Location update event
    this.locationSubscription = BackgroundGeolocation.onLocation(
      (location) => {
        console.log('[LocationService] Location received:', {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp,
        });

        // Location is automatically POSTed to backend via HTTP config
        // This event is for logging/debugging only
      },
      (error) => {
        console.error('[LocationService] Location error:', error);
      }
    );

    // Authorization event (permission changes)
    this.authorizationSubscription = BackgroundGeolocation.onProviderChange(
      (event) => {
        console.log('[LocationService] Provider change:', event);

        // Check if location services disabled
        if (!event.enabled) {
          Alert.alert(
            'Location Services Disabled',
            'Please enable location services to continue tracking your safety session.',
            [{ text: 'OK' }]
          );
        }

        // Check if permission revoked
        if (event.status === BackgroundGeolocation.AuthorizationStatus.Denied) {
          Alert.alert(
            'Location Permission Revoked',
            'Spheriva needs location permission to track your safety session.',
            [{ text: 'OK' }]
          );
          this.stopTracking();
        }
      }
    );

    // HTTP event (upload success/failure)
    this.httpSubscription = BackgroundGeolocation.onHttp((response) => {
      const success = response.status >= 200 && response.status < 300;
      
      if (success) {
        console.log('[LocationService] Location uploaded:', response.status);
      } else {
        console.error('[LocationService] Upload failed:', {
          status: response.status,
          response: response.responseText,
        });

        // Handle session expiry or unauthorized
        if (response.status === 401 || response.status === 403) {
          Alert.alert(
            'Session Expired',
            'Your safety session has expired. Please start a new session.',
            [{ text: 'OK' }]
          );
          this.stopTracking();
        }
      }
    });
  }

  /**
   * Start location tracking
   * Must call initialize() first
   */
  async startTracking() {
    if (!this.initialized) {
      throw new Error('LocationService not initialized. Call initialize() first.');
    }

    try {
      console.log('[LocationService] Starting tracking...');
      
      // Start the foreground service and location tracking
      await BackgroundGeolocation.start();
      
      console.log('[LocationService] Tracking started successfully');
      return true;
    } catch (error) {
      console.error('[LocationService] Failed to start tracking:', error);
      
      Alert.alert(
        'Tracking Failed',
        'Could not start location tracking. Please check permissions and try again.',
        [{ text: 'OK' }]
      );
      
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  async stopTracking() {
    try {
      console.log('[LocationService] Stopping tracking...');
      
      // Stop the foreground service and location tracking
      await BackgroundGeolocation.stop();
      
      console.log('[LocationService] Tracking stopped');
      return true;
    } catch (error) {
      console.error('[LocationService] Failed to stop tracking:', error);
      return false;
    }
  }

  /**
   * Change tracking pace (for different urgency levels)
   * @param {string} pace - 'high' | 'medium' | 'low'
   */
  async changePace(pace) {
    const configs = {
      high: {
        distanceFilter: 25,
        locationUpdateInterval: 15000,
      },
      medium: {
        distanceFilter: 50,
        locationUpdateInterval: 30000,
      },
      low: {
        distanceFilter: 100,
        locationUpdateInterval: 60000,
      },
    };

    const config = configs[pace] || configs.medium;

    try {
      await BackgroundGeolocation.setConfig({ geolocation: config });
      console.log('[LocationService] Pace changed to:', pace);
    } catch (error) {
      console.error('[LocationService] Failed to change pace:', error);
    }
  }

  /**
   * Get current location immediately (one-time)
   * @returns {Promise<Object>} Location object
   */
  async getCurrentLocation() {
    try {
      const location = await BackgroundGeolocation.getCurrentPosition({
        timeout: 30, // seconds
        maximumAge: 5000, // milliseconds
        desiredAccuracy: 10, // meters
        samples: 1,
      });

      console.log('[LocationService] Current location:', location);
      return location;
    } catch (error) {
      console.error('[LocationService] Failed to get current location:', error);
      throw error;
    }
  }

  /**
   * Get tracking state
   * @returns {Promise<Object>} State object
   */
  async getState() {
    try {
      const state = await BackgroundGeolocation.getState();
      return {
        enabled: state.enabled,
        isMoving: state.isMoving,
        trackingMode: state.trackingMode,
      };
    } catch (error) {
      console.error('[LocationService] Failed to get state:', error);
      return { enabled: false, isMoving: false, trackingMode: 0 };
    }
  }

  /**
   * Cleanup and reset service
   * Call when session ends
   */
  async cleanup() {
    console.log('[LocationService] Cleaning up...');

    try {
      // Stop tracking if active
      await this.stopTracking();

      // Remove event listeners
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }
      if (this.authorizationSubscription) {
        this.authorizationSubscription.remove();
        this.authorizationSubscription = null;
      }
      if (this.httpSubscription) {
        this.httpSubscription.remove();
        this.httpSubscription = null;
      }

      // Reset state
      this.initialized = false;
      this.currentSessionId = null;
      this.currentSessionToken = null;

      console.log('[LocationService] Cleanup complete');
    } catch (error) {
      console.error('[LocationService] Cleanup error:', error);
    }
  }

  /**
   * Get logs for debugging (development only)
   * @returns {Promise<string>} Log content
   */
  async getLogs() {
    if (!__DEV__) {
      return '';
    }

    try {
      const log = await BackgroundGeolocation.logger.getLog();
      return log;
    } catch (error) {
      console.error('[LocationService] Failed to get logs:', error);
      return '';
    }
  }

  /**
   * Destroy the logger (development only)
   */
  async destroyLogs() {
    if (!__DEV__) {
      return;
    }

    try {
      await BackgroundGeolocation.logger.destroyLog();
      console.log('[LocationService] Logs destroyed');
    } catch (error) {
      console.error('[LocationService] Failed to destroy logs:', error);
    }
  }
}

// Export singleton instance
export default new LocationTrackingService();
