/**
 * Tracking Service - Background Location Tracking
 *
 * Manages safety session lifecycle with BackgroundGeolocation plugin.
 * Integrates with permissions.js Revision 7 for session coordination.
 *
 * CRITICAL: This service tracks watcher lifecycle and prevents orphaned
 * native watchers. Never clear a watcher ID until removal is confirmed.
 *
 * State Model:
 * - IDLE: No session, ready to start
 * - STARTING: Pre-registration validation in progress
 * - WATCHER_REGISTERING: addWatcher() called, awaiting resolution
 * - ACTIVE: Session active, watcher confirmed registered
 * - STOPPING: Stop requested, removing watcher
 * - FAILED_WATCHER_STUCK: Watcher removal failed, ID retained for retry
 * - FAILED_PERMISSION_REVOKED: Permission revoked, cleanup in progress
 */

import { registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');
import {
  initializePermissionManager,
  notifySessionStarted,
  recordForegroundUpdate,
  recordBackgroundUpdate,
  notifySessionFailed,
  resetSessionState,
  getCurrentSessionStatus,
  getForegroundLocationStatus
} from '../utils/permissions';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Session lifecycle states
 */
const SessionState = {
  IDLE: 'idle',
  STARTING: 'starting',
  WATCHER_REGISTERING: 'watcher_registering',
  ACTIVE: 'active',
  STOPPING: 'stopping',
  FAILED_WATCHER_STUCK: 'failed_watcher_stuck',
  FAILED_PERMISSION_REVOKED: 'failed_permission_revoked'
};

/**
 * Cleanup stage tracking
 */
const CleanupStage = {
  NONE: 'none',
  WATCHER_REMOVAL_PENDING: 'watcher_removal_pending',
  WATCHER_REMOVED: 'watcher_removed',
  COMPLETE: 'complete'
};

// ============================================================================
// MODULE STATE
// ============================================================================

/**
 * Tracking service state (module-level singleton)
 * CRITICAL: Never clear activeWatcherId until removal is confirmed
 */
const trackingState = {
  // Permission manager initialization
  permissionsInitialized: false,
  initializationPromise: null,  // Shared Promise for concurrent calls

  // Session lifecycle
  sessionState: SessionState.IDLE,

  // Active session identifiers
  activeSessionId: null,
  activeWatcherId: null,

  // Callback management
  watcherCallback: null,
  callbackGeneration: 0,

  // Early callback buffering
  earlyCallbackBuffer: [],
  maxBufferSize: 10,
  bufferProcessed: false,

  // Failure state tracking
  failureInProgress: false,
  stuckWatcherId: null,
  failureReason: null,  // Preserve original failure reason for retry scenarios

  // Cleanup retry tracking
  cleanupAttempts: 0,
  maxCleanupAttempts: 3,  // Recommended limit (not enforced)
  cleanupStage: CleanupStage.NONE
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize tracking service
 * Concurrent-safe: Multiple callers await same initialization
 * Idempotent: Safe to call multiple times
 *
 * @returns {Promise<Object>} Initialization result
 */
export async function initializeTrackingService() {
  // Already initialized successfully
  if (trackingState.permissionsInitialized) {
    return {
      success: true,
      alreadyInitialized: true,
      note: 'Tracking service already initialized'
    };
  }

  // Initialization already in progress - await same Promise
  if (trackingState.initializationPromise !== null) {
    console.log('Initialization in progress - awaiting existing attempt');
    return await trackingState.initializationPromise;
  }

  // Start new initialization
  const initPromise = (async () => {
    try {
      const initResult = await initializePermissionManager();

      if (!initResult.success) {
        // Initialization failed - clear Promise to allow retry
        trackingState.initializationPromise = null;

        return {
          success: false,
          reason: 'permission_manager_init_failed',
          detail: initResult.reason,
          error: initResult.error,
          note: 'Retry is permitted'
        };
      }

      // Success - mark as initialized
      trackingState.permissionsInitialized = true;

      return {
        success: true,
        appState: initResult.appState,
        listenerGeneration: initResult.listenerGeneration
      };
    } catch (error) {
      // Unexpected error - clear Promise to allow retry
      trackingState.initializationPromise = null;

      return {
        success: false,
        reason: 'unexpected_initialization_error',
        error: error.message
      };
    }
  })();

  trackingState.initializationPromise = initPromise;
  return await initPromise;
}

/**
 * Start a safety session with background location tracking
 *
 * @param {Object} options - Session options
 * @param {string} options.backgroundMessage - Notification text (REQUIRED for background)
 * @param {string} [options.backgroundTitle] - Notification title
 * @param {number} [options.distanceFilter] - Minimum meters between updates
 * @returns {Promise<Object>} Start result
 */
export async function startSafetySession(options = {}) {
  // STEP 1: Validate options before any state changes
  const validationResult = validateSessionOptions(options);
  if (!validationResult.valid) {
    return {
      success: false,
      reason: 'invalid_options',
      errors: validationResult.errors
    };
  }

  // STEP 2: Guard against stuck watcher
  if (trackingState.sessionState === SessionState.FAILED_WATCHER_STUCK) {
    return {
      success: false,
      reason: 'stuck_watcher_exists',
      stuckWatcherId: trackingState.stuckWatcherId,
      cleanupAttempts: trackingState.cleanupAttempts,
      note: 'Call retryCleanup() to resolve stuck watcher before starting new session'
    };
  }

  // STEP 3: Guard against non-IDLE states
  if (trackingState.sessionState !== SessionState.IDLE) {
    return {
      success: false,
      reason: 'invalid_state',
      currentState: trackingState.sessionState,
      note: getStateTransitionGuidance(trackingState.sessionState)
    };
  }

  // STEP 4: Transition to STARTING
  trackingState.sessionState = SessionState.STARTING;

  try {
    // STEP 5: Initialize permission manager if needed
    if (!trackingState.permissionsInitialized) {
      const initResult = await initializeTrackingService();
      if (!initResult.success) {
        trackingState.sessionState = SessionState.IDLE;
        return {
          success: false,
          reason: 'permission_manager_init_failed',
          detail: initResult.reason
        };
      }
    }

    // STEP 6: Check permissions
    let permissionStatus;
    try {
      permissionStatus = await getForegroundLocationStatus();
    } catch (permError) {
      trackingState.sessionState = SessionState.IDLE;
      return {
        success: false,
        reason: 'permission_check_failed',
        error: permError.message
      };
    }

    // Validate permission status structure
    if (!permissionStatus || typeof permissionStatus.canUseLocation !== 'boolean') {
      trackingState.sessionState = SessionState.IDLE;
      return {
        success: false,
        reason: 'permission_status_invalid',
        receivedStatus: permissionStatus
      };
    }

    if (!permissionStatus.canUseLocation) {
      trackingState.sessionState = SessionState.IDLE;
      return {
        success: false,
        reason: 'location_permission_denied',
        permissionState: permissionStatus.permission,
        coarseLocation: permissionStatus.coarseLocation
      };
    }

    // STEP 7: Generate session ID
    const sessionId = generateSessionId();
    trackingState.activeSessionId = sessionId;

    // STEP 8: Increment callback generation and initialize buffer
    trackingState.callbackGeneration++;
    const currentGeneration = trackingState.callbackGeneration;
    trackingState.earlyCallbackBuffer = [];
    trackingState.bufferProcessed = false;

    // STEP 9: Create callback with buffering logic
    const callback = (location, error) => {
      handleLocationUpdateWithBuffering(location, error, currentGeneration);
    };
    trackingState.watcherCallback = callback;

    // STEP 10: Transition to WATCHER_REGISTERING
    trackingState.sessionState = SessionState.WATCHER_REGISTERING;

    // STEP 11: Register watcher
    let watcherId = null;
    let watcherRegistered = false;

    try {
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: options.backgroundMessage,
          backgroundTitle: options.backgroundTitle || 'Spheriva Safety',
          requestPermissions: false,
          stale: false,
          distanceFilter: options.distanceFilter || 0
        },
        callback
      );

      // If we reach here, native watcher IS registered
      watcherRegistered = true;
      trackingState.activeWatcherId = watcherId;

    } catch (watcherError) {
      // Watcher registration rejected BEFORE native registration
      // Safe to clean up without removal
      trackingState.callbackGeneration++;
      trackingState.watcherCallback = null;
      trackingState.earlyCallbackBuffer = [];
      trackingState.activeSessionId = null;
      trackingState.sessionState = SessionState.IDLE;

      return {
        success: false,
        reason: 'watcher_registration_failed',
        error: watcherError.message
      };
    }

    // From this point forward, watcher IS registered and MUST be removed on error

    try {
      // STEP 12: Notify permission manager
      const notifyResult = notifySessionStarted(sessionId, watcherId);
      if (!notifyResult.success) {
        throw new Error(`notifySessionStarted failed: ${notifyResult.reason}`);
      }

      // STEP 13: Transition to ACTIVE
      trackingState.sessionState = SessionState.ACTIVE;

      // STEP 14: Process buffered callbacks
      const processedCount = processBufferedCallbacks();

      return {
        success: true,
        sessionId,
        watcherId,
        status: notifyResult.status,
        appState: notifyResult.appState,
        bufferedCallbacks: processedCount
      };

    } catch (postRegistrationError) {
      // Unexpected error AFTER successful watcher registration
      // MUST attempt watcher removal

      console.error('Post-registration error:', postRegistrationError);

      trackingState.callbackGeneration++; // Invalidate callbacks first
      trackingState.watcherCallback = null;
      trackingState.earlyCallbackBuffer = [];

      // Attempt watcher removal
      let removalSucceeded = false;
      try {
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
        removalSucceeded = true;
      } catch (removeError) {
        console.error('Watcher removal failed during startup cleanup:', removeError);
      }

      if (removalSucceeded) {
        // Clean removal - return to IDLE
        trackingState.activeWatcherId = null;
        trackingState.activeSessionId = null;
        trackingState.sessionState = SessionState.IDLE;

        return {
          success: false,
          reason: 'post_registration_error',
          error: postRegistrationError.message,
          cleanupSucceeded: true
        };
      } else {
        // Removal failed - watcher stuck
        trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
        trackingState.stuckWatcherId = watcherId;
        trackingState.cleanupAttempts = 1;
        // DO NOT clear activeWatcherId or activeSessionId yet

        return {
          success: false,
          reason: 'post_registration_error_watcher_stuck',
          error: postRegistrationError.message,
          stuckWatcherId: watcherId,
          note: 'Call retryCleanup() before starting new session'
        };
      }
    }

  } catch (error) {
    // Unexpected error during STARTING phase (before watcher registration)
    // No watcher to remove
    trackingState.callbackGeneration++;
    trackingState.watcherCallback = null;
    trackingState.earlyCallbackBuffer = [];
    trackingState.activeSessionId = null;
    trackingState.sessionState = SessionState.IDLE;

    return {
      success: false,
      reason: 'unexpected_error',
      error: error.message
    };
  }
}

/**
 * Stop active safety session
 *
 * @returns {Promise<Object>} Stop result
 */
export async function stopSafetySession() {
  // STEP 1: Validate state
  if (trackingState.sessionState !== SessionState.ACTIVE) {
    return {
      success: false,
      reason: 'invalid_state',
      currentState: trackingState.sessionState,
      note: getStateTransitionGuidance(trackingState.sessionState)
    };
  }

  // STEP 2: Transition to STOPPING
  trackingState.sessionState = SessionState.STOPPING;
  trackingState.cleanupStage = CleanupStage.WATCHER_REMOVAL_PENDING;

  // Capture IDs before any async operations
  const sessionId = trackingState.activeSessionId;
  const watcherId = trackingState.activeWatcherId;

  // STEP 3: Invalidate callbacks FIRST
  trackingState.callbackGeneration++;
  trackingState.watcherCallback = null;
  trackingState.earlyCallbackBuffer = [];

  // STEP 4: Attempt watcher removal
  let removalSucceeded = false;
  try {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
    removalSucceeded = true;
    trackingState.cleanupStage = CleanupStage.WATCHER_REMOVED;
  } catch (removeError) {
    console.error('Watcher removal failed:', removeError);

    // Watcher stuck - DO NOT proceed to reset
    trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
    trackingState.stuckWatcherId = watcherId;
    trackingState.cleanupAttempts = 1;
    trackingState.cleanupStage = CleanupStage.WATCHER_REMOVAL_PENDING;

    // Retain activeWatcherId and activeSessionId

    return {
      success: false,
      reason: 'watcher_removal_failed',
      error: removeError.message,
      stuckWatcherId: watcherId,
      cleanupStage: trackingState.cleanupStage,
      note: 'Call retryCleanup() to retry removal'
    };
  }

  // STEP 5: Reset permission manager state (after confirmed removal)
  // NOTE: resetSessionState() cannot fail (always returns success: true)
  const resetResult = resetSessionState();
  trackingState.cleanupStage = CleanupStage.COMPLETE;

  // STEP 6: Clear tracking state
  trackingState.activeWatcherId = null;
  trackingState.activeSessionId = null;
  trackingState.sessionState = SessionState.IDLE;
  trackingState.cleanupStage = CleanupStage.NONE;

  return {
    success: true,
    stoppedSessionId: sessionId,
    stoppedWatcherId: watcherId,
    status: resetResult.status
  };
}

/**
 * Retry cleanup when watcher removal previously failed
 * Unlimited manual retries permitted
 *
 * @returns {Promise<Object>} Retry result
 */
export async function retryCleanup() {
  // STEP 1: Validate state
  if (trackingState.sessionState !== SessionState.FAILED_WATCHER_STUCK) {
    return {
      success: false,
      reason: 'invalid_state',
      currentState: trackingState.sessionState,
      note: 'Retry cleanup only valid in FAILED_WATCHER_STUCK state'
    };
  }

  // STEP 2: Warn if approaching recommended limit (but don't block)
  if (trackingState.cleanupAttempts >= trackingState.maxCleanupAttempts) {
    console.warn('Exceeded recommended retry limit. Continuing anyway...');
  }

  // STEP 3: Increment attempt counter BEFORE removal
  trackingState.cleanupAttempts++;
  const attemptNumber = trackingState.cleanupAttempts;

  // STEP 4: Attempt removal
  const watcherId = trackingState.stuckWatcherId;
  let removalSucceeded = false;

  try {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
    removalSucceeded = true;
  } catch (removeError) {
    console.error(`Cleanup retry ${attemptNumber} failed:`, removeError);

    return {
      success: false,
      reason: 'watcher_removal_still_failing',
      error: removeError.message,
      attemptNumber,
      totalAttempts: trackingState.cleanupAttempts,
      stuckWatcherId: watcherId,
      note: attemptNumber >= trackingState.maxCleanupAttempts
        ? 'Exceeded recommended limit. Manual intervention or app restart may be required.'
        : 'Retry again or restart app if problem persists.'
    };
  }

  // STEP 5: Removal succeeded
  if (removalSucceeded) {
    // Capture attempt count BEFORE resetting
    const totalAttempts = trackingState.cleanupAttempts;

    // Capture failure reason before clearing (may be null for manual stop cleanup)
    const originalFailureReason = trackingState.failureReason;

    // Reset permission manager state
    const resetResult = resetSessionState();

    // If this was a failure (not manual stop cleanup), notify after reset
    if (originalFailureReason) {
      notifySessionFailed(originalFailureReason);
    }

    // Clear all stuck state
    trackingState.stuckWatcherId = null;
    trackingState.activeWatcherId = null;
    trackingState.activeSessionId = null;
    trackingState.failureReason = null;
    trackingState.cleanupAttempts = 0;  // Reset AFTER capturing
    trackingState.sessionState = SessionState.IDLE;
    trackingState.cleanupStage = CleanupStage.NONE;

    return {
      success: true,
      removedWatcherId: watcherId,
      attemptNumber: totalAttempts,  // Report actual count
      status: resetResult.status,
      failureNotified: originalFailureReason !== null  // Indicate if failure was notified
    };
  }
}

/**
 * Get current safety session status
 *
 * @returns {Object} Session status
 */
export function getSafetySessionStatus() {
  return {
    sessionState: trackingState.sessionState,
    activeSessionId: trackingState.activeSessionId,
    activeWatcherId: trackingState.activeWatcherId,
    stuckWatcherId: trackingState.stuckWatcherId,
    failureReason: trackingState.failureReason,
    cleanupAttempts: trackingState.cleanupAttempts,
    cleanupStage: trackingState.cleanupStage,
    permissionsInitialized: trackingState.permissionsInitialized,
    // Include permission manager status
    permissionManagerStatus: getCurrentSessionStatus()
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Validate session start options
 *
 * @param {Object} options - Session options
 * @returns {Object} Validation result
 */
function validateSessionOptions(options) {
  const errors = [];

  // Validate backgroundMessage (REQUIRED for background tracking)
  if (options.backgroundMessage === undefined || options.backgroundMessage === null) {
    errors.push('backgroundMessage is required for background tracking');
  } else if (typeof options.backgroundMessage !== 'string') {
    errors.push('backgroundMessage must be a string');
  } else if (options.backgroundMessage.trim() === '') {
    errors.push('backgroundMessage cannot be empty');
  } else if (options.backgroundMessage.length > 200) {
    errors.push('backgroundMessage too long (max 200 characters)');
  }

  // Validate backgroundTitle (optional)
  if (options.backgroundTitle !== undefined) {
    if (typeof options.backgroundTitle !== 'string') {
      errors.push('backgroundTitle must be a string');
    } else if (options.backgroundTitle.trim() === '') {
      errors.push('backgroundTitle cannot be empty');
    } else if (options.backgroundTitle.length > 100) {
      errors.push('backgroundTitle too long (max 100 characters)');
    }
  }

  // Validate distanceFilter (optional)
  if (options.distanceFilter !== undefined) {
    if (typeof options.distanceFilter !== 'number') {
      errors.push('distanceFilter must be a number');
    } else if (!Number.isFinite(options.distanceFilter)) {
      errors.push('distanceFilter must be finite');
    } else if (options.distanceFilter < 0) {
      errors.push('distanceFilter cannot be negative');
    } else if (options.distanceFilter > 10000) {
      errors.push('distanceFilter too large (max 10000 meters)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate cryptographically secure session ID
 * Format: session_<timestamp>_<uuid>
 *
 * Fallback chain:
 * 1. crypto.randomUUID() (WebView 92+)
 * 2. Custom UUID v4 using crypto.getRandomValues()
 * 3. Timestamp + Math.random() (not cryptographically secure)
 *
 * @returns {string} Session ID
 */
function generateSessionId() {
  const timestamp = Date.now();

  // Try crypto.randomUUID() if available (WebView 92+)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      const uuid = crypto.randomUUID();
      return `session_${timestamp}_${uuid}`;
    } catch (error) {
      console.warn('crypto.randomUUID() failed, using fallback:', error);
    }
  }

  // Fallback: Custom UUID v4 using crypto.getRandomValues()
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const uuid = generateUUIDv4();
      return `session_${timestamp}_${uuid}`;
    } catch (error) {
      console.warn('crypto.getRandomValues() failed, using final fallback:', error);
    }
  }

  // Final fallback: Timestamp + Math.random() (not cryptographically secure)
  console.warn('Using non-cryptographic session ID generation');
  const random1 = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `session_${timestamp}_${random1}${random2}`;
}

/**
 * Generate UUID v4 using crypto.getRandomValues()
 * RFC 4122 compliant
 *
 * @returns {string} UUID v4
 */
function generateUUIDv4() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version (4) and variant bits per RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

  // Convert to UUID string format
  const hexString = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  return `${hexString.slice(0, 8)}-${hexString.slice(8, 12)}-${hexString.slice(12, 16)}-${hexString.slice(16, 20)}-${hexString.slice(20)}`;
}

/**
 * Handle location update with buffering for early arrivals
 * CRITICAL: May be called BEFORE notifySessionStarted() completes
 *
 * @param {Object|undefined} location - Location object or undefined
 * @param {Object|undefined} error - Error object or undefined
 * @param {number} generation - Callback generation at time of registration
 */
function handleLocationUpdateWithBuffering(location, error, generation) {
  // STEP 1: Check if callback is stale
  if (isCallbackStale(generation)) {
    console.warn('Ignoring callback from stale generation:', generation);
    return;
  }

  // STEP 2: Check current session state
  const currentState = trackingState.sessionState;

  if (currentState === SessionState.WATCHER_REGISTERING) {
    // EARLY CALLBACK: Watcher registered but notifySessionStarted() not yet called
    // Buffer this callback for later processing

    // Check buffer limit
    if (trackingState.earlyCallbackBuffer.length >= trackingState.maxBufferSize) {
      console.warn('Early callback buffer full - dropping oldest callback');
      trackingState.earlyCallbackBuffer.shift(); // Remove oldest
    }

    trackingState.earlyCallbackBuffer.push({
      location,
      error,
      timestamp: Date.now(),
      generation
    });

    console.log('Buffered early callback (buffer size:', trackingState.earlyCallbackBuffer.length, ')');
    return;
  }

  if (currentState === SessionState.ACTIVE) {
    // NORMAL CALLBACK: Session is active, process immediately
    processLocationUpdate(location, error);
    return;
  }

  // Callback arrived in wrong state (IDLE, STARTING, STOPPING, or FAILED_*)
  console.warn('Ignoring callback in state:', currentState);
}

/**
 * Process buffered early callbacks in original order
 * Called after notifySessionStarted() succeeds
 *
 * @returns {number} Count of processed callbacks
 */
function processBufferedCallbacks() {
  // Guard against re-processing
  if (trackingState.bufferProcessed) {
    console.warn('Buffer already processed - skipping');
    return 0;
  }

  const buffer = trackingState.earlyCallbackBuffer;
  const count = buffer.length;

  if (count === 0) {
    trackingState.bufferProcessed = true;
    return 0;
  }

  console.log('Processing', count, 'buffered callbacks');

  // Process in original order
  for (const buffered of buffer) {
    // Verify generation still valid (session not stopped during processing)
    if (isCallbackStale(buffered.generation)) {
      console.warn('Skipping buffered callback from stale generation');
      continue;
    }

    processLocationUpdate(buffered.location, buffered.error);
  }

  // Clear buffer and mark as processed
  trackingState.earlyCallbackBuffer = [];
  trackingState.bufferProcessed = true;

  return count;
}

/**
 * Process a location update (after buffering resolved)
 * ASSUMPTION: Session is in ACTIVE state
 *
 * @param {Object|undefined} location - Location object or undefined
 * @param {Object|undefined} error - Error object or undefined
 */
function processLocationUpdate(location, error) {
  // STEP 1: Handle error case
  if (error) {
    handleLocationError(error);
    return;
  }

  // STEP 2: Validate location
  if (!location) {
    console.warn('Received null location without error - ignoring');
    return;
  }

  // STEP 3: Extract timestamp from plugin's location object
  const timestamp = location.time;
  if (timestamp === null || timestamp === undefined) {
    console.warn('Location missing timestamp - cannot record');
    return;
  }

  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    console.error('Location timestamp invalid:', timestamp);
    return;
  }

  // STEP 4: Get app state from permission manager
  const sessionStatus = getCurrentSessionStatus();
  const appState = sessionStatus.appState.isActive;

  // STEP 5: Classify and record based on app state
  let recordResult;

  if (appState === true) {
    // FOREGROUND: App is confirmed in foreground
    recordResult = recordForegroundUpdate(timestamp);
  } else if (appState === false) {
    // BACKGROUND: App is confirmed in background
    recordResult = recordBackgroundUpdate(timestamp);
  } else {
    // UNKNOWN: App state not yet determined (null)
    // CRITICAL: Never classify UNKNOWN as background
    console.warn('App state UNKNOWN - cannot classify location update');
    return;
  }

  // STEP 6: Handle recording result
  if (!recordResult.success) {
    console.warn('Location rejected by permission manager:', recordResult.reason);

    // Special handling for certain rejection reasons
    if (recordResult.reason === 'gap_detected') {
      console.warn('Background tracking gap detected:', recordResult.gap, 'ms');
      // TODO Phase 3: Notify UI of gap detection
    }
  } else {
    console.log('Location recorded:', {
      foreground: appState === true,
      verified: recordResult.verified,
      timestamp
    });
    // TODO Phase 6: Send to backend
  }
}

/**
 * Handle location error from callback
 *
 * @param {Object} error - Error object with code and message
 */
function handleLocationError(error) {
  console.error('Location error:', error);

  // Check for permission revocation
  if (error.code === 'NOT_AUTHORIZED') {
    // Permission revoked during session
    console.error('Permission revoked during active session');
    initiateFailureCleanup('permission_revoked_during_session');
  } else {
    // Other error (GPS unavailable, etc.) - log but don't fail session
    console.warn('Non-permission location error:', error.message);
  }
}

/**
 * Initiate session failure cleanup
 * Prevents concurrent failure handling
 * Does NOT call notifySessionFailed() until watcher is removed
 *
 * @param {string} reason - Failure reason
 */
async function initiateFailureCleanup(reason) {
  // Guard against concurrent failure handling
  if (trackingState.failureInProgress) {
    console.warn('Failure cleanup already in progress');
    return;
  }

  // Guard against already-failed states
  if (trackingState.sessionState === SessionState.FAILED_PERMISSION_REVOKED ||
      trackingState.sessionState === SessionState.FAILED_WATCHER_STUCK) {
    console.warn('Already in failed state:', trackingState.sessionState);
    return;
  }

  try {
    trackingState.failureInProgress = true;

    // STEP 1: Preserve failure reason for potential retry scenario
    trackingState.failureReason = reason;

    // STEP 2: Transition to failure state
    trackingState.sessionState = SessionState.FAILED_PERMISSION_REVOKED;

    // STEP 3: Invalidate callback generation to prevent further processing
    trackingState.callbackGeneration++;
    trackingState.watcherCallback = null;
    trackingState.earlyCallbackBuffer = [];

    // STEP 4: Attempt to remove watcher
    const watcherId = trackingState.activeWatcherId;
    if (!watcherId) {
      // No watcher to remove (should not happen, but handle gracefully)
      console.warn('No active watcher during failure cleanup');
      trackingState.activeSessionId = null;
      trackingState.failureReason = null;  // Clear reason since we're notifying immediately
      trackingState.sessionState = SessionState.IDLE;
      trackingState.failureInProgress = false;

      // Now safe to call notifySessionFailed
      notifySessionFailed(reason);
      return;
    }

    let removalSucceeded = false;
    try {
      await BackgroundGeolocation.removeWatcher({ id: watcherId });
      removalSucceeded = true;
    } catch (removeError) {
      console.error('Watcher removal failed during failure cleanup:', removeError);
      // Watcher stuck - transition to stuck state
      trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
      trackingState.stuckWatcherId = watcherId;
      trackingState.cleanupAttempts = 1;
      trackingState.failureInProgress = false;

      // Cannot call notifySessionFailed yet - watcher still active
      console.error('Session failed but watcher is stuck - call retryCleanup()');
      return;
    }

    // STEP 4: Watcher removed successfully - reset permission state
    if (removalSucceeded) {
      const resetResult = resetSessionState();

      // STEP 5: Call notifySessionFailed (after reset)
      notifySessionFailed(reason);

      // STEP 6: Clear tracking state
      trackingState.activeWatcherId = null;
      trackingState.activeSessionId = null;
      trackingState.failureReason = null;  // Clear reason after successful notification
      trackingState.sessionState = SessionState.IDLE;
      trackingState.failureInProgress = false;
    }
  } catch (error) {
    // Ensure failureInProgress is released even on unexpected error
    console.error('Unexpected error during failure cleanup:', error);
    trackingState.failureInProgress = false;
  }
}

/**
 * Check if callback is from a stopped session
 *
 * @param {number} generation - Callback generation at time of registration
 * @returns {boolean} True if callback is stale
 */
function isCallbackStale(generation) {
  return generation !== trackingState.callbackGeneration;
}

/**
 * Provide guidance for invalid state transitions
 *
 * @param {string} currentState - Current session state
 * @returns {string} User-friendly guidance message
 */
function getStateTransitionGuidance(currentState) {
  const guidance = {
    [SessionState.IDLE]: 'Ready to start new session with startSafetySession()',
    [SessionState.STARTING]: 'Session startup in progress - wait for completion',
    [SessionState.WATCHER_REGISTERING]: 'Watcher registration in progress - wait for completion',
    [SessionState.ACTIVE]: 'Session already active - stop current session first with stopSafetySession()',
    [SessionState.STOPPING]: 'Session stop in progress - wait for completion',
    [SessionState.FAILED_WATCHER_STUCK]: 'Watcher removal failed - call retryCleanup() before starting new session',
    [SessionState.FAILED_PERMISSION_REVOKED]: 'Permission revoked - cleanup in progress'
  };

  return guidance[currentState] || 'Unknown state';
}