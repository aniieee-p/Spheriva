
/**
 * Permission Management Utility for Spheriva Mobile (Capacitor)
 *
 * Handles foreground/background location permissions and notification permissions
 * with strict verification coordinated with the tracking service.
 *
 * Three-layer state model:
 * 1. System Permissions - verifiable via Capacitor APIs
 * 2. Historical Capability - past test results (persisted)
 * 3. Current Session Status - coordinated with active tracking service
 */

import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';

// ============================================================================
// CONSTANTS
// ============================================================================

export const PermissionState = {
  GRANTED: 'granted',
  DENIED: 'denied',
  PROMPT: 'prompt',
  PROMPT_WITH_RATIONALE: 'prompt-with-rationale',
  RESTRICTED: 'restricted',
  UNKNOWN: 'unknown'
};

export const LocationAccuracy = {
  PRECISE: 'precise',
  APPROXIMATE: 'approximate',
  UNKNOWN: 'unknown'
};

export const BackgroundTrackingCapability = {
  NOT_TESTED: 'not_tested',
  VERIFIED_WORKING: 'verified_working',
  FAILED: 'failed'
};

export const SessionTrackingStatus = {
  NOT_STARTED: 'not_started',
  WATCHER_REGISTERED: 'watcher_registered',
  FOREGROUND_VERIFIED: 'foreground_verified',
  BACKGROUND_VERIFIED: 'background_verified',
  FAILED: 'failed'
};

const SESSION_GAP_THRESHOLD_MS = 5 * 60 * 1000;

const TIMESTAMP_VALIDATION = {
  MAX_FUTURE_MS: 60000,
  MAX_STALE_MS: 3600000,
  RECEIPT_MAX_AGE_MS: 120000,
  MIN_UPDATE_INTERVAL_MS: 10000,
  MAX_UPDATE_INTERVAL_MS: 180000
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const sessionState = {
  currentSessionStatus: SessionTrackingStatus.NOT_STARTED,

  activeWatcher: {
    watcherId: null,
    sessionId: null,
    registeredAt: null
  },

  appState: {
    isActive: null,
    lastChange: Date.now(),
    version: 0
  },

  backgroundedAt: null,
  lastForegroundUpdate: null,
  lastBackgroundUpdate: null,
  backgroundUpdateCount: 0,

  lastSessionId: null,

  initializationInProgress: false,
  initializationPromise: null,
  initializationVersion: 0,
  listenerGeneration: 0,

  appStateListener: null
};

const STORAGE_KEYS = {
  BACKGROUND_CAPABILITY: 'spheriva_background_capability',
  LAST_CAPABILITY_TEST: 'spheriva_last_capability_test'
};

// ============================================================================
// TIMESTAMP VALIDATION
// ============================================================================

function safeParseTimestamp(storedValue, context = 'unknown') {
  if (!storedValue) {
    return null;
  }

  if (typeof storedValue !== 'string' || !/^\d+$/.test(storedValue)) {
    console.warn(`Invalid timestamp in ${context}: not a valid decimal integer string`);
    return null;
  }

  try {
    const parsed = Number(storedValue);

    if (!Number.isSafeInteger(parsed)) {
      console.warn(`Invalid timestamp in ${context}: not a safe integer`);
      return null;
    }

    const MIN_VALID_TIMESTAMP = 1577836800000;
    const MAX_VALID_TIMESTAMP = 4102444800000;

    if (parsed < MIN_VALID_TIMESTAMP || parsed > MAX_VALID_TIMESTAMP) {
      console.warn(`Invalid timestamp in ${context}: out of reasonable range (${parsed})`);
      return null;
    }

    const now = Date.now();

    if (parsed > now + TIMESTAMP_VALIDATION.MAX_FUTURE_MS) {
      console.warn(`Invalid timestamp in ${context}: too far in future (${parsed} vs now ${now})`);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error(`Error parsing timestamp in ${context}:`, error);
    return null;
  }
}

function validateTimestamps(timestamp, receiptTime, context) {
  const now = Date.now();

  if (timestamp > now + TIMESTAMP_VALIDATION.MAX_FUTURE_MS) {
    return {
      valid: false,
      reason: 'future_timestamp',
      timestamp,
      now,
      difference: timestamp - now
    };
  }

  if (timestamp < now - TIMESTAMP_VALIDATION.MAX_STALE_MS) {
    return {
      valid: false,
      reason: 'stale_timestamp',
      timestamp,
      now,
      age: now - timestamp
    };
  }

  if (receiptTime > now + TIMESTAMP_VALIDATION.MAX_FUTURE_MS) {
    return {
      valid: false,
      reason: 'future_receipt_time',
      receiptTime,
      now,
      note: 'Receipt timestamp is in the future - clock skew detected'
    };
  }

  if (receiptTime < now - TIMESTAMP_VALIDATION.RECEIPT_MAX_AGE_MS) {
    return {
      valid: false,
      reason: 'stale_receipt',
      receiptTime,
      now,
      age: now - receiptTime,
      note: 'Update received too long ago to be considered current'
    };
  }

  if (timestamp > receiptTime) {
    return {
      valid: false,
      reason: 'timestamp_after_receipt',
      timestamp,
      receiptTime,
      note: 'Event timestamp cannot be after we received it'
    };
  }

  return { valid: true };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize permission manager.
 *
 * Concurrent callers share one Promise.
 * Cleanup invalidates pending initialization attempts using listenerGeneration.
 */
export async function initializePermissionManager() {
  // Already initialized successfully
  if (sessionState.appStateListener && !sessionState.initializationInProgress) {
    return {
      success: true,
      alreadyInitialized: true,
      appState: { ...sessionState.appState },
      listenerGeneration: sessionState.listenerGeneration
    };
  }

  // Share the same Promise between concurrent callers
  if (sessionState.initializationPromise) {
    console.log('Initialization in progress - awaiting existing attempt');
    return await sessionState.initializationPromise;
  }

  // Start a new initialization attempt
  sessionState.initializationInProgress = true;
  sessionState.initializationVersion++;

  // Create generation immediately so cleanup can invalidate this attempt
  sessionState.listenerGeneration++;
  const listenerGeneration = sessionState.listenerGeneration;

  let initPromise;

  initPromise = (async () => {
    try {
      // Remove any previously registered listener
      if (sessionState.appStateListener) {
        const previousListener = sessionState.appStateListener;
        sessionState.appStateListener = null;

        try {
          await previousListener.remove();
        } catch (removeError) {
          console.warn('Failed to remove previous listener:', removeError);
        }
      }

      // Check whether cleanup invalidated this initialization
      if (sessionState.listenerGeneration !== listenerGeneration) {
        return {
          success: false,
          reason: 'initialization_cancelled',
          note: 'Initialization was invalidated by cleanup'
        };
      }

      const versionBeforeListener = sessionState.appState.version;

      // Register listener before fetching current app state
      let listener;

      try {
        listener = await App.addListener('appStateChange', (state) => {
          if (sessionState.listenerGeneration !== listenerGeneration) {
            console.warn('Stale appStateChange callback ignored');
            return;
          }

          const wasActive = sessionState.appState.isActive;

          sessionState.appState.isActive = state.isActive;
          sessionState.appState.lastChange = Date.now();
          sessionState.appState.version++;

          if (state.isActive && !wasActive) {
            sessionState.backgroundedAt = null;
          } else if (!state.isActive && wasActive) {
            sessionState.backgroundedAt = Date.now();
          }
        });
      } catch (listenerError) {
        if (sessionState.listenerGeneration === listenerGeneration) {
          sessionState.listenerGeneration++;
          sessionState.appState.isActive = null;
          sessionState.backgroundedAt = null;
          sessionState.appState.lastChange = Date.now();
          sessionState.appState.version++;
        }

        console.error('Failed to register appStateChange listener:', listenerError);

        return {
          success: false,
          reason: 'listener_registration_failed',
          error: listenerError.message,
          note: 'App state restored to UNKNOWN - listener could not be registered'
        };
      }

      // Cleanup may have happened while addListener() was pending
      if (sessionState.listenerGeneration !== listenerGeneration) {
        try {
          await listener.remove();
        } catch (removeError) {
          console.warn('Failed to remove invalidated listener:', removeError);
        }

        return {
          success: false,
          reason: 'initialization_cancelled',
          note: 'Cleanup invalidated initialization during listener registration'
        };
      }

      // Retain the listener only if this initialization is still valid
      sessionState.appStateListener = listener;

      // Fetch current app state
      let currentState;

      try {
        currentState = await App.getState();
      } catch (getStateError) {
        if (sessionState.listenerGeneration === listenerGeneration) {
          sessionState.listenerGeneration++;
          sessionState.appState.isActive = null;
          sessionState.backgroundedAt = null;
          sessionState.appState.lastChange = Date.now();
          sessionState.appState.version++;
        }

        if (sessionState.appStateListener === listener) {
          sessionState.appStateListener = null;
        }

        try {
          await listener.remove();
        } catch (removeError) {
          console.warn('Failed to remove listener after getState failure:', removeError);
        }

        console.error('Failed to get current app state:', getStateError);

        return {
          success: false,
          reason: 'get_state_failed',
          error: getStateError.message,
          note: 'Listener removed and app state restored to UNKNOWN'
        };
      }

      // Cleanup may have happened while App.getState() was pending
      if (sessionState.listenerGeneration !== listenerGeneration) {
        if (sessionState.appStateListener === listener) {
          sessionState.appStateListener = null;
        }

        try {
          await listener.remove();
        } catch (removeError) {
          console.warn('Failed to remove invalidated listener:', removeError);
        }

        return {
          success: false,
          reason: 'initialization_cancelled',
          note: 'Cleanup invalidated initialization while fetching app state'
        };
      }

      // Apply fetched state only if no listener update occurred meanwhile
      if (sessionState.appState.version === versionBeforeListener) {
        sessionState.appState.isActive = currentState.isActive;
        sessionState.appState.lastChange = Date.now();
        sessionState.appState.version++;

        if (!currentState.isActive) {
          sessionState.backgroundedAt = Date.now();
        }
      } else {
        console.info('Listener already updated app state - using listener value');
      }

      return {
        success: true,
        appState: { ...sessionState.appState },
        listenerGeneration
      };

    } catch (error) {
      console.error('Unexpected error during initialization:', error);

      if (sessionState.listenerGeneration === listenerGeneration) {
        sessionState.listenerGeneration++;
      }

      const listener = sessionState.appStateListener;
      sessionState.appStateListener = null;

      if (listener) {
        try {
          await listener.remove();
        } catch (removeError) {
          console.warn('Failed to remove listener after unexpected error:', removeError);
        }
      }

      sessionState.appState.isActive = null;
      sessionState.backgroundedAt = null;
      sessionState.appState.lastChange = Date.now();
      sessionState.appState.version++;

      return {
        success: false,
        reason: 'unexpected_error',
        error: error.message,
        note: 'App state restored to UNKNOWN after unexpected initialization error'
      };

    } finally {
      sessionState.initializationInProgress = false;

      // Clear only this attempt's Promise
      if (sessionState.initializationPromise === initPromise) {
        sessionState.initializationPromise = null;
      }
    }
  })();

  sessionState.initializationPromise = initPromise;

  return await initPromise;
}

/**
 * Clean up permission manager resources.
 *
 * Always invalidates pending callbacks and initialization attempts.
 */
export async function cleanupPermissionManager() {
  // Always invalidate pending initialization and listener callbacks
  sessionState.listenerGeneration++;

  // Detach listener before attempting removal
  const listener = sessionState.appStateListener;
  sessionState.appStateListener = null;

  let removalSucceeded = true;

  if (listener) {
    try {
      await listener.remove();
    } catch (removeError) {
      removalSucceeded = false;
      console.warn(
        'Failed to remove app state listener during cleanup:',
        removeError
      );
    }
  }

  // Do not clear an initialization Promise while it is still running.
  // Its finally block will clear its own Promise when it finishes.
  if (!sessionState.initializationInProgress) {
    sessionState.initializationPromise = null;
  }

  return {
    success: true,
    listenerRemoved: Boolean(listener) && removalSucceeded,
    initializationPending: sessionState.initializationInProgress
  };
}

// ============================================================================
// PERMISSION STATUS QUERIES
// ============================================================================

export async function getForegroundLocationStatus() {
  try {
    const result = await Geolocation.checkPermissions();

    let accuracy = LocationAccuracy.UNKNOWN;

    if (
      result.location === PermissionState.GRANTED &&
      result.coarseLocation === PermissionState.GRANTED
    ) {
      accuracy = LocationAccuracy.PRECISE;
    } else if (
      result.location === PermissionState.DENIED &&
      result.coarseLocation === PermissionState.GRANTED
    ) {
      accuracy = LocationAccuracy.APPROXIMATE;
    }

    return {
      permission: result.location,
      coarseLocation: result.coarseLocation,
      accuracy,
      canUseLocation:
        result.location === PermissionState.GRANTED ||
        result.coarseLocation === PermissionState.GRANTED
    };
  } catch (error) {
    console.error('Failed to check foreground location status:', error);

    return {
      permission: PermissionState.UNKNOWN,
      coarseLocation: PermissionState.UNKNOWN,
      accuracy: LocationAccuracy.UNKNOWN,
      canUseLocation: false,
      error: error.message
    };
  }
}

export async function getBackgroundLocationStatus() {
  return {
    permission: PermissionState.UNKNOWN,
    note: 'Background location permission cannot be checked programmatically',
    historicalCapability: await getBackgroundCapabilityStatus()
  };
}

export async function getBackgroundCapabilityStatus() {
  try {
    const capability =
      localStorage.getItem(STORAGE_KEYS.BACKGROUND_CAPABILITY) ||
      BackgroundTrackingCapability.NOT_TESTED;

    const lastTestRaw = localStorage.getItem(STORAGE_KEYS.LAST_CAPABILITY_TEST);
    const lastTest = safeParseTimestamp(lastTestRaw, 'background_capability_test');

    return {
      capability,
      lastTestedAt: lastTest,
      note: 'Historical test result - not current session status'
    };
  } catch (error) {
    return {
      capability: BackgroundTrackingCapability.NOT_TESTED,
      lastTestedAt: null,
      error: error.message
    };
  }
}

export function getCurrentSessionStatus() {
  return {
    status: sessionState.currentSessionStatus,
    watcher: { ...sessionState.activeWatcher },
    appState: { ...sessionState.appState },
    backgroundedAt: sessionState.backgroundedAt,
    lastForegroundUpdate: sessionState.lastForegroundUpdate
  };
}

export async function getNotificationStatus() {
  return {
    permission: PermissionState.UNKNOWN,
    note: 'Notification permissions cannot be checked programmatically. User must verify in system settings.',
    guidance: 'Check Settings → Apps → Spheriva → Notifications'
  };
}

export async function getAllPermissionStatus() {
  const [foreground, background, notifications] = await Promise.all([
    getForegroundLocationStatus(),
    getBackgroundLocationStatus(),
    getNotificationStatus()
  ]);

  return {
    foreground,
    background,
    notifications,
    currentSession: getCurrentSessionStatus(),
    timestamp: Date.now()
  };
}

// ============================================================================
// PERMISSION REQUESTS
// ============================================================================

export async function requestForegroundLocation() {
  try {
    const result = await Geolocation.requestPermissions({
      permissions: ['location']
    });

    let accuracy = LocationAccuracy.UNKNOWN;

    if (
      result.location === PermissionState.GRANTED &&
      result.coarseLocation === PermissionState.GRANTED
    ) {
      accuracy = LocationAccuracy.PRECISE;
    } else if (
      result.location === PermissionState.DENIED &&
      result.coarseLocation === PermissionState.GRANTED
    ) {
      accuracy = LocationAccuracy.APPROXIMATE;
    }

    return {
      success:
        result.location === PermissionState.GRANTED ||
        result.coarseLocation === PermissionState.GRANTED,
      permission: result.location,
      coarseLocation: result.coarseLocation,
      accuracy,
      needsSettings:
        result.location === PermissionState.DENIED &&
        result.coarseLocation === PermissionState.DENIED
    };
  } catch (error) {
    console.error('Failed to request foreground location:', error);

    return {
      success: false,
      permission: PermissionState.UNKNOWN,
      error: error.message
    };
  }
}

export async function requestNotificationPermission() {
  return {
    success: false,
    note: 'Notification permissions must be configured in system settings',
    guidance: 'Please enable notifications in Settings → Apps → Spheriva → Notifications',
    action: 'open_settings_required'
  };
}

export async function openAppSettings() {
  try {
    await BackgroundGeolocation.openSettings();

    return {
      success: true,
      note: 'Settings opened - user must manually configure permissions'
    };
  } catch (error) {
    console.error('Failed to open settings:', error);

    return {
      success: false,
      error: error.message
    };
  }
}

export async function requestSafetySessionPermissions() {
  const foregroundResult = await requestForegroundLocation();

  const capabilityStatus = await getBackgroundCapabilityStatus();

  const backgroundGuidance = {
    status: 'requires_manual_setup',
    note: 'Background location must be configured in system settings',
    guidance: 'Settings → Apps → Spheriva → Permissions → Location → Allow all the time',
    historicalCapability: capabilityStatus
  };

  const notificationGuidance = await requestNotificationPermission();

  const needsSettings =
    foregroundResult.needsSettings ||
    capabilityStatus.capability === BackgroundTrackingCapability.FAILED;

  return {
    foreground: foregroundResult,
    background: backgroundGuidance,
    notifications: notificationGuidance,
    needsSettings,
    readyToStart:
      foregroundResult.success &&
      capabilityStatus.capability === BackgroundTrackingCapability.VERIFIED_WORKING,
    note: needsSettings
      ? 'User must configure permissions in system settings'
      : null
  };
}

// ============================================================================
// TRACKING SERVICE COORDINATION
// ============================================================================

export function notifySessionStarted(sessionId, watcherId) {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    return {
      success: false,
      reason: 'invalid_session_id',
      note: 'Session ID must be a non-empty string'
    };
  }

  if (!watcherId || typeof watcherId !== 'string' || watcherId.trim() === '') {
    return {
      success: false,
      reason: 'invalid_watcher_id',
      note: 'Watcher ID must be a non-empty string returned from BackgroundGeolocation.addWatcher()'
    };
  }

  const trimmedSessionId = sessionId.trim();
  const trimmedWatcherId = watcherId.trim();

  if (
    sessionState.activeWatcher.watcherId &&
    sessionState.activeWatcher.watcherId !== trimmedWatcherId
  ) {
    console.warn('Session started with new watcher while previous watcher still active');
  }

  const isDifferentSession =
    sessionState.lastSessionId !== null &&
    sessionState.lastSessionId !== trimmedSessionId;

  const isSameSession = sessionState.lastSessionId === trimmedSessionId;

  let preservedForegroundUpdate = null;

  if (isSameSession && sessionState.lastForegroundUpdate !== null) {
    const now = Date.now();
    const gap = now - sessionState.lastForegroundUpdate;

    if (gap <= SESSION_GAP_THRESHOLD_MS) {
      preservedForegroundUpdate = sessionState.lastForegroundUpdate;
    }
  }

  sessionState.activeWatcher = {
    watcherId: trimmedWatcherId,
    sessionId: trimmedSessionId,
    registeredAt: Date.now()
  };

  sessionState.lastSessionId = trimmedSessionId;

  sessionState.currentSessionStatus = SessionTrackingStatus.WATCHER_REGISTERED;

  if (isDifferentSession) {
    sessionState.lastForegroundUpdate = null;
  } else if (isSameSession) {
    sessionState.lastForegroundUpdate = preservedForegroundUpdate;
  } else {
    sessionState.lastForegroundUpdate = null;
  }

  sessionState.backgroundedAt = null;
  sessionState.lastBackgroundUpdate = null;
  sessionState.backgroundUpdateCount = 0;

  return {
    success: true,
    status: sessionState.currentSessionStatus,
    watcher: { ...sessionState.activeWatcher },
    appState: { ...sessionState.appState }
  };
}

export function recordForegroundUpdate(timestamp) {
  const receiptTime = Date.now();

  if (!sessionState.activeWatcher.watcherId) {
    return {
      success: false,
      reason: 'no_active_watcher',
      note: 'Session not started or watcher not registered'
    };
  }

  if (sessionState.activeWatcher.sessionId !== sessionState.lastSessionId) {
    return {
      success: false,
      reason: 'session_mismatch',
      note: 'Update from stale or mismatched session - current session does not match last registered session'
    };
  }

  const validation = validateTimestamps(
    timestamp,
    receiptTime,
    'foreground_update'
  );

  if (!validation.valid) {
    return {
      success: false,
      ...validation
    };
  }

  if (
    sessionState.lastForegroundUpdate !== null &&
    timestamp <= sessionState.lastForegroundUpdate
  ) {
    return {
      success: false,
      reason: 'out_of_order_timestamp',
      timestamp,
      lastAccepted: sessionState.lastForegroundUpdate,
      note: 'Timestamp is older than or equal to previously accepted foreground update'
    };
  }

  sessionState.lastForegroundUpdate = timestamp;

  if (
    sessionState.currentSessionStatus === SessionTrackingStatus.WATCHER_REGISTERED
  ) {
    sessionState.currentSessionStatus =
      SessionTrackingStatus.FOREGROUND_VERIFIED;
  }

  return {
    success: true,
    status: sessionState.currentSessionStatus,
    timestamp,
    watcher: { ...sessionState.activeWatcher }
  };
}

export function recordBackgroundUpdate(timestamp) {
  const receiptTime = Date.now();

  if (!sessionState.activeWatcher.watcherId) {
    return {
      success: false,
      reason: 'no_active_watcher',
      note: 'Session not started or watcher not registered'
    };
  }

  if (sessionState.activeWatcher.sessionId !== sessionState.lastSessionId) {
    return {
      success: false,
      reason: 'session_mismatch',
      note: 'Update from stale or mismatched session - current session does not match last registered session'
    };
  }

  if (sessionState.appState.isActive !== false) {
    return {
      success: false,
      reason: 'app_not_backgrounded',
      appCurrentlyActive: sessionState.appState.isActive,
      timestamp
    };
  }

  const validation = validateTimestamps(
    timestamp,
    receiptTime,
    'background_update'
  );

  if (!validation.valid) {
    return {
      success: false,
      ...validation
    };
  }

  if (
    sessionState.lastForegroundUpdate &&
    timestamp <= sessionState.lastForegroundUpdate
  ) {
    return {
      success: false,
      reason: 'out_of_order',
      timestamp,
      lastForegroundUpdate: sessionState.lastForegroundUpdate,
      note: 'Background update must be strictly after last foreground update'
    };
  }

  if (sessionState.lastBackgroundUpdate !== null) {
    const gap = timestamp - sessionState.lastBackgroundUpdate;

    if (gap < TIMESTAMP_VALIDATION.MIN_UPDATE_INTERVAL_MS) {
      return {
        success: false,
        reason: 'update_too_frequent',
        timestamp,
        lastBackgroundUpdate: sessionState.lastBackgroundUpdate,
        gap,
        minimumInterval: TIMESTAMP_VALIDATION.MIN_UPDATE_INTERVAL_MS,
        note: 'Background updates must be at least 10 seconds apart'
      };
    }

    if (gap > TIMESTAMP_VALIDATION.MAX_UPDATE_INTERVAL_MS) {
      const previousTimestamp = sessionState.lastBackgroundUpdate;

      sessionState.backgroundedAt = timestamp;
      sessionState.lastBackgroundUpdate = timestamp;
      sessionState.backgroundUpdateCount = 0;

      if (
        sessionState.currentSessionStatus ===
        SessionTrackingStatus.BACKGROUND_VERIFIED
      ) {
        sessionState.currentSessionStatus =
          SessionTrackingStatus.FOREGROUND_VERIFIED;
      }

      return {
        success: false,
        reason: 'gap_detected',
        timestamp,
        lastBackgroundUpdate: previousTimestamp,
        gap,
        maxInterval: TIMESTAMP_VALIDATION.MAX_UPDATE_INTERVAL_MS,
        note: 'Gap > 3 minutes detected - background tracking was interrupted. Evidence baseline reset.',
        baselineReset: true,
        newBaseline: timestamp
      };
    }
  }

  if (sessionState.backgroundedAt === null) {
    sessionState.backgroundedAt = timestamp;
  }

  if (timestamp < sessionState.backgroundedAt) {
    return {
      success: false,
      reason: 'before_background_start',
      timestamp,
      backgroundedAt: sessionState.backgroundedAt
    };
  }

  sessionState.lastBackgroundUpdate = timestamp;
  sessionState.backgroundUpdateCount++;

  const backgroundDuration =
    timestamp - sessionState.backgroundedAt;

  const REQUIRED_BACKGROUND_DURATION = 5 * 60 * 1000;
  const REQUIRED_UPDATE_COUNT = 3;

  const durationMet =
    backgroundDuration >= REQUIRED_BACKGROUND_DURATION;

  const countMet =
    sessionState.backgroundUpdateCount >= REQUIRED_UPDATE_COUNT;

  const verifiesBackground = durationMet && countMet;

  if (verifiesBackground) {
    sessionState.currentSessionStatus =
      SessionTrackingStatus.BACKGROUND_VERIFIED;

    try {
      localStorage.setItem(
        STORAGE_KEYS.BACKGROUND_CAPABILITY,
        BackgroundTrackingCapability.VERIFIED_WORKING
      );

      localStorage.setItem(
        STORAGE_KEYS.LAST_CAPABILITY_TEST,
        timestamp.toString()
      );
    } catch (error) {
      console.error('Failed to persist background capability:', error);
    }

    return {
      success: true,
      verified: true,
      status: sessionState.currentSessionStatus,
      backgroundDuration,
      updateCount: sessionState.backgroundUpdateCount,
      timestamp,
      watcher: { ...sessionState.activeWatcher },
      historicalCapabilityUpdated: true
    };
  }

  return {
    success: true,
    verified: false,
    status: sessionState.currentSessionStatus,
    backgroundDuration,
    updateCount: sessionState.backgroundUpdateCount,
    requiredDuration: REQUIRED_BACKGROUND_DURATION,
    requiredCount: REQUIRED_UPDATE_COUNT,
    durationMet,
    countMet,
    timestamp,
    watcher: { ...sessionState.activeWatcher }
  };
}

export function notifySessionFailed(reason) {
  sessionState.currentSessionStatus = SessionTrackingStatus.FAILED;

  if (reason && reason.includes('background')) {
    try {
      const now = Date.now();

      localStorage.setItem(
        STORAGE_KEYS.BACKGROUND_CAPABILITY,
        BackgroundTrackingCapability.FAILED
      );

      localStorage.setItem(
        STORAGE_KEYS.LAST_CAPABILITY_TEST,
        now.toString()
      );
    } catch (error) {
      console.error('Failed to persist background failure:', error);
    }
  }

  return {
    success: true,
    status: sessionState.currentSessionStatus,
    reason
  };
}

export function resetSessionState() {
  if (sessionState.activeWatcher.watcherId) {
    console.warn(
      'resetSessionState called with active watcher - tracking service should remove watcher first'
    );
  }

  sessionState.currentSessionStatus = SessionTrackingStatus.NOT_STARTED;

  sessionState.activeWatcher = {
    watcherId: null,
    sessionId: null,
    registeredAt: null
  };

  sessionState.backgroundedAt = null;
  sessionState.lastForegroundUpdate = null;
  sessionState.lastBackgroundUpdate = null;
  sessionState.backgroundUpdateCount = 0;
  sessionState.lastSessionId = null;

  return {
    success: true,
    status: sessionState.currentSessionStatus
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export async function isSafetySessionReady() {
  const foreground = await getForegroundLocationStatus();
  const capability = await getBackgroundCapabilityStatus();

  const foregroundReady = foreground.canUseLocation;

  const backgroundHistoricallyWorked =
    capability.capability === BackgroundTrackingCapability.VERIFIED_WORKING;

  return {
    ready: foregroundReady && backgroundHistoricallyWorked,
    foregroundReady,
    backgroundHistoricallyWorked,
    currentSessionStatus: sessionState.currentSessionStatus,
    details: {
      foreground,
      historicalCapability: capability,
      note: 'This checks historical capability, not current session verification'
    }
  };
}

export function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEYS.BACKGROUND_CAPABILITY);
    localStorage.removeItem(STORAGE_KEYS.LAST_CAPABILITY_TEST);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getPlatformInfo() {
  return {
    platform: 'unknown',
    version: 'unknown',
    note: 'Device API not reliably available in Capacitor'
  };
}
