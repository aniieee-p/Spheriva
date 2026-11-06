/**
 * Permission Management Utility for Spheriva Mobile (Capacitor)
 *
 * Handles foreground/background location permissions and notification permissions
 * with strict verification coordinated with the tracking service.
 *
 * CRITICAL FIXES APPLIED (Session 2025-01-31):
 * 1. Consistent future timestamp handling (60s threshold)
 * 2. Receipt timestamp validation (reject stale/future)
 * 3. Strict event ordering (must be >= last foreground)
 * 4. Stricter historical parsing (validate before persist)
 * 5. Watcher lifecycle verification (tracking service integration)
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

/**
 * Permission states aligned with Capacitor's PermissionState
 */
export const PermissionState = {
  GRANTED: 'granted',
  DENIED: 'denied',
  PROMPT: 'prompt',
  PROMPT_WITH_RATIONALE: 'prompt-with-rationale',
  RESTRICTED: 'restricted',
  UNKNOWN: 'unknown'
};

/**
 * Location accuracy levels
 */
export const LocationAccuracy = {
  PRECISE: 'precise',        // Fine location granted
  APPROXIMATE: 'approximate', // Coarse only (Android 12+)
  UNKNOWN: 'unknown'
};

/**
 * Background tracking capability (historical test results)
 */
export const BackgroundTrackingCapability = {
  NOT_TESTED: 'not_tested',
  VERIFIED_WORKING: 'verified_working',
  FAILED: 'failed'
};

/**
 * Current session tracking status (coordinated with tracking service)
 */
export const SessionTrackingStatus = {
  NOT_STARTED: 'not_started',
  WATCHER_REGISTERED: 'watcher_registered',
  FOREGROUND_VERIFIED: 'foreground_verified',
  BACKGROUND_VERIFIED: 'background_verified',
  FAILED: 'failed'
};

/**
 * Session gap detection threshold (Revision 7)
 * If no foreground update within this window, it's a "new session" → clear background evidence
 */
const SESSION_GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Timestamp validation constants (FIX #1: Consistent thresholds)
const TIMESTAMP_VALIDATION = {
  MAX_FUTURE_MS: 60000,      // 60 seconds - consistent across all validators
  MAX_STALE_MS: 3600000,     // 1 hour - reject very old updates
  RECEIPT_MAX_AGE_MS: 120000, // 2 minutes - for receipt validation
  MIN_UPDATE_INTERVAL_MS: 10000, // 10 seconds - minimum time between updates
  MAX_UPDATE_INTERVAL_MS: 180000 // 3 minutes - background update gap detection (Revision 7)
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * In-memory state for current session
 */
const sessionState = {
  // Current session tracking status
  currentSessionStatus: SessionTrackingStatus.NOT_STARTED,

  // Watcher lifecycle tracking (FIX #5: Verification)
  activeWatcher: {
    watcherId: null,
    sessionId: null,
    registeredAt: null
  },

  // App state tracking (Revision 7: enhanced initialization state)
  appState: {
    isActive: null,           // null = UNKNOWN until first listener fires
    lastChange: Date.now(),
    version: 0                // Incremented on each app state change
  },

  // Background verification tracking
  backgroundedAt: null,
  lastForegroundUpdate: null,
  lastBackgroundUpdate: null,   // Revision 7: Track last background update for gap detection
  backgroundUpdateCount: 0,     // Revision 7: Count background updates for verification

  // Session continuity tracking (Revision 7)
  lastSessionId: null,          // Track previous sessionId for gap detection

  // Initialization tracking (Revision 7)
  initializationInProgress: false,  // Guard against concurrent initialization
  initializationVersion: 0,         // Track initialization attempts
  listenerGeneration: 0,            // Track listener registration cycles

  // App state listener
  appStateListener: null
};

/**
 * Storage keys for persistent state
 */
const STORAGE_KEYS = {
  BACKGROUND_CAPABILITY: 'spheriva_background_capability',
  LAST_CAPABILITY_TEST: 'spheriva_last_capability_test'
};

// ============================================================================
// TIMESTAMP VALIDATION (FIX #1, #2, #4)
// ============================================================================

/**
 * Parse stored timestamp string with strict validation (Revision 7)
 * SECURITY: Prevents injection attacks via localStorage tampering
 * - Accepts only valid decimal integer strings (no whitespace, signs, hex, exponent notation)
 * - Rejects malformed input, unsafe integers, and out-of-range values
 * FIX #4: Stricter historical parsing - validate before using
 *
 * @param {string|null} storedValue - Value from localStorage
 * @param {string} context - Context for error logging
 * @returns {number|null} Validated timestamp or null
 */
function safeParseTimestamp(storedValue, context = 'unknown') {
  if (!storedValue) {
    return null;
  }

  // Strict validation: must be pure decimal digits only
  if (typeof storedValue !== 'string' || !/^\d+$/.test(storedValue)) {
    console.warn(`Invalid timestamp in ${context}: not a valid decimal integer string`);
    return null;
  }

  try {
    const parsed = Number(storedValue);

    // Validate it's a safe integer
    if (!Number.isSafeInteger(parsed)) {
      console.warn(`Invalid timestamp in ${context}: not a safe integer`);
      return null;
    }

    // Validate it's a reasonable epoch ms (after 2020, before 2100)
    const MIN_VALID_TIMESTAMP = 1577836800000; // 2020-01-01
    const MAX_VALID_TIMESTAMP = 4102444800000; // 2100-01-01

    if (parsed < MIN_VALID_TIMESTAMP || parsed > MAX_VALID_TIMESTAMP) {
      console.warn(`Invalid timestamp in ${context}: out of reasonable range (${parsed})`);
      return null;
    }

    // Validate it's not too far in the future (corrupted clock)
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

/**
 * Validate event and receipt timestamps (Revision 7)
 * STRICT VALIDATION: Rejects invalid timestamps before any state mutation
 * - Event timestamp must not be in the future (MAX_FUTURE_MS = 60s)
 * - Event timestamp must not be too stale (MAX_STALE_MS = 1 hour)
 * - Receipt timestamp must not be in the future (MAX_FUTURE_MS = 60s)
 * - Receipt timestamp must be recent (RECEIPT_MAX_AGE_MS = 2 minutes)
 * - Event timestamp cannot be later than receipt timestamp
 *
 * FIX #1: Consistent future timestamp handling (60s threshold)
 * FIX #2: Receipt timestamp validation
 *
 * @param {number} timestamp - Event timestamp to validate (when location was captured)
 * @param {number} receiptTime - Receipt timestamp (when we received this update)
 * @param {string} context - Context for error messages (e.g., 'foreground_update')
 * @returns {Object} Validation result: { valid: true } or { valid: false, reason, ... }
 */
function validateTimestamps(timestamp, receiptTime, context) {
  const now = Date.now();

  // FIX #1: Consistent future threshold
  if (timestamp > now + TIMESTAMP_VALIDATION.MAX_FUTURE_MS) {
    return {
      valid: false,
      reason: 'future_timestamp',
      timestamp,
      now,
      difference: timestamp - now
    };
  }

  // Validate not too stale
  if (timestamp < now - TIMESTAMP_VALIDATION.MAX_STALE_MS) {
    return {
      valid: false,
      reason: 'stale_timestamp',
      timestamp,
      now,
      age: now - timestamp
    };
  }

  // FIX #2: Receipt timestamp validation
  if (receiptTime > now + TIMESTAMP_VALIDATION.MAX_FUTURE_MS) {
    return {
      valid: false,
      reason: 'future_receipt_time',
      receiptTime,
      now,
      note: 'Receipt timestamp is in the future - clock skew detected'
    };
  }

  // Validate receipt is recent
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

  // Validate event happened before receipt
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
 * Initialize permission manager and app state tracking (Revision 7)
 * CRITICAL: Prevents race conditions with listener generation tracking
 * - Registers listener BEFORE calling App.getState() to avoid missing early state changes
 * - Uses generation tracking to prevent stale/orphan callbacks from mutating state
 * - Handles both listener registration failure and App.getState() failure safely
 * - Allows retry after failure
 */
export async function initializePermissionManager() {
  // Prevent concurrent initialization
  if (sessionState.initializationInProgress) {
    console.warn('Initialization already in progress, skipping duplicate call');
    return {
      success: false,
      reason: 'initialization_in_progress',
      note: 'Wait for current initialization to complete before retrying'
    };
  }

  sessionState.initializationInProgress = true;
  sessionState.initializationVersion++;

  try {
    // Clean up existing listener if present
    if (sessionState.appStateListener) {
      try {
        await sessionState.appStateListener.remove();
      } catch (removeError) {
        console.warn('Failed to remove previous listener:', removeError);
      }
      sessionState.appStateListener = null;
    }

    // Activate new listener generation BEFORE registration
    sessionState.listenerGeneration++;
    const listenerGeneration = sessionState.listenerGeneration;

    // Capture version BEFORE listener registration to detect races
    const versionBeforeListener = sessionState.appState.version;

    // Register listener BEFORE calling getState() to avoid missing early changes
    let listener;
    try {
      listener = await App.addListener('appStateChange', (state) => {
        // CRITICAL: Verify this callback's generation is still current
        if (sessionState.listenerGeneration !== listenerGeneration) {
          console.warn(`Stale appStateChange callback (generation ${listenerGeneration}, current ${sessionState.listenerGeneration}) - ignoring`);
          return;
        }

        const wasActive = sessionState.appState.isActive;
        sessionState.appState.isActive = state.isActive;
        sessionState.appState.lastChange = Date.now();
        sessionState.appState.version++; // Increment version on each valid update

        if (state.isActive && !wasActive) {
          // App returned to foreground - clear background verification window
          sessionState.backgroundedAt = null;
        } else if (!state.isActive && wasActive) {
          // App moved to background - record timestamp
          sessionState.backgroundedAt = Date.now();
        }
      });
    } catch (listenerError) {
      // Listener registration failed - invalidate generation and restore UNKNOWN state
      // CRITICAL: A callback may have fired before addListener rejected
      sessionState.listenerGeneration++;
      sessionState.appState.isActive = null;        // Restore UNKNOWN
      sessionState.backgroundedAt = null;           // Clear background timestamp
      sessionState.appState.lastChange = Date.now();
      sessionState.appState.version++;              // Invalidate previous snapshots
      sessionState.initializationInProgress = false;
      console.error('Failed to register appStateChange listener:', listenerError);
      return {
        success: false,
        reason: 'listener_registration_failed',
        error: listenerError.message,
        note: 'App state restored to UNKNOWN - listener could not be registered'
      };
    }

    // Store listener handle (listener was successfully registered at this point)
    sessionState.appStateListener = listener;

    // Get current app state AFTER listener registration
    let currentState;
    try {
      currentState = await App.getState();
    } catch (getStateError) {
      // App.getState() failed - invalidate generation, remove listener, restore UNKNOWN state
      // CRITICAL: Callbacks may have fired while getState was pending
      sessionState.listenerGeneration++;
      sessionState.appState.isActive = null;        // Restore UNKNOWN
      sessionState.backgroundedAt = null;           // Clear background timestamp
      sessionState.appState.lastChange = Date.now();
      sessionState.appState.version++;              // Invalidate previous snapshots
      try {
        await listener.remove();
      } catch (removeError) {
        console.warn('Failed to remove listener after getState failure:', removeError);
      }
      sessionState.appStateListener = null;
      sessionState.initializationInProgress = false;
      console.error('Failed to get current app state:', getStateError);
      return {
        success: false,
        reason: 'get_state_failed',
        error: getStateError.message,
        note: 'Listener removed and app state restored to UNKNOWN after getState failure'
      };
    }

    // Apply getState result only if version unchanged (no listener fired during getState)
    if (sessionState.appState.version === versionBeforeListener) {
      sessionState.appState.isActive = currentState.isActive;
      sessionState.appState.lastChange = Date.now();
      sessionState.appState.version++;

      // Set backgroundedAt if app is currently backgrounded
      if (!currentState.isActive) {
        sessionState.backgroundedAt = Date.now();
      }
    } else {
      console.info('Listener already updated app state during initialization - using listener value');
    }

    sessionState.initializationInProgress = false;

    return {
      success: true,
      appState: { ...sessionState.appState },
      listenerGeneration: sessionState.listenerGeneration
    };
  } catch (error) {
    // Unexpected error during initialization - clean up and restore UNKNOWN state
    // Invalidate generation if listener may have been registered
    if (sessionState.appStateListener) {
      sessionState.listenerGeneration++;
      try {
        await sessionState.appStateListener.remove();
        sessionState.appStateListener = null;
      } catch (removeError) {
        console.warn('Failed to remove listener after unexpected error:', removeError);
        // Generation invalidation still protects state even if removal fails
        sessionState.appStateListener = null;
      }
    }
    // Restore UNKNOWN state in case callbacks mutated it
    sessionState.appState.isActive = null;
    sessionState.backgroundedAt = null;
    sessionState.appState.lastChange = Date.now();
    sessionState.appState.version++;
    sessionState.initializationInProgress = false;
    console.error('Unexpected error during initialization:', error);
    return {
      success: false,
      reason: 'unexpected_error',
      error: error.message,
      note: 'App state restored to UNKNOWN after unexpected initialization error'
    };
  }
}

/**
 * Clean up permission manager resources
 */
export async function cleanupPermissionManager() {
  if (sessionState.appStateListener) {
    await sessionState.appStateListener.remove();
    sessionState.appStateListener = null;
  }
}

// ============================================================================
// PERMISSION STATUS QUERIES
// ============================================================================

/**
 * Get current foreground location permission status
 * @returns {Promise<Object>} Permission state and accuracy
 */
export async function getForegroundLocationStatus() {
  try {
    const result = await Geolocation.checkPermissions();

    // Determine accuracy based on permission combination
    let accuracy = LocationAccuracy.UNKNOWN;
    if (result.location === PermissionState.GRANTED && result.coarseLocation === PermissionState.GRANTED) {
      accuracy = LocationAccuracy.PRECISE;
    } else if (result.location === PermissionState.DENIED && result.coarseLocation === PermissionState.GRANTED) {
      accuracy = LocationAccuracy.APPROXIMATE;
    }

    return {
      permission: result.location,
      coarseLocation: result.coarseLocation,
      accuracy,
      canUseLocation: result.location === PermissionState.GRANTED || result.coarseLocation === PermissionState.GRANTED
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

/**
 * Get background location permission status
 * NOTE: Cannot be checked programmatically - always returns UNKNOWN
 * @returns {Promise<Object>} Permission state (always unknown)
 */
export async function getBackgroundLocationStatus() {
  return {
    permission: PermissionState.UNKNOWN,
    note: 'Background location permission cannot be checked programmatically',
    historicalCapability: await getBackgroundCapabilityStatus()
  };
}

/**
 * Get historical background capability test results
 * FIX #4: Uses safeParseTimestamp for validation
 * @returns {Promise<Object>} Historical test results
 */
export async function getBackgroundCapabilityStatus() {
  try {
    const capability = localStorage.getItem(STORAGE_KEYS.BACKGROUND_CAPABILITY) || BackgroundTrackingCapability.NOT_TESTED;
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

/**
 * Get current session tracking status
 * FIX #5: Includes watcher lifecycle information
 * @returns {Object} Current session status
 */
export function getCurrentSessionStatus() {
  return {
    status: sessionState.currentSessionStatus,
    watcher: { ...sessionState.activeWatcher },
    appState: { ...sessionState.appState },
    backgroundedAt: sessionState.backgroundedAt,
    lastForegroundUpdate: sessionState.lastForegroundUpdate
  };
}

/**
 * Get notification permission status
 * NOTE: Cannot be checked programmatically on most platforms
 * @returns {Promise<Object>} Permission state (always unknown with guidance)
 */
export async function getNotificationStatus() {
  return {
    permission: PermissionState.UNKNOWN,
    note: 'Notification permissions cannot be checked programmatically. User must verify in system settings.',
    guidance: 'Check Settings → Apps → Spheriva → Notifications'
  };
}

/**
 * Get comprehensive permission status for all permission types
 * @returns {Promise<Object>} Complete permission status
 */
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

/**
 * Request foreground location permission
 * @returns {Promise<Object>} Request result with new status
 */
export async function requestForegroundLocation() {
  try {
    const result = await Geolocation.requestPermissions({ permissions: ['location'] });

    // Determine accuracy
    let accuracy = LocationAccuracy.UNKNOWN;
    if (result.location === PermissionState.GRANTED && result.coarseLocation === PermissionState.GRANTED) {
      accuracy = LocationAccuracy.PRECISE;
    } else if (result.location === PermissionState.DENIED && result.coarseLocation === PermissionState.GRANTED) {
      accuracy = LocationAccuracy.APPROXIMATE;
    }

    return {
      success: result.location === PermissionState.GRANTED || result.coarseLocation === PermissionState.GRANTED,
      permission: result.location,
      coarseLocation: result.coarseLocation,
      accuracy,
      needsSettings: result.location === PermissionState.DENIED && result.coarseLocation === PermissionState.DENIED
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

/**
 * Request notification permission
 * NOTE: Capacitor does not provide a cross-platform notification request API
 * @returns {Promise<Object>} Guidance for manual setup
 */
export async function requestNotificationPermission() {
  return {
    success: false,
    note: 'Notification permissions must be configured in system settings',
    guidance: 'Please enable notifications in Settings → Apps → Spheriva → Notifications',
    action: 'open_settings_required'
  };
}

/**
 * Open system settings for the app
 * @returns {Promise<Object>} Result of opening settings
 */
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

/**
 * Request all permissions needed for a safety session
 * Requests foreground location, guides user for background and notifications
 * @returns {Promise<Object>} Complete permission request results
 */
export async function requestSafetySessionPermissions() {
  // Step 1: Request foreground location (can be done programmatically)
  const foregroundResult = await requestForegroundLocation();

  // Step 2: Get fresh capability status (historical, not current session)
  const capabilityStatus = await getBackgroundCapabilityStatus();

  // Step 3: Prepare guidance for background and notifications
  const backgroundGuidance = {
    status: 'requires_manual_setup',
    note: 'Background location must be configured in system settings',
    guidance: 'Settings → Apps → Spheriva → Permissions → Location → Allow all the time',
    historicalCapability: capabilityStatus
  };

  const notificationGuidance = await requestNotificationPermission();

  // Step 4: Determine if settings must be opened
  const needsSettings = foregroundResult.needsSettings ||
                       capabilityStatus.capability === BackgroundTrackingCapability.FAILED;

  return {
    foreground: foregroundResult,
    background: backgroundGuidance,
    notifications: notificationGuidance,
    needsSettings,
    readyToStart: foregroundResult.success &&
                  capabilityStatus.capability === BackgroundTrackingCapability.VERIFIED_WORKING,
    note: needsSettings ? 'User must configure permissions in system settings' : null
  };
}

// ============================================================================
// TRACKING SERVICE COORDINATION (FIX #5: Watcher Lifecycle)
// ============================================================================

/**
 * Notify that a tracking session has started with watcher registration (Revision 7)
 * CRITICAL: Session identity tracking with gap detection
 * - Distinguishes between same-session restart and different-session start
 * - Preserves lastForegroundUpdate within 5-minute window (same session)
 * - Clears lastForegroundUpdate if older than 5 minutes (stale session)
 * - Always clears background evidence on session start
 * FIX #5: Watcher lifecycle verification
 *
 * INTEGRATION REQUIREMENTS:
 * Tracking service must call this function with:
 * 1. Valid sessionId (non-empty string)
 * 2. Valid watcherId returned from BackgroundGeolocation.addWatcher() (non-empty string)
 *
 * WATCHER LIFECYCLE:
 * 1. Tracking service calls BackgroundGeolocation.addWatcher(config)
 * 2. Receives watcherId in return value
 * 3. Calls notifySessionStarted(sessionId, watcherId) with both IDs
 * 4. Updates flow through recordForegroundUpdate/recordBackgroundUpdate
 * 5. On cleanup: calls BackgroundGeolocation.removeWatcher(watcherId)
 *
 * @param {string} sessionId - Unique session identifier
 * @param {string} watcherId - Watcher ID returned from BackgroundGeolocation.addWatcher()
 * @returns {Object} Registration result
 */
export function notifySessionStarted(sessionId, watcherId) {
  // Validate inputs
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

  // Trim and store validated IDs
  const trimmedSessionId = sessionId.trim();
  const trimmedWatcherId = watcherId.trim();

  // Check for double registration
  if (sessionState.activeWatcher.watcherId && sessionState.activeWatcher.watcherId !== trimmedWatcherId) {
    console.warn('Session started with new watcher while previous watcher still active');
  }

  // Revision 7: Determine if this is a same-session restart or different-session start
  const isDifferentSession = sessionState.lastSessionId !== null && sessionState.lastSessionId !== trimmedSessionId;
  const isSameSession = sessionState.lastSessionId === trimmedSessionId;

  // Revision 7: Handle session gap detection (5-minute threshold for session lifecycle)
  let preservedForegroundUpdate = null;
  if (isSameSession && sessionState.lastForegroundUpdate !== null) {
    const now = Date.now();
    const gap = now - sessionState.lastForegroundUpdate;

    // Preserve lastForegroundUpdate if within SESSION_GAP_THRESHOLD (5 minutes)
    if (gap <= SESSION_GAP_THRESHOLD_MS) {
      preservedForegroundUpdate = sessionState.lastForegroundUpdate;
    }
    // If gap > 5 minutes, treat as stale session baseline (clear it)
  }

  // Register watcher
  sessionState.activeWatcher = {
    watcherId: trimmedWatcherId,
    sessionId: trimmedSessionId,
    registeredAt: Date.now()
  };

  // Update lastSessionId to track session identity
  sessionState.lastSessionId = trimmedSessionId;

  // Reset session state
  sessionState.currentSessionStatus = SessionTrackingStatus.WATCHER_REGISTERED;

  // Revision 7: Handle lastForegroundUpdate based on session identity
  if (isDifferentSession) {
    // Different session: always clear lastForegroundUpdate
    sessionState.lastForegroundUpdate = null;
  } else if (isSameSession) {
    // Same session: preserve if within 5-minute window, otherwise clear
    sessionState.lastForegroundUpdate = preservedForegroundUpdate;
  } else {
    // First session ever: clear
    sessionState.lastForegroundUpdate = null;
  }

  // Revision 7: Always clear background evidence on session start
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

/**
 * Record a foreground location update from tracking service (Revision 7)
 * STRICT VALIDATION: Receipt time generated internally, validates before state mutation
 * - Verifies active session identity matches last registered session
 * - Rejects out-of-order timestamps (older than or equal to previous accepted update)
 * FIX #1, #2: Uses validateTimestamps for consistent validation
 *
 * @param {number} timestamp - Update timestamp (when location was captured)
 * @returns {Object} Recording result
 */
export function recordForegroundUpdate(timestamp) {
  // Generate receipt time internally
  const receiptTime = Date.now();

  // FIX #5: Verify watcher is active
  if (!sessionState.activeWatcher.watcherId) {
    return {
      success: false,
      reason: 'no_active_watcher',
      note: 'Session not started or watcher not registered'
    };
  }

  // Revision 7: Verify active session identity matches last registered session
  if (sessionState.activeWatcher.sessionId !== sessionState.lastSessionId) {
    return {
      success: false,
      reason: 'session_mismatch',
      note: 'Update from stale or mismatched session - current session does not match last registered session'
    };
  }

  // FIX #1, #2: Validate timestamps
  const validation = validateTimestamps(timestamp, receiptTime, 'foreground_update');
  if (!validation.valid) {
    return {
      success: false,
      ...validation
    };
  }

  // Revision 7: Reject out-of-order timestamps
  if (sessionState.lastForegroundUpdate !== null && timestamp <= sessionState.lastForegroundUpdate) {
    return {
      success: false,
      reason: 'out_of_order_timestamp',
      timestamp,
      lastAccepted: sessionState.lastForegroundUpdate,
      note: 'Timestamp is older than or equal to previously accepted foreground update'
    };
  }

  // Update state
  sessionState.lastForegroundUpdate = timestamp;

  // Upgrade status if this is first foreground verification
  if (sessionState.currentSessionStatus === SessionTrackingStatus.WATCHER_REGISTERED) {
    sessionState.currentSessionStatus = SessionTrackingStatus.FOREGROUND_VERIFIED;
  }

  return {
    success: true,
    status: sessionState.currentSessionStatus,
    timestamp,
    watcher: { ...sessionState.activeWatcher }
  };
}

/**
 * Record a background location update from tracking service (Revision 7)
 * STRICT VALIDATION: Receipt time generated internally, comprehensive gap detection
 * - Verifies active session identity matches last registered session
 * - Enforces minimum interval (10s) between consecutive background updates
 * - Detects gaps > 3 minutes as evidence of tracking interruption
 * - Requires 3+ accepted updates spanning 5+ minutes for verification
 * FIX #1, #2, #3: Enhanced validation and ordering
 *
 * @param {number} timestamp - Update timestamp (when location was captured)
 * @returns {Object} Recording result with verification status
 */
export function recordBackgroundUpdate(timestamp) {
  // Generate receipt time internally
  const receiptTime = Date.now();

  // FIX #5: Verify watcher is active
  if (!sessionState.activeWatcher.watcherId) {
    return {
      success: false,
      reason: 'no_active_watcher',
      note: 'Session not started or watcher not registered'
    };
  }

  // Revision 7: Verify active session identity matches last registered session
  if (sessionState.activeWatcher.sessionId !== sessionState.lastSessionId) {
    return {
      success: false,
      reason: 'session_mismatch',
      note: 'Update from stale or mismatched session - current session does not match last registered session'
    };
  }

  // Validation 1: App must be confirmed in background (not UNKNOWN, not foreground)
  if (sessionState.appState.isActive !== false) {
    return {
      success: false,
      reason: 'app_not_backgrounded',
      appCurrentlyActive: sessionState.appState.isActive,
      timestamp
    };
  }

  // FIX #1, #2: Validate timestamps
  const validation = validateTimestamps(timestamp, receiptTime, 'background_update');
  if (!validation.valid) {
    return {
      success: false,
      ...validation
    };
  }

  // FIX #3: Strict event ordering - must be > last foreground
  if (sessionState.lastForegroundUpdate && timestamp <= sessionState.lastForegroundUpdate) {
    return {
      success: false,
      reason: 'out_of_order',
      timestamp,
      lastForegroundUpdate: sessionState.lastForegroundUpdate,
      note: 'Background update must be strictly after last foreground update'
    };
  }

  // Revision 7: Check for gap in background updates (MAX_UPDATE_INTERVAL_MS = 3 minutes)
  if (sessionState.lastBackgroundUpdate !== null) {
    const gap = timestamp - sessionState.lastBackgroundUpdate;

    // Check minimum interval (10 seconds)
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

    // Check for gap exceeding maximum interval (3 minutes) - indicates tracking interruption
    if (gap > TIMESTAMP_VALIDATION.MAX_UPDATE_INTERVAL_MS) {
      // Gap detected - reset background evidence baseline
      sessionState.backgroundedAt = timestamp;
      sessionState.lastBackgroundUpdate = timestamp;
      sessionState.backgroundUpdateCount = 0;

      // Downgrade status if previously verified
      if (sessionState.currentSessionStatus === SessionTrackingStatus.BACKGROUND_VERIFIED) {
        sessionState.currentSessionStatus = SessionTrackingStatus.FOREGROUND_VERIFIED;
      }

      return {
        success: false,
        reason: 'gap_detected',
        timestamp,
        lastBackgroundUpdate: sessionState.lastBackgroundUpdate - gap, // Previous timestamp before reset
        gap,
        maxInterval: TIMESTAMP_VALIDATION.MAX_UPDATE_INTERVAL_MS,
        note: 'Gap > 3 minutes detected - background tracking was interrupted. Evidence baseline reset.',
        baselineReset: true,
        newBaseline: timestamp
      };
    }
  }

  // Initialize background evidence if this is the first valid event
  if (sessionState.backgroundedAt === null) {
    sessionState.backgroundedAt = timestamp;
  }

  // Validation: Must be after app backgrounded
  if (timestamp < sessionState.backgroundedAt) {
    return {
      success: false,
      reason: 'before_background_start',
      timestamp,
      backgroundedAt: sessionState.backgroundedAt
    };
  }

  // Accept the update - update state
  sessionState.lastBackgroundUpdate = timestamp;
  sessionState.backgroundUpdateCount++;

  // Calculate background duration
  const backgroundDuration = timestamp - sessionState.backgroundedAt;
  const REQUIRED_BACKGROUND_DURATION = 5 * 60 * 1000; // 5 minutes
  const REQUIRED_UPDATE_COUNT = 3; // Require at least 3 accepted updates

  // Check if this verifies background capability
  const durationMet = backgroundDuration >= REQUIRED_BACKGROUND_DURATION;
  const countMet = sessionState.backgroundUpdateCount >= REQUIRED_UPDATE_COUNT;
  const verifiesBackground = durationMet && countMet;

  if (verifiesBackground) {
    // Upgrade session status
    sessionState.currentSessionStatus = SessionTrackingStatus.BACKGROUND_VERIFIED;

    // FIX #4: Validate timestamp before persisting
    try {
      localStorage.setItem(STORAGE_KEYS.BACKGROUND_CAPABILITY, BackgroundTrackingCapability.VERIFIED_WORKING);
      localStorage.setItem(STORAGE_KEYS.LAST_CAPABILITY_TEST, timestamp.toString());
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
  } else {
    // Valid update but not yet verified
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
}

/**
 * Notify that tracking session failed
 * FIX #4: Validates timestamp before persisting
 *
 * @param {string} reason - Failure reason
 */
export function notifySessionFailed(reason) {
  sessionState.currentSessionStatus = SessionTrackingStatus.FAILED;

  // If failure was due to background tracking, update historical capability
  if (reason && reason.includes('background')) {
    try {
      const now = Date.now();
      localStorage.setItem(STORAGE_KEYS.BACKGROUND_CAPABILITY, BackgroundTrackingCapability.FAILED);
      localStorage.setItem(STORAGE_KEYS.LAST_CAPABILITY_TEST, now.toString());
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

/**
 * Reset current session state (for cleanup after session ends)
 * FIX #5: Clears watcher lifecycle state
 *
 * NOTE: Tracking service must call BackgroundGeolocation.removeWatcher(watcherId)
 * BEFORE calling this function to properly clean up the watcher.
 */
export function resetSessionState() {
  // FIX #5: Warn if watcher still registered
  if (sessionState.activeWatcher.watcherId) {
    console.warn('resetSessionState called with active watcher - tracking service should remove watcher first');
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

/**
 * Check if all permissions needed for safety session are ready
 * NOTE: This checks historical capability, not current session verification
 * @returns {Promise<Object>} Readiness status
 */
export async function isSafetySessionReady() {
  const foreground = await getForegroundLocationStatus();
  const capability = await getBackgroundCapabilityStatus();

  const foregroundReady = foreground.canUseLocation;
  const backgroundHistoricallyWorked = capability.capability === BackgroundTrackingCapability.VERIFIED_WORKING;

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

/**
 * Clear all persisted permission state (for testing/debugging)
 */
export function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEYS.BACKGROUND_CAPABILITY);
    localStorage.removeItem(STORAGE_KEYS.LAST_CAPABILITY_TEST);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get platform information
 * NOTE: Device API not reliably available - returns unknown values
 * @returns {Promise<Object>} Platform information
 */
export async function getPlatformInfo() {
  return {
    platform: 'unknown',
    version: 'unknown',
    note: 'Device API not reliably available in Capacitor'
  };
}
