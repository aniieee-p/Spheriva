/**
 * Location Permission Utility
 * 
 * Handles Android location permission requests following Google Play policies:
 * - Request foreground location first (FINE + COARSE)
 * - Only request background location after user grants foreground
 * - Show clear rationale explaining why permissions are needed
 * - Handle permission denials gracefully
 */

import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { PERMISSIONS, request, check, RESULTS, openSettings } from 'react-native-permissions';

/**
 * Check if location permissions are granted
 * @returns {Promise<{foreground: boolean, background: boolean}>}
 */
export const checkLocationPermissions = async () => {
  if (Platform.OS !== 'android') {
    return { foreground: false, background: false };
  }

  try {
    const fineLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    
    const coarseLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
    );

    // Check background location (Android 10+)
    let backgroundLocation = false;
    if (Platform.Version >= 29) {
      backgroundLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      );
    } else {
      // Background location included in foreground on Android < 10
      backgroundLocation = fineLocation && coarseLocation;
    }

    return {
      foreground: fineLocation && coarseLocation,
      background: backgroundLocation,
    };
  } catch (error) {
    console.error('[Permissions] Check failed:', error);
    return { foreground: false, background: false };
  }
};

/**
 * Request foreground location permissions (FINE + COARSE)
 * Step 1 of the permission flow
 * @returns {Promise<boolean>} true if granted
 */
export const requestForegroundLocationPermission = async () => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const granted =
      result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
      result['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;

    if (!granted) {
      console.warn('[Permissions] Foreground location denied');
    }

    return granted;
  } catch (error) {
    console.error('[Permissions] Foreground request failed:', error);
    return false;
  }
};

/**
 * Request background location permission (Android 10+)
 * Step 2 of the permission flow - only call after foreground is granted
 * @param {Object} options - Rationale options
 * @param {string} options.title - Dialog title
 * @param {string} options.message - Dialog message explaining why background access is needed
 * @returns {Promise<boolean>} true if granted
 */
export const requestBackgroundLocationPermission = async (options = {}) => {
  if (Platform.OS !== 'android') {
    return false;
  }

  // Background permission only exists on Android 10+
  if (Platform.Version < 29) {
    console.log('[Permissions] Background location included in foreground on Android < 10');
    return true;
  }

  // Check if foreground permission is already granted
  const { foreground } = await checkLocationPermissions();
  if (!foreground) {
    console.error('[Permissions] Cannot request background without foreground permission');
    return false;
  }

  const {
    title = 'Background Location Required',
    message = 'Spheriva needs to access your location in the background to track your safety session when the app is closed or screen is locked. This ensures your trusted contacts can see your location during active sessions.\n\nPlease select "Allow all the time" on the next screen.',
  } = options;

  return new Promise((resolve) => {
    // Show rationale dialog before requesting (Google Play requirement)
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            console.log('[Permissions] Background permission cancelled by user');
            resolve(false);
          },
        },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              // Android 11+ removed "Allow all the time" from initial dialog
              // User must enable it in settings
              const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
              );

              const granted = result === PermissionsAndroid.RESULTS.GRANTED;
              
              if (!granted && Platform.Version >= 30) {
                // Android 11+ - guide user to settings
                Alert.alert(
                  'Enable Background Location',
                  'Please select "Allow all the time" in Location permissions to enable background tracking.',
                  [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    {
                      text: 'Open Settings',
                      onPress: async () => {
                        await openSettings();
                        // Cannot detect when user returns from settings
                        // App will re-check permissions when session starts
                        resolve(false);
                      },
                    },
                  ]
                );
              } else {
                resolve(granted);
              }
            } catch (error) {
              console.error('[Permissions] Background request failed:', error);
              resolve(false);
            }
          },
        },
      ],
      { cancelable: false }
    );
  });
};

/**
 * Request notification permission (Android 13+)
 * Required for foreground service notification
 * @returns {Promise<boolean>} true if granted
 */
export const requestNotificationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true; // iOS handles differently
  }

  // POST_NOTIFICATIONS only required on Android 13+
  if (Platform.Version < 33) {
    return true;
  }

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );

    const granted = result === PermissionsAndroid.RESULTS.GRANTED;
    
    if (!granted) {
      console.warn('[Permissions] Notification permission denied - user may not see tracking notification');
    }

    return granted;
  } catch (error) {
    console.error('[Permissions] Notification request failed:', error);
    return false;
  }
};

/**
 * Complete permission flow for safety session
 * 1. Request notification permission (Android 13+)
 * 2. Request foreground location
 * 3. Request background location with rationale
 * 
 * @returns {Promise<{success: boolean, foreground: boolean, background: boolean}>}
 */
export const requestSafetySessionPermissions = async () => {
  console.log('[Permissions] Starting safety session permission flow');

  // Step 1: Notification permission (non-blocking)
  const notificationGranted = await requestNotificationPermission();
  if (!notificationGranted && Platform.Version >= 33) {
    console.warn('[Permissions] Notification denied - proceeding anyway');
  }

  // Step 2: Foreground location (required)
  const foregroundGranted = await requestForegroundLocationPermission();
  if (!foregroundGranted) {
    Alert.alert(
      'Location Permission Required',
      'Spheriva needs location access to track your safety session. Please enable location permissions in settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => openSettings() },
      ]
    );
    return { success: false, foreground: false, background: false };
  }

  // Step 3: Background location (required for background tracking)
  const backgroundGranted = await requestBackgroundLocationPermission({
    title: 'Enable Background Tracking',
    message:
      'For your safety, Spheriva needs to track your location when the app is in the background.\n\n' +
      'This allows your trusted contacts to see your real-time location during active safety sessions, ' +
      'even when your phone is locked or you switch to another app.\n\n' +
      'Please select "Allow all the time" on the next screen.',
  });

  if (!backgroundGranted) {
    Alert.alert(
      'Limited Functionality',
      'Without background location access, tracking will only work when the app is open. ' +
      'You can enable "Allow all the time" in Settings > Apps > Spheriva > Permissions > Location.',
      [{ text: 'OK' }]
    );
  }

  return {
    success: foregroundGranted, // Session can start with just foreground
    foreground: foregroundGranted,
    background: backgroundGranted,
  };
};

/**
 * Check if location services are enabled on device
 * @returns {Promise<boolean>}
 */
export const isLocationEnabled = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // This checks if GPS/location services are enabled
    // Not the same as permission checks
    const enabled = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return enabled;
  } catch (error) {
    console.error('[Permissions] Location services check failed:', error);
    return false;
  }
};

/**
 * Show alert prompting user to enable location services
 */
export const promptEnableLocationServices = () => {
  Alert.alert(
    'Location Services Disabled',
    'Please enable Location Services in your device settings to use safety tracking features.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          // Open location settings
          if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
          }
        },
      },
    ]
  );
};
