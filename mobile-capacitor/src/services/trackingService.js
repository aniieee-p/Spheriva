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
import { apiService } from './api.service';
import { storageService } from './storage.service';

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
  FAILED_PERMISSION_REVOKED: 'failed_permission_revoked',
  BACKEND_END_PENDING: 'backend_end_pending',
  BACKEND_CREATE_UNKNOWN: 'backend_create_unknown',
  BACKEND_CREATE_CONFLICT: 'backend_create_conflict',
  WATCHER_RECONCILIATION_PENDING: 'watcher_reconciliation_pending'
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
  cancelStartRequested: false,
  startCompletionPromise: null,
  recoveryPromise: null,
  recoveryOwnerId: null,

  // Session lifecycle
  sessionState: SessionState.IDLE,

  // Active session identifiers
  activeSessionId: null,
  activeSessionOwnerId: null,
  activeWatcherId: null,
  backendCleanupPending: false,
  backendSessionEnded: false,
  watcherCleanupPending: false,
  recoveryReason: null,

  // Callback management
  watcherCallback: null,
  callbackGeneration: 0,

  // Early callback buffering
  earlyCallbackBuffer: [],
  maxBufferSize: 10,
  bufferProcessed: false,
  acceptingLocationUploads: false,
  locationUploadPromise: null,
  pendingLocationUpload: null,
  locationSyncPending: false,
  lastQueuedLocationTimestamp: null,
  lastUploadedLocationTimestamp: null,

  // Failure state tracking
  failureInProgress: false,
  stuckWatcherId: null,
  failureReason: null,  // Preserve original failure reason for retry scenarios

  // Cleanup retry tracking
  cleanupAttempts: 0,
  maxCleanupAttempts: 3,  // Recommended limit (not enforced)
  cleanupStage: CleanupStage.NONE
};

const isValidBackendSessionId = (sessionId) =>
  typeof sessionId === 'string' && /^[a-f\d]{24}$/i.test(sessionId);

const watcherMayExistForLifecycle = (lifecycleState) => [
  'watcher_registering',
  'watcher_registered',
  'active',
  'watcher_cleanup_pending',
  'watcher_reconciliation_pending',
  'server_session_watcher_unknown',
  'legacy_unknown'
].includes(lifecycleState);

const isUnownedSessionLifecycle = (lifecycleState) => [
  'create_conflict',
  'create_result_unknown_active_session',
  'server_session_watcher_unknown'
].includes(lifecycleState);

const resetActiveTrackingState = () => {
  trackingState.activeSessionId = null;
  trackingState.activeSessionOwnerId = null;
  trackingState.activeWatcherId = null;
  trackingState.backendCleanupPending = false;
  trackingState.backendSessionEnded = false;
  trackingState.watcherCleanupPending = false;
  trackingState.recoveryReason = null;
  trackingState.acceptingLocationUploads = false;
  trackingState.pendingLocationUpload = null;
  trackingState.locationSyncPending = false;
  trackingState.lastQueuedLocationTimestamp = null;
  trackingState.lastUploadedLocationTimestamp = null;
  trackingState.locationUploadPromise = null;
  trackingState.sessionState = SessionState.IDLE;
  trackingState.cleanupStage = CleanupStage.NONE;
  trackingState.stuckWatcherId = null;
  trackingState.cleanupAttempts = 0;
  trackingState.failureReason = null;
  if (!trackingState.startCompletionPromise) {
    trackingState.cancelStartRequested = false;
  }
};

const persistTrackingState = async (lifecycleState, overrides = {}) => {
  const ownerId = overrides.userId || trackingState.activeSessionOwnerId;
  if (!ownerId) throw new Error('Authenticated user ID is required to persist tracking state');

  await storageService.saveSessionTrackingState(ownerId, {
    sessionId: overrides.sessionId !== undefined
      ? overrides.sessionId
      : trackingState.activeSessionId,
    watcherId: overrides.watcherId !== undefined
      ? overrides.watcherId
      : trackingState.activeWatcherId || trackingState.stuckWatcherId || null,
    lifecycleState,
    backendEnded: overrides.backendEnded !== undefined
      ? overrides.backendEnded
      : trackingState.backendSessionEnded
  });
};

const completeBackendSession = async (sessionId, ownerId, skipBackendEnd = false) => {
  trackingState.backendCleanupPending = true;

  let persistenceError = null;
  try {
    await persistTrackingState('backend_cleanup_pending', {
      userId: ownerId,
      sessionId,
      watcherId: null
    });
  } catch (error) {
    console.error('Failed to persist pending backend session cleanup:', error);
    persistenceError = error;
  }

  if (skipBackendEnd) {
    trackingState.sessionState = SessionState.BACKEND_END_PENDING;
    if (persistenceError) {
      return {
        success: false,
        reason: 'cleanup_persistence_failed',
        error: persistenceError.message
      };
    }
    return { success: false, reason: 'backend_end_pending', skipped: true };
  }

  if (!trackingState.backendSessionEnded) {
    try {
      const response = await apiService.endSession(sessionId);
      if (!response?.success) {
        throw new Error(response?.message || 'Backend did not confirm session ending');
      }
    } catch (error) {
      if (error.status !== 409) {
        console.error('Failed to end backend safety session:', error);
        trackingState.sessionState = SessionState.BACKEND_END_PENDING;
        return {
          success: false,
          reason: persistenceError ? 'cleanup_persistence_failed' : 'backend_end_pending',
          error: error.message
        };
      }
    }

    trackingState.backendSessionEnded = true;
    try {
      await persistTrackingState('backend_cleanup_pending', {
        userId: ownerId,
        sessionId,
        watcherId: null,
        backendEnded: true
      });
    } catch (error) {
      console.error('Failed to persist completed backend session state:', error);
    }
  }

  try {
    await storageService.clearSessionTrackingState(ownerId, sessionId);
  } catch (error) {
    console.error('Backend session ended but pending cleanup state could not be cleared:', error);
    trackingState.sessionState = SessionState.BACKEND_END_PENDING;
    return {
      success: false,
      reason: 'cleanup_persistence_failed',
      error: error.message
    };
  }

  return { success: true };
};

const endPersistedBackendSession = async (userId, sessionId) => {
  if (trackingState.backendSessionEnded) return { success: true };

  try {
    const response = await apiService.endSession(sessionId);
    if (!response?.success) {
      throw new Error(response?.message || 'Backend did not confirm session ending');
    }
    trackingState.backendSessionEnded = true;
  } catch (error) {
    if (error.status === 409) {
      trackingState.backendSessionEnded = true;
    } else {
      console.error('Failed to end backend session during recovery:', error);
      trackingState.backendCleanupPending = true;
      return { success: false, error };
    }
  }

  trackingState.backendCleanupPending = false;
  try {
    await persistTrackingState(
      trackingState.watcherCleanupPending
        ? (trackingState.activeWatcherId ? 'watcher_cleanup_pending' : 'watcher_reconciliation_pending')
        : 'backend_cleanup_pending',
      {
        userId,
        sessionId,
        watcherId: trackingState.activeWatcherId || trackingState.stuckWatcherId || null,
        backendEnded: true
      }
    );
  } catch (error) {
    console.error('Failed to persist backend session recovery result:', error);
    return { success: false, error, backendEnded: true };
  }
  return { success: true };
};

const resolveStoredSessionCleanup = async (userId, { skipBackendEnd = false } = {}) => {
  const pending = await storageService.getPendingSessionCleanup(userId);
  if (!pending) return { success: true, found: false };

  trackingState.activeSessionOwnerId = String(userId);
  trackingState.activeSessionId = isUnownedSessionLifecycle(pending.lifecycleState)
    ? null
    : pending.sessionId || null;
  trackingState.activeWatcherId = pending.watcherId || null;
  trackingState.stuckWatcherId = null;
  trackingState.backendSessionEnded = pending.backendEnded === true;
  trackingState.backendCleanupPending = true;
  trackingState.watcherCleanupPending = false;

  let watcherRemoved = false;
  if (isUnownedSessionLifecycle(pending.lifecycleState) && pending.watcherId) {
    try {
      await BackgroundGeolocation.removeWatcher({ id: pending.watcherId });
    } catch (error) {
      trackingState.activeWatcherId = pending.watcherId;
      trackingState.stuckWatcherId = pending.watcherId;
      trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
      trackingState.watcherCleanupPending = true;
      trackingState.recoveryReason = 'watcher_removal_failed';
      return {
        success: false,
        found: true,
        reason: 'watcher_removal_failed',
        backendCleanupPending: true,
        watcherCleanupPending: true,
        sessionId: null,
        error: error.message
      };
    }

    watcherRemoved = true;
    trackingState.activeWatcherId = null;
    trackingState.stuckWatcherId = null;
    try {
      await storageService.saveSessionTrackingState(userId, {
        ...pending,
        watcherId: null
      });
    } catch (error) {
      console.error('Could not persist watcher removal for unowned session:', error);
      trackingState.sessionState = SessionState.BACKEND_CREATE_UNKNOWN;
      trackingState.watcherCleanupPending = false;
      trackingState.recoveryReason = 'backend_session_id_unknown';
      return {
        success: false,
        found: true,
        reason: 'cleanup_persistence_failed',
        backendCleanupPending: true,
        watcherCleanupPending: false,
        sessionId: null,
        error: error.message
      };
    }
  }

  if (pending.lifecycleState === 'create_conflict') {
    trackingState.sessionState = SessionState.BACKEND_CREATE_CONFLICT;
    trackingState.recoveryReason = 'active_session_already_exists';
    return {
      success: false,
      found: true,
      reason: 'active_session_already_exists',
      backendCleanupPending: true,
      watcherCleanupPending: false,
      sessionId: null
    };
  }

  if (isUnownedSessionLifecycle(pending.lifecycleState)) {
    const watcherMayExist = !watcherRemoved &&
      watcherMayExistForLifecycle(pending.lifecycleState);
    trackingState.sessionState = watcherMayExist
      ? SessionState.WATCHER_RECONCILIATION_PENDING
      : SessionState.BACKEND_CREATE_UNKNOWN;
    trackingState.watcherCleanupPending = watcherMayExist;
    trackingState.recoveryReason = watcherMayExist
      ? 'watcher_id_unavailable'
      : 'backend_session_id_unknown';
    return {
      success: false,
      found: true,
      reason: trackingState.recoveryReason,
      backendCleanupPending: true,
      watcherCleanupPending: watcherMayExist,
      sessionId: null
    };
  }

  if (!isValidBackendSessionId(pending.sessionId)) {
    const lifecycleState = pending.lifecycleState || 'legacy_unknown';
    let watcherMayExist = Boolean(pending.watcherId) ||
      watcherMayExistForLifecycle(lifecycleState);

    if (pending.watcherId) {
      try {
        await BackgroundGeolocation.removeWatcher({ id: pending.watcherId });
      } catch (error) {
        trackingState.activeWatcherId = pending.watcherId;
        trackingState.stuckWatcherId = pending.watcherId;
        trackingState.watcherCleanupPending = true;
        trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
        trackingState.recoveryReason = 'watcher_removal_failed';
        try {
          await persistTrackingState('watcher_cleanup_pending', {
            userId: String(userId),
            sessionId: null,
            watcherId: pending.watcherId
          });
        } catch (persistenceError) {
          console.error('Failed to persist watcher ID during recovery:', persistenceError);
        }
        return {
          success: false,
          found: true,
          reason: 'watcher_removal_failed',
          backendCleanupPending: true,
          watcherCleanupPending: true,
          sessionId: null,
          error: error.message
        };
      }
      trackingState.activeWatcherId = null;
      watcherMayExist = false;
      try {
        await persistTrackingState('create_response_unknown', {
          userId: String(userId),
          sessionId: null,
          watcherId: null
        });
      } catch (error) {
        console.error('Failed to persist watcher removal during unknown-session recovery:', error);
      }
    }

    trackingState.sessionState = watcherMayExist
      ? SessionState.WATCHER_RECONCILIATION_PENDING
      : SessionState.BACKEND_CREATE_UNKNOWN;
    trackingState.watcherCleanupPending = watcherMayExist;
    trackingState.backendCleanupPending = !trackingState.backendSessionEnded;
    trackingState.recoveryReason = watcherMayExist
      ? 'watcher_id_unavailable'
      : 'backend_session_id_unknown';
    try {
      await persistTrackingState(
        watcherMayExist ? 'watcher_reconciliation_pending' : 'create_response_unknown',
        {
          userId: String(userId),
          sessionId: null,
          watcherId: null
        }
      );
    } catch (error) {
      console.error('Failed to persist incomplete session recovery state:', error);
    }
    return {
      success: false,
      found: true,
      reason: watcherMayExist ? 'watcher_id_unavailable' : 'backend_session_id_unknown',
      backendCleanupPending: !trackingState.backendSessionEnded,
      watcherCleanupPending: watcherMayExist,
      sessionId: null
    };
  }

  const lifecycleState = pending.lifecycleState || 'legacy_unknown';
  const watcherMayExistWithoutId = !pending.watcherId &&
    watcherMayExistForLifecycle(lifecycleState);

  if (pending.watcherId) {
    try {
      await BackgroundGeolocation.removeWatcher({ id: pending.watcherId });
    } catch (error) {
      trackingState.stuckWatcherId = pending.watcherId;
      trackingState.activeWatcherId = pending.watcherId;
      trackingState.watcherCleanupPending = true;
      trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
      trackingState.recoveryReason = 'watcher_removal_failed';
      const backendResult = skipBackendEnd
        ? { success: false, skipped: true }
        : await endPersistedBackendSession(String(userId), pending.sessionId);
      try {
        await persistTrackingState('watcher_cleanup_pending');
      } catch (persistenceError) {
        console.error('Failed to persist watcher cleanup state:', persistenceError);
      }
      return {
        success: false,
        found: true,
        reason: 'watcher_removal_failed',
        backendCleanupPending: !trackingState.backendSessionEnded,
        watcherCleanupPending: true,
        sessionId: pending.sessionId,
        error: error.message || backendResult.error?.message
      };
    }
    trackingState.activeWatcherId = null;
    trackingState.stuckWatcherId = null;
    trackingState.watcherCleanupPending = false;
    try {
      await persistTrackingState('backend_cleanup_pending', {
        userId: String(userId),
        sessionId: pending.sessionId,
        watcherId: null
      });
    } catch (error) {
      console.error('Failed to persist watcher removal during session recovery:', error);
    }
  } else if (watcherMayExistWithoutId) {
    trackingState.watcherCleanupPending = true;
    trackingState.sessionState = SessionState.WATCHER_RECONCILIATION_PENDING;
    trackingState.recoveryReason = 'watcher_id_unavailable';
    try {
      await persistTrackingState('watcher_reconciliation_pending', {
        userId: String(userId),
        sessionId: pending.sessionId,
        watcherId: null,
        backendEnded: trackingState.backendSessionEnded
      });
    } catch (error) {
      console.error('Failed to persist unresolved watcher reconciliation:', error);
    }

    return {
      success: false,
      found: true,
      reason: 'watcher_id_unavailable',
      backendCleanupPending: true,
      watcherCleanupPending: true,
      sessionId: pending.sessionId
    };
  }

  const result = await completeBackendSession(
    pending.sessionId,
    String(userId),
    skipBackendEnd
  );
  if (result.success) {
    resetActiveTrackingState();
    return { ...result, found: true };
  }

  trackingState.sessionState = SessionState.BACKEND_END_PENDING;
  trackingState.recoveryReason = result.reason;
  return {
    ...result,
    found: true,
    backendCleanupPending: true,
    watcherCleanupPending: false,
    sessionId: pending.sessionId
  };
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

const recoverSafetySessionInternal = async (userId) => {
  const ownerId = userId ? String(userId) : '';
  if (!ownerId) return { success: false, reason: 'authentication_required' };

  if (
    trackingState.sessionState !== SessionState.IDLE &&
    trackingState.activeSessionOwnerId &&
    trackingState.activeSessionOwnerId !== ownerId
  ) {
    return {
      success: false,
      reason: 'another_user_session_in_memory',
      cleanupPending: true,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: trackingState.watcherCleanupPending
    };
  }

  const liveSessionIsKnown = trackingState.sessionState === SessionState.ACTIVE &&
    trackingState.activeSessionOwnerId === ownerId &&
    isValidBackendSessionId(trackingState.activeSessionId) &&
    typeof trackingState.activeWatcherId === 'string' &&
    trackingState.activeWatcherId.length > 0;
  let pending;
  try {
    pending = await storageService.getPendingSessionCleanup(ownerId);
  } catch (error) {
    trackingState.activeSessionOwnerId = ownerId;
    trackingState.sessionState = SessionState.BACKEND_CREATE_UNKNOWN;
    trackingState.backendCleanupPending = true;
    trackingState.recoveryReason = 'tracking_state_read_failed';
    console.error('Safety session recovery could not read local tracking state:', error);
    return {
      success: false,
      reason: 'tracking_state_read_failed',
      cleanupPending: true,
      backendCleanupPending: true,
      watcherCleanupPending: trackingState.watcherCleanupPending,
      error: error.message
    };
  }

  let activeSession;
  try {
    const response = await apiService.getActiveSession();
    activeSession = response?.data?.session;
    if (
      response?.success !== true ||
      (activeSession !== null &&
        (!activeSession || !isValidBackendSessionId(activeSession._id)))
    ) {
      throw new Error('Backend returned an invalid active safety session response');
    }
  } catch (error) {
    if (liveSessionIsKnown) {
      console.error('Could not verify the active backend session:', error);
      return {
        success: false,
        reason: 'active_session_lookup_failed',
        activeSession: true,
        sessionId: trackingState.activeSessionId,
        error: error.message
      };
    }

    trackingState.activeSessionOwnerId = ownerId;
    trackingState.activeSessionId = pending?.sessionId || null;
    trackingState.activeWatcherId = pending?.watcherId || null;
    trackingState.watcherCleanupPending = Boolean(
      pending?.watcherId ||
      watcherMayExistForLifecycle(pending?.lifecycleState)
    );
    trackingState.backendCleanupPending = true;
    trackingState.sessionState = trackingState.watcherCleanupPending
      ? SessionState.WATCHER_RECONCILIATION_PENDING
      : SessionState.BACKEND_CREATE_UNKNOWN;
    trackingState.recoveryReason = 'active_session_lookup_failed';

    if (!pending) {
      try {
        await persistTrackingState('active_session_lookup_pending', {
          userId: ownerId,
          sessionId: null,
          watcherId: null,
          backendEnded: false
        });
      } catch (persistenceError) {
        console.error('Could not persist active session lookup state:', persistenceError);
      }
    }

    console.error('Safety session recovery could not query the backend:', error);
    return {
      success: false,
      reason: 'active_session_lookup_failed',
      cleanupPending: true,
      backendCleanupPending: true,
      watcherCleanupPending: trackingState.watcherCleanupPending,
      sessionId: trackingState.activeSessionId,
      error: error.message
    };
  }

  const serverSessionId = activeSession?._id || null;

  if (pending?.lifecycleState === 'create_conflict') {
    if (serverSessionId) {
      trackingState.activeSessionOwnerId = ownerId;
      trackingState.activeSessionId = null;
      trackingState.activeWatcherId = null;
      trackingState.backendCleanupPending = true;
      trackingState.backendSessionEnded = false;
      trackingState.watcherCleanupPending = false;
      trackingState.sessionState = SessionState.BACKEND_CREATE_CONFLICT;
      trackingState.recoveryReason = 'active_session_already_exists';
      return {
        success: false,
        found: true,
        reason: 'active_session_already_exists',
        cleanupPending: true,
        backendCleanupPending: true,
        watcherCleanupPending: false,
        sessionId: null,
        note: 'An active safety session already exists for this account. This device did not create it, so it was not changed.'
      };
    }

    await storageService.clearSessionTrackingState(
      ownerId,
      pending.sessionId,
      pending.lifecycleState
    );
    resetActiveTrackingState();
    return { success: true, recovered: true };
  }

  const createOutcomeUnknown = [
    'creating_backend_session',
    'create_response_unknown',
    'create_result_unknown_active_session'
  ].includes(pending?.lifecycleState);

  if (createOutcomeUnknown) {
    if (serverSessionId) {
      trackingState.activeSessionOwnerId = ownerId;
      trackingState.activeSessionId = null;
      trackingState.activeWatcherId = null;
      trackingState.backendCleanupPending = true;
      trackingState.backendSessionEnded = false;
      trackingState.watcherCleanupPending = false;
      trackingState.sessionState = SessionState.BACKEND_CREATE_UNKNOWN;
      trackingState.recoveryReason = 'backend_session_id_unknown';
      try {
        await storageService.saveSessionTrackingState(ownerId, {
          ...pending,
          userId: ownerId,
          sessionId: null,
          unownedSessionId: serverSessionId,
          watcherId: null,
          lifecycleState: 'create_result_unknown_active_session',
          backendEnded: false
        });
      } catch (error) {
        console.error('Could not persist ambiguous active session state:', error);
      }
      return {
        success: false,
        found: true,
        reason: 'backend_session_id_unknown',
        cleanupPending: true,
        backendCleanupPending: true,
        watcherCleanupPending: false,
        sessionId: null,
        note: 'The server has an active session, but this device cannot verify that it created it. The session was not changed; resolve it from the device that started it.'
      };
    }

    await storageService.clearSessionTrackingState(
      ownerId,
      pending.sessionId,
      pending.lifecycleState
    );
    resetActiveTrackingState();
    return {
      success: true,
      recovered: true,
      backendSessionEnded: true
    };
  }

  if (
    pending?.lifecycleState === 'server_session_watcher_unknown' &&
    pending.unownedSessionId
  ) {
    trackingState.activeSessionOwnerId = ownerId;
    trackingState.activeSessionId = null;
    trackingState.activeWatcherId = null;
    trackingState.backendCleanupPending = Boolean(serverSessionId);
    trackingState.backendSessionEnded = !serverSessionId;
    trackingState.watcherCleanupPending = true;
    trackingState.sessionState = SessionState.WATCHER_RECONCILIATION_PENDING;
    trackingState.recoveryReason = 'watcher_id_unavailable';
    return {
      success: false,
      found: true,
      reason: 'watcher_id_unavailable',
      cleanupPending: true,
      backendCleanupPending: Boolean(serverSessionId),
      watcherCleanupPending: true,
      sessionId: null,
      note: serverSessionId
        ? 'An active server session exists, but this device cannot confirm its ownership or discover the native watcher. No session was changed.'
        : 'The server session is no longer active, but the native watcher ID is unknown. Tracking remains blocked until watcher state is reconciled.'
    };
  }

  if (liveSessionIsKnown) {
    if (serverSessionId === trackingState.activeSessionId) {
      return {
        success: true,
        recovered: false,
        sessionId: trackingState.activeSessionId
      };
    }

    const stopped = await stopSafetySession();
    if (!stopped.success) return { ...stopped, cleanupPending: true };
    if (!serverSessionId) return { success: true, recovered: true };
    pending = await storageService.getPendingSessionCleanup(ownerId);
  }

  if (!serverSessionId) {
    if (isUnownedSessionLifecycle(pending?.lifecycleState)) {
      const watcherUnknown =
        pending.lifecycleState === 'server_session_watcher_unknown';
      trackingState.activeSessionOwnerId = ownerId;
      trackingState.activeSessionId = null;
      trackingState.activeWatcherId = null;
      trackingState.backendCleanupPending = false;
      trackingState.backendSessionEnded = true;
      trackingState.watcherCleanupPending = watcherUnknown;
      trackingState.sessionState = watcherUnknown
        ? SessionState.WATCHER_RECONCILIATION_PENDING
        : SessionState.BACKEND_CREATE_UNKNOWN;
      trackingState.recoveryReason = watcherUnknown
        ? 'watcher_id_unavailable'
        : pending.lifecycleState === 'create_conflict'
          ? null
          : 'backend_session_id_unknown';

      if (pending.lifecycleState === 'create_conflict') {
        await storageService.clearSessionTrackingState(
          ownerId,
          pending.sessionId,
          pending.lifecycleState
        );
        resetActiveTrackingState();
        return { success: true, recovered: true };
      }

      return {
        success: false,
        found: true,
        reason: trackingState.recoveryReason,
        cleanupPending: true,
        backendCleanupPending: false,
        watcherCleanupPending: watcherUnknown,
        sessionId: null,
        note: watcherUnknown
          ? 'The server session has ended, but the native watcher ID is unknown. Tracking remains blocked.'
          : 'The previous create result remains ambiguous. The app will not assume ownership or start another session.'
      };
    }

    if (!pending) {
      if (trackingState.sessionState !== SessionState.IDLE) {
        resetActiveTrackingState();
      }
      trackingState.activeSessionOwnerId = null;
      return { success: true, recovered: false };
    }

    const lifecycleState = pending.lifecycleState || 'legacy_unknown';
    const canHaveNoWatcher = !pending.watcherId &&
      ['creating_backend_session', 'backend_session_created',
        'active_session_lookup_pending'].includes(lifecycleState);

    if (canHaveNoWatcher) {
      await storageService.clearSessionTrackingState(
        ownerId,
        pending.sessionId,
        lifecycleState
      );
      resetActiveTrackingState();
      return { success: true, recovered: true, backendSessionEnded: true };
    }

    const result = await resolveStoredSessionCleanup(ownerId);
    return {
      ...result,
      cleanupPending: !result.success,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: trackingState.watcherCleanupPending,
      sessionId: trackingState.activeSessionId,
      recoveryReason: trackingState.recoveryReason
    };
  }

  if (pending && pending.sessionId !== serverSessionId) {
    const localCreateHadNoWatcher = !pending.watcherId &&
      ['creating_backend_session', 'create_response_unknown', 'backend_session_created',
        'active_session_lookup_pending'].includes(pending.lifecycleState);

    if (localCreateHadNoWatcher) {
      await storageService.clearSessionTrackingState(
        ownerId,
        pending.sessionId,
        pending.lifecycleState
      );
      pending = null;
      resetActiveTrackingState();
    } else {
      const localCleanup = await resolveStoredSessionCleanup(ownerId);
      if (!localCleanup.success) {
        return {
          ...localCleanup,
          cleanupPending: true,
          backendCleanupPending: trackingState.backendCleanupPending,
          watcherCleanupPending: trackingState.watcherCleanupPending,
          sessionId: trackingState.activeSessionId,
          recoveryReason: trackingState.recoveryReason
        };
      }
      pending = await storageService.getPendingSessionCleanup(ownerId);
      if (pending) {
        return {
          success: false,
          reason: 'active_session_state_mismatch',
          cleanupPending: true,
          backendCleanupPending: true,
          watcherCleanupPending: trackingState.watcherCleanupPending,
          sessionId: pending.sessionId
        };
      }
      resetActiveTrackingState();
    }
  }

  if (pending) {
    const lifecycleState = pending.lifecycleState || 'legacy_unknown';
    const createTimedOutBeforeWatcher = !pending.watcherId &&
      ['creating_backend_session', 'create_response_unknown', 'backend_session_created',
        'active_session_lookup_pending'].includes(lifecycleState);

    if (createTimedOutBeforeWatcher) {
      trackingState.activeSessionOwnerId = ownerId;
      trackingState.activeSessionId = null;
      trackingState.activeWatcherId = null;
      trackingState.backendCleanupPending = true;
      trackingState.backendSessionEnded = false;
      trackingState.watcherCleanupPending = false;
      trackingState.sessionState = SessionState.BACKEND_END_PENDING;

      try {
        await persistTrackingState('backend_cleanup_pending', {
          userId: ownerId,
          sessionId: serverSessionId,
          watcherId: null,
          backendEnded: false
        });
      } catch (error) {
        console.error('Could not persist recovered backend session ID:', error);
        return {
          success: false,
          reason: 'cleanup_persistence_failed',
          cleanupPending: true,
          backendCleanupPending: true,
          sessionId: serverSessionId,
          error: error.message
        };
      }

      const result = await completeBackendSession(serverSessionId, ownerId);
      if (result.success) {
        resetActiveTrackingState();
        return { success: true, recovered: true, backendSessionEnded: true };
      }
      return {
        ...result,
        cleanupPending: true,
        backendCleanupPending: true,
        watcherCleanupPending: false,
        sessionId: serverSessionId
      };
    }

    const result = await resolveStoredSessionCleanup(ownerId);
    return {
      ...result,
      cleanupPending: !result.success,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: trackingState.watcherCleanupPending,
      sessionId: trackingState.activeSessionId,
      recoveryReason: trackingState.recoveryReason
    };
  }

  trackingState.activeSessionOwnerId = ownerId;
  trackingState.activeSessionId = serverSessionId;
  trackingState.activeWatcherId = null;
  trackingState.backendCleanupPending = true;
  trackingState.backendSessionEnded = false;
  trackingState.watcherCleanupPending = true;
  trackingState.sessionState = SessionState.WATCHER_RECONCILIATION_PENDING;
  trackingState.recoveryReason = 'watcher_id_unavailable';
  try {
    await storageService.saveSessionTrackingState(ownerId, {
      userId: ownerId,
      sessionId: null,
      unownedSessionId: serverSessionId,
      watcherId: null,
      lifecycleState: 'server_session_watcher_unknown',
      backendEnded: false
    });
  } catch (error) {
    console.error('Could not persist server session with unknown watcher state:', error);
  }
  return {
    success: false,
    found: true,
    reason: 'watcher_id_unavailable',
    cleanupPending: true,
    backendCleanupPending: true,
    watcherCleanupPending: true,
    sessionId: serverSessionId
  };
};

export async function recoverSafetySession(userId) {
  const ownerId = userId ? String(userId) : '';
  if (
    trackingState.recoveryPromise &&
    trackingState.recoveryOwnerId !== ownerId
  ) {
    return {
      success: false,
      reason: 'another_user_recovery_in_progress',
      cleanupPending: true
    };
  }
  if (trackingState.recoveryPromise) return await trackingState.recoveryPromise;

  const recoveryPromise = recoverSafetySessionInternal(userId);
  trackingState.recoveryPromise = recoveryPromise;
  trackingState.recoveryOwnerId = ownerId;
  try {
    return await recoveryPromise;
  } catch (error) {
    if (trackingState.sessionState !== SessionState.ACTIVE) {
      trackingState.activeSessionOwnerId = ownerId;
      trackingState.backendCleanupPending = true;
      trackingState.sessionState = trackingState.activeWatcherId
        ? SessionState.FAILED_WATCHER_STUCK
        : SessionState.WATCHER_RECONCILIATION_PENDING;
      trackingState.watcherCleanupPending = true;
      trackingState.recoveryReason = 'session_recovery_failed';
    }
    console.error('Safety session recovery failed:', error);
    return {
      success: false,
      reason: 'session_recovery_failed',
      cleanupPending: true,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: trackingState.watcherCleanupPending,
      sessionId: trackingState.activeSessionId,
      error: error.message
    };
  } finally {
    if (trackingState.recoveryPromise === recoveryPromise) {
      trackingState.recoveryPromise = null;
      trackingState.recoveryOwnerId = null;
    }
  }
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
  if (trackingState.recoveryPromise) {
    await trackingState.recoveryPromise;
  }

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
      cleanupPending: true,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: true,
      sessionId: trackingState.activeSessionId,
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
      cleanupPending:
        trackingState.backendCleanupPending || trackingState.watcherCleanupPending,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: trackingState.watcherCleanupPending,
      sessionId: trackingState.activeSessionId,
      currentState: trackingState.sessionState,
      note: getStateTransitionGuidance(trackingState.sessionState)
    };
  }

  const ownerId = options.userId ? String(options.userId) : '';
  if (!ownerId) {
    return { success: false, reason: 'authentication_required' };
  }

  // STEP 4: Transition to STARTING
  trackingState.cancelStartRequested = false;
  trackingState.sessionState = SessionState.STARTING;
  trackingState.activeSessionOwnerId = ownerId;
  let resolveStartCompletion;
  const startCompletionPromise = new Promise((resolve) => {
    resolveStartCompletion = resolve;
  });
  trackingState.startCompletionPromise = startCompletionPromise;

  try {
    const token = await storageService.getToken();
    if (!token) {
      trackingState.sessionState = SessionState.IDLE;
      return { success: false, reason: 'authentication_required' };
    }

    const pendingCleanup = await resolveStoredSessionCleanup(ownerId);
    if (!pendingCleanup.success) {
      return {
        success: false,
        reason: pendingCleanup.reason || 'backend_cleanup_pending',
        cleanupPending: true,
        backendCleanupPending: trackingState.backendCleanupPending,
        watcherCleanupPending: trackingState.watcherCleanupPending,
        sessionId: trackingState.activeSessionId,
        note: 'Resolve the previous safety session before starting another one'
      };
    }
    trackingState.sessionState = SessionState.STARTING;
    if (trackingState.cancelStartRequested) {
      trackingState.sessionState = SessionState.IDLE;
      trackingState.activeSessionOwnerId = null;
      return { success: false, reason: 'start_cancelled' };
    }

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

    if (trackingState.cancelStartRequested) {
      trackingState.sessionState = SessionState.IDLE;
      return { success: false, reason: 'start_cancelled' };
    }

    trackingState.activeSessionOwnerId = ownerId;
    trackingState.activeSessionId = null;
    trackingState.activeWatcherId = null;
    trackingState.backendCleanupPending = true;
    trackingState.backendSessionEnded = false;
    try {
      await persistTrackingState('creating_backend_session', {
        userId: ownerId,
        sessionId: null,
        watcherId: null,
        backendEnded: false
      });
    } catch (error) {
      resetActiveTrackingState();
      return {
        success: false,
        reason: 'tracking_state_persistence_failed',
        error: error.message,
        cleanupPending: false,
        backendCleanupPending: false,
        watcherCleanupPending: false
      };
    }

    // STEP 7: Create the backend session before registering native tracking
    let createResponse;
    try {
      createResponse = await apiService.createSession({});
    } catch (error) {
      if (error.status === 409) {
        trackingState.sessionState = SessionState.BACKEND_CREATE_CONFLICT;
        trackingState.recoveryReason = 'active_session_already_exists';
        trackingState.backendCleanupPending = true;
        trackingState.watcherCleanupPending = false;
        try {
          await persistTrackingState('create_conflict', {
            userId: ownerId,
            sessionId: null,
            watcherId: null,
            backendEnded: false
          });
        } catch (persistenceError) {
          console.error('Failed to persist active-session conflict:', persistenceError);
        }

        return {
          success: false,
          reason: 'active_session_already_exists',
          error: error.message,
          cleanupPending: true,
          backendCleanupPending: true,
          watcherCleanupPending: false,
          sessionId: null,
          note: 'An active safety session already exists for this account, possibly on another device. This device will not adopt or end it.'
        };
      }

      trackingState.sessionState = SessionState.BACKEND_CREATE_UNKNOWN;
      trackingState.recoveryReason = 'backend_session_id_unknown';
      try {
        await persistTrackingState('create_response_unknown', {
          userId: ownerId,
          sessionId: null,
          watcherId: null,
          backendEnded: false
        });
      } catch (persistenceError) {
        console.error('Failed to persist unknown backend create result:', persistenceError);
      }

      return {
        success: false,
        reason: 'backend_create_result_unknown',
        error: error.message,
        cleanupPending: true,
        backendCleanupPending: true,
        watcherCleanupPending: false,
        sessionId: null,
        note: 'The server may have created a session, but its ID was not received'
      };
    }

    const sessionId = createResponse?.data?.session?._id;
    if (!createResponse?.success || !isValidBackendSessionId(sessionId)) {
      trackingState.sessionState = SessionState.BACKEND_CREATE_UNKNOWN;
      trackingState.recoveryReason = 'backend_session_id_unknown';
      try {
        await persistTrackingState('create_response_unknown', {
          userId: ownerId,
          sessionId: null,
          watcherId: null,
          backendEnded: false
        });
      } catch (error) {
        console.error('Failed to persist invalid backend create response:', error);
      }
      return {
        success: false,
        reason: 'backend_create_result_unknown',
        note: createResponse?.message || 'Backend returned an invalid session ID',
        cleanupPending: true,
        backendCleanupPending: true,
        watcherCleanupPending: false,
        sessionId: null
      };
    }

    trackingState.activeSessionId = sessionId;
    trackingState.activeSessionOwnerId = ownerId;
    trackingState.backendCleanupPending = true;

    try {
      await persistTrackingState('backend_session_created', {
        userId: ownerId,
        sessionId,
        watcherId: null,
        backendEnded: false
      });
    } catch (storageError) {
      console.error('Could not persist new backend session for cleanup:', storageError);
      const cleanupResult = await completeBackendSession(sessionId, ownerId);
      if (cleanupResult.success) {
        resetActiveTrackingState();
        return {
          success: false,
          reason: 'session_state_persistence_failed',
          error: storageError.message
        };
      }

      trackingState.sessionState = SessionState.BACKEND_END_PENDING;
      return {
        success: false,
        reason: 'backend_cleanup_pending',
        cleanupPending: true,
        backendCleanupPending: true,
        watcherCleanupPending: false,
        sessionId,
        error: cleanupResult.error || storageError.message,
        note: 'The backend session exists but local cleanup state could not be saved'
      };
    }

    if (trackingState.cancelStartRequested) {
      const cleanupResult = await completeBackendSession(sessionId, ownerId);
      if (cleanupResult.success) resetActiveTrackingState();
      else trackingState.sessionState = SessionState.BACKEND_END_PENDING;
      return {
        success: false,
        reason: cleanupResult.success ? 'start_cancelled' : 'backend_cleanup_pending',
        cleanupPending: !cleanupResult.success,
        backendCleanupPending: !cleanupResult.success,
        watcherCleanupPending: false,
        sessionId: cleanupResult.success ? undefined : sessionId
      };
    }

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
    try {
      await persistTrackingState('watcher_registering', {
        userId: ownerId,
        sessionId,
        watcherId: null,
        backendEnded: false
      });
    } catch (error) {
      const cleanupResult = await completeBackendSession(sessionId, ownerId);
      if (cleanupResult.success) resetActiveTrackingState();
      else trackingState.sessionState = SessionState.BACKEND_END_PENDING;
      return {
        success: false,
        reason: cleanupResult.success
          ? 'tracking_state_persistence_failed'
          : 'backend_cleanup_pending',
        error: error.message,
        cleanupPending: !cleanupResult.success,
        backendCleanupPending: !cleanupResult.success,
        watcherCleanupPending: false,
        sessionId: cleanupResult.success ? null : sessionId
      };
    }

    // STEP 11: Register watcher
    let watcherId = null;

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
      trackingState.activeWatcherId = watcherId;
      await persistTrackingState('watcher_registered', {
        userId: ownerId,
        sessionId,
        watcherId,
        backendEnded: trackingState.backendSessionEnded
      });

    } catch (watcherError) {
      if (watcherId) {
        trackingState.stuckWatcherId = watcherId;
        trackingState.watcherCleanupPending = true;
        trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
        try {
          await BackgroundGeolocation.removeWatcher({ id: watcherId });
          trackingState.activeWatcherId = null;
          trackingState.stuckWatcherId = null;
          trackingState.watcherCleanupPending = false;
        } catch (removeError) {
          console.error('Watcher rollback failed after persistence error:', removeError);
          const backendResult = await endPersistedBackendSession(ownerId, sessionId);
          try {
            await persistTrackingState('watcher_cleanup_pending', {
              userId: ownerId,
              sessionId,
              watcherId,
              backendEnded: false
            });
          } catch (persistenceError) {
            console.error('Failed to persist watcher rollback state:', persistenceError);
          }
          return {
            success: false,
            reason: 'watcher_cleanup_pending',
            error: watcherError.message,
            cleanupPending: true,
            backendCleanupPending: !trackingState.backendSessionEnded,
            watcherCleanupPending: true,
            sessionId,
            watcherId,
            cleanupError: backendResult.error?.message
          };
        }
      }

      trackingState.callbackGeneration++;
      trackingState.watcherCallback = null;
      trackingState.earlyCallbackBuffer = [];
      const cleanupResult = await completeBackendSession(sessionId, ownerId);
      if (cleanupResult.success) resetActiveTrackingState();

      return {
        success: false,
        reason: cleanupResult.success
          ? 'watcher_registration_failed'
          : 'backend_cleanup_pending',
        error: watcherError.message,
        cleanupPending: !cleanupResult.success,
        backendCleanupPending: !cleanupResult.success,
        watcherCleanupPending: false,
        sessionId: cleanupResult.success ? undefined : sessionId,
        note: cleanupResult.success
          ? undefined
          : 'Native watcher failed to start and backend session cleanup is pending'
      };
    }

    // From this point forward, watcher IS registered and MUST be removed on error

    try {
    if (trackingState.cancelStartRequested) {
      throw new Error('Safety session start was cancelled');
    }

    // STEP 12: Notify permission manager
      const notifyResult = notifySessionStarted(sessionId, watcherId);
      if (!notifyResult.success) {
        throw new Error(`notifySessionStarted failed: ${notifyResult.reason}`);
      }

      // STEP 13: Transition to ACTIVE
      trackingState.sessionState = SessionState.ACTIVE;
      trackingState.acceptingLocationUploads = true;
      await persistTrackingState('active', {
        userId: ownerId,
        sessionId,
        watcherId,
        backendEnded: false
      });

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
      trackingState.acceptingLocationUploads = false;
      trackingState.pendingLocationUpload = null;
      if (trackingState.locationUploadPromise) {
        await trackingState.locationUploadPromise;
      }

      // Attempt watcher removal
      let removalSucceeded = false;
      try {
        await BackgroundGeolocation.removeWatcher({ id: watcherId });
        removalSucceeded = true;
      } catch (removeError) {
        console.error('Watcher removal failed during startup cleanup:', removeError);
      }

      if (removalSucceeded) {
        trackingState.activeWatcherId = null;
        resetSessionState();
        const cleanupResult = await completeBackendSession(sessionId, ownerId);
        if (cleanupResult.success) resetActiveTrackingState();

        return {
          success: false,
          reason: cleanupResult.success
            ? postRegistrationError.message === 'Safety session start was cancelled'
              ? 'start_cancelled'
              : 'post_registration_error'
            : 'backend_cleanup_pending',
          error: postRegistrationError.message,
          cleanupSucceeded: cleanupResult.success,
          cleanupPending: !cleanupResult.success,
          backendCleanupPending: !cleanupResult.success,
          watcherCleanupPending: false,
          sessionId: cleanupResult.success ? undefined : sessionId
        };
      } else {
        // Removal failed - watcher stuck
        trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
        trackingState.stuckWatcherId = watcherId;
        trackingState.cleanupAttempts = 1;
        trackingState.watcherCleanupPending = true;
        trackingState.backendCleanupPending = true;
        const backendResult = await endPersistedBackendSession(ownerId, sessionId);
        try {
          await persistTrackingState('watcher_cleanup_pending', {
            userId: ownerId,
            sessionId,
            watcherId,
            backendEnded: trackingState.backendSessionEnded
          });
        } catch (persistenceError) {
          console.error('Failed to persist failed-start watcher cleanup:', persistenceError);
        }

        return {
          success: false,
          reason: 'watcher_cleanup_pending',
          error: postRegistrationError.message,
          cleanupPending: true,
          backendCleanupPending: !trackingState.backendSessionEnded,
          watcherCleanupPending: true,
          sessionId,
          stuckWatcherId: watcherId,
          cleanupError: backendResult.error?.message,
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

    if (trackingState.activeSessionId && trackingState.activeSessionOwnerId) {
      const cleanupResult = await completeBackendSession(
        trackingState.activeSessionId,
        trackingState.activeSessionOwnerId
      );
      if (cleanupResult.success) resetActiveTrackingState();
      else trackingState.sessionState = SessionState.BACKEND_END_PENDING;
    } else if (trackingState.activeSessionOwnerId) {
      trackingState.sessionState = SessionState.BACKEND_CREATE_UNKNOWN;
      trackingState.backendCleanupPending = true;
      trackingState.recoveryReason = 'tracking_state_reconciliation_required';
      return {
        success: false,
        reason: 'tracking_state_reconciliation_required',
        error: error.message,
        cleanupPending: true,
        backendCleanupPending: true,
        watcherCleanupPending: trackingState.watcherCleanupPending,
        sessionId: trackingState.activeSessionId
      };
    } else {
      trackingState.sessionState = SessionState.IDLE;
    }

    return {
      success: false,
      reason: trackingState.backendCleanupPending
        ? 'backend_cleanup_pending'
        : 'unexpected_error',
      error: error.message,
      cleanupPending: trackingState.backendCleanupPending,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: trackingState.watcherCleanupPending,
      sessionId: trackingState.backendCleanupPending ? trackingState.activeSessionId : undefined
    };
  } finally {
    if (trackingState.startCompletionPromise === startCompletionPromise) {
      trackingState.startCompletionPromise = null;
    }
    resolveStartCompletion();
  }
}

/**
 * Stop active safety session
 *
 * @returns {Promise<Object>} Stop result
 */
export async function stopSafetySession({ skipBackendEnd = false } = {}) {
  if (
    trackingState.sessionState === SessionState.BACKEND_CREATE_UNKNOWN ||
    trackingState.sessionState === SessionState.BACKEND_CREATE_CONFLICT ||
    trackingState.sessionState === SessionState.WATCHER_RECONCILIATION_PENDING
  ) {
    if (!trackingState.activeSessionOwnerId) {
      return {
        success: false,
        reason: trackingState.recoveryReason || 'tracking_state_reconciliation_required',
        cleanupPending: true,
        backendCleanupPending: trackingState.backendCleanupPending,
        watcherCleanupPending: trackingState.watcherCleanupPending
      };
    }

    if (!skipBackendEnd) {
      const recovery = await recoverSafetySession(
        trackingState.activeSessionOwnerId
      );
      return {
        success: recovery.success,
        reason: recovery.reason,
        cleanupPending: !recovery.success,
        backendCleanupPending: recovery.backendCleanupPending,
        watcherCleanupPending: recovery.watcherCleanupPending,
        sessionId: recovery.sessionId || trackingState.activeSessionId,
        error: recovery.error
      };
    }

    const result = await resolveStoredSessionCleanup(
      trackingState.activeSessionOwnerId,
      { skipBackendEnd }
    );
    return {
      success: result.success,
      reason: result.reason,
      cleanupPending: !result.success,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: trackingState.watcherCleanupPending,
      sessionId: trackingState.activeSessionId,
      error: result.error
    };
  }

  if (trackingState.sessionState === SessionState.BACKEND_END_PENDING) {
    const pendingSessionId = trackingState.activeSessionId;
    const locationSyncPending = trackingState.locationSyncPending;
    const cleanupResult = await completeBackendSession(
      trackingState.activeSessionId,
      trackingState.activeSessionOwnerId,
      skipBackendEnd
    );

    if (cleanupResult.success) {
      resetSessionState();
      resetActiveTrackingState();
      return {
        success: true,
        stoppedSessionId: pendingSessionId,
        locationSyncPending
      };
    }

    return {
      success: false,
      reason: cleanupResult.reason,
      backendCleanupPending: true,
      cleanupPending: true,
      watcherStopped: true,
      canLogout: cleanupResult.reason !== 'cleanup_persistence_failed',
      locationSyncPending,
      error: cleanupResult.error
    };
  }

  if (trackingState.sessionState === SessionState.FAILED_WATCHER_STUCK) {
    return await retryCleanup({ skipBackendEnd });
  }

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
  const ownerId = trackingState.activeSessionOwnerId;
  const watcherId = trackingState.activeWatcherId;
  const locationSyncPendingBeforeStop =
    trackingState.locationSyncPending || trackingState.pendingLocationUpload !== null;

  // STEP 3: Invalidate callbacks FIRST
  trackingState.acceptingLocationUploads = false;
  trackingState.pendingLocationUpload = null;
  trackingState.callbackGeneration++;
  trackingState.watcherCallback = null;
  trackingState.earlyCallbackBuffer = [];

  try {
    await persistTrackingState('watcher_cleanup_pending', {
      userId: ownerId,
      sessionId,
      watcherId,
      backendEnded: false
    });
  } catch (error) {
    console.error('Failed to persist stopping session state:', error);
  }

  if (trackingState.locationUploadPromise) {
    await trackingState.locationUploadPromise;
  }
  const locationSyncPending =
    locationSyncPendingBeforeStop || trackingState.locationSyncPending;

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
    trackingState.backendCleanupPending = true;
    trackingState.watcherCleanupPending = true;
    try {
      await persistTrackingState('watcher_cleanup_pending');
    } catch (storageError) {
      console.error('Failed to persist session cleanup after watcher removal failure:', storageError);
    }

    return {
      success: false,
      reason: 'watcher_removal_failed',
      cleanupPending: true,
      backendCleanupPending: true,
      watcherCleanupPending: true,
      error: removeError.message,
      stuckWatcherId: watcherId,
      cleanupStage: trackingState.cleanupStage,
      canLogout: false,
      note: 'Call retryCleanup() to retry removal'
    };
  }

  trackingState.activeWatcherId = null;
  trackingState.stuckWatcherId = null;
  trackingState.watcherCleanupPending = false;
  resetSessionState();
  trackingState.cleanupStage = CleanupStage.COMPLETE;

  const cleanupResult = await completeBackendSession(sessionId, ownerId, skipBackendEnd);
  if (cleanupResult.success) {
    resetActiveTrackingState();
  } else {
    trackingState.sessionState = SessionState.BACKEND_END_PENDING;
  }

  return {
    success: cleanupResult.success,
    reason: cleanupResult.reason,
    cleanupPending: !cleanupResult.success,
    stoppedSessionId: sessionId,
    stoppedWatcherId: watcherId,
    backendCleanupPending: !cleanupResult.success,
    watcherCleanupPending: false,
    watcherStopped: true,
    canLogout: cleanupResult.reason !== 'cleanup_persistence_failed',
    locationSyncPending,
    error: cleanupResult.error
  };
}

/**
 * Retry cleanup when watcher removal previously failed
 * Unlimited manual retries permitted
 *
 * @returns {Promise<Object>} Retry result
 */
export async function retryCleanup({ skipBackendEnd = false } = {}) {
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
    trackingState.watcherCleanupPending = true;
    try {
      await persistTrackingState('watcher_cleanup_pending');
    } catch (persistenceError) {
      console.error('Failed to persist watcher cleanup retry state:', persistenceError);
    }

    return {
      success: false,
      reason: 'watcher_removal_still_failing',
      cleanupPending: true,
      backendCleanupPending: trackingState.backendCleanupPending,
      watcherCleanupPending: true,
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
    const sessionId = trackingState.activeSessionId;
    const ownerId = trackingState.activeSessionOwnerId;
    trackingState.acceptingLocationUploads = false;
    trackingState.pendingLocationUpload = null;
    if (trackingState.locationUploadPromise) {
      await trackingState.locationUploadPromise;
    }
    resetSessionState();

    // If this was a failure (not manual stop cleanup), notify after reset
    if (originalFailureReason) {
      notifySessionFailed(originalFailureReason);
    }

    // Clear all stuck state
    trackingState.activeWatcherId = null;
    trackingState.stuckWatcherId = null;
    trackingState.watcherCleanupPending = false;
    const cleanupResult = await completeBackendSession(sessionId, ownerId, skipBackendEnd);
    if (cleanupResult.success) resetActiveTrackingState();
    else trackingState.sessionState = SessionState.BACKEND_END_PENDING;

    return {
      success: cleanupResult.success,
      reason: cleanupResult.reason,
      cleanupPending: !cleanupResult.success,
      removedWatcherId: watcherId,
      attemptNumber: totalAttempts,  // Report actual count
      status: getCurrentSessionStatus().status,
      failureNotified: originalFailureReason !== null,  // Indicate if failure was notified
      backendCleanupPending: !cleanupResult.success,
      watcherCleanupPending: false,
      watcherStopped: true,
      canLogout: cleanupResult.reason !== 'cleanup_persistence_failed',
      error: cleanupResult.error
    };
  }
}

export async function cleanupSafetySessionForLogout(userId, { unauthorized = false } = {}) {
  const ownerId = userId ? String(userId) : '';

  if (trackingState.recoveryPromise) {
    await trackingState.recoveryPromise;
  }

  if (
    trackingState.sessionState === SessionState.STARTING ||
    trackingState.sessionState === SessionState.WATCHER_REGISTERING
  ) {
    trackingState.cancelStartRequested = true;
    const pendingStart = trackingState.startCompletionPromise;
    if (pendingStart) await pendingStart;
  }

  if (
    ownerId &&
    (trackingState.sessionState === SessionState.BACKEND_CREATE_UNKNOWN ||
      trackingState.sessionState === SessionState.BACKEND_CREATE_CONFLICT) &&
    !trackingState.watcherCleanupPending &&
    !trackingState.activeWatcherId &&
    !trackingState.stuckWatcherId
  ) {
    const persisted = await storageService.getPendingSessionCleanup(ownerId);
    if (persisted && (
      persisted.watcherId ||
      watcherMayExistForLifecycle(persisted.lifecycleState)
    )) {
      trackingState.activeSessionOwnerId = ownerId;
      trackingState.activeSessionId = isUnownedSessionLifecycle(persisted.lifecycleState)
        ? null
        : persisted.sessionId || null;
      trackingState.activeWatcherId = persisted.watcherId || null;
      trackingState.backendCleanupPending = true;
      trackingState.watcherCleanupPending = true;
      trackingState.sessionState = persisted.watcherId
        ? persisted.lifecycleState === 'create_conflict'
          ? SessionState.BACKEND_CREATE_CONFLICT
          : SessionState.BACKEND_CREATE_UNKNOWN
        : SessionState.WATCHER_RECONCILIATION_PENDING;
      trackingState.recoveryReason = persisted.watcherId
        ? persisted.lifecycleState === 'create_conflict'
          ? 'active_session_already_exists'
          : 'backend_session_id_unknown'
        : 'watcher_id_unavailable';
    }
  }

  if (
    (trackingState.sessionState === SessionState.BACKEND_CREATE_UNKNOWN ||
      trackingState.sessionState === SessionState.BACKEND_CREATE_CONFLICT) &&
    !trackingState.watcherCleanupPending &&
    !trackingState.activeWatcherId &&
    !trackingState.stuckWatcherId
  ) {
    const reason = trackingState.recoveryReason ||
      (trackingState.sessionState === SessionState.BACKEND_CREATE_CONFLICT
        ? 'active_session_already_exists'
        : 'backend_session_id_unknown');
    const pendingCleanup = trackingState.backendCleanupPending;
    resetActiveTrackingState();
    return {
      canLogout: true,
      pendingCleanup,
      reason
    };
  }

  if (
    trackingState.sessionState === SessionState.ACTIVE ||
    trackingState.sessionState === SessionState.FAILED_WATCHER_STUCK ||
    trackingState.sessionState === SessionState.BACKEND_END_PENDING ||
    trackingState.sessionState === SessionState.BACKEND_CREATE_UNKNOWN ||
    trackingState.sessionState === SessionState.BACKEND_CREATE_CONFLICT ||
    trackingState.sessionState === SessionState.WATCHER_RECONCILIATION_PENDING
  ) {
    const sameOwner = ownerId && trackingState.activeSessionOwnerId === ownerId;
    const result = await stopSafetySession({
      skipBackendEnd: unauthorized || !sameOwner
    });
    const watcherCleanupFailed =
      result.watcherCleanupPending === true ||
      result.reason === 'watcher_removal_failed' ||
      result.reason === 'watcher_removal_still_failing';
    const canLogout = !watcherCleanupFailed && (
      unauthorized
        ? result.canLogout !== false && result.reason !== 'cleanup_persistence_failed'
        : result.canLogout === true ||
          (result.success === true && !result.watcherCleanupPending)
    );
    if (canLogout && !result.watcherCleanupPending) {
      resetActiveTrackingState();
    }
    return {
      canLogout,
      pendingCleanup:
        result.backendCleanupPending === true ||
        result.watcherCleanupPending === true,
      reason: result.reason,
      error: result.error
    };
  }

  if (trackingState.sessionState !== SessionState.IDLE) {
    return {
      canLogout: false,
      pendingCleanup: trackingState.backendCleanupPending,
      reason: 'session_start_in_progress'
    };
  }

  if (!ownerId) return { canLogout: true, pendingCleanup: false };

  const pending = await storageService.getPendingSessionCleanup(ownerId);
  if (!pending) return { canLogout: true, pendingCleanup: false };

  const pendingWatcherId = pending.watcherId;
  const watcherMayExistWithoutId = !pendingWatcherId &&
    watcherMayExistForLifecycle(pending.lifecycleState);
  if (pendingWatcherId) {
    try {
      await BackgroundGeolocation.removeWatcher({ id: pendingWatcherId });
    } catch (error) {
      trackingState.activeSessionOwnerId = ownerId;
      trackingState.activeSessionId = isUnownedSessionLifecycle(pending.lifecycleState)
        ? null
        : pending.sessionId || null;
      trackingState.activeWatcherId = pendingWatcherId;
      trackingState.stuckWatcherId = pendingWatcherId;
      trackingState.backendCleanupPending = true;
      trackingState.watcherCleanupPending = true;
      trackingState.sessionState = SessionState.FAILED_WATCHER_STUCK;
      trackingState.recoveryReason = 'watcher_removal_failed';
      console.error('Could not remove persisted safety session watcher before logout:', error);
      return {
        canLogout: false,
        pendingCleanup: true,
        reason: 'watcher_removal_failed',
        error: error.message
      };
    }
    try {
      await storageService.saveSessionTrackingState(ownerId, {
        ...pending,
        watcherId: null,
        lifecycleState: isUnownedSessionLifecycle(pending.lifecycleState)
          ? pending.lifecycleState
          : 'backend_cleanup_pending'
      });
    } catch (error) {
      console.error('Could not persist watcher removal before logout:', error);
      trackingState.activeSessionOwnerId = ownerId;
      trackingState.activeSessionId = isUnownedSessionLifecycle(pending.lifecycleState)
        ? null
        : pending.sessionId || null;
      trackingState.activeWatcherId = null;
      trackingState.stuckWatcherId = null;
      trackingState.backendCleanupPending = true;
      trackingState.watcherCleanupPending = false;
      trackingState.sessionState = pending.lifecycleState === 'create_conflict'
        ? SessionState.BACKEND_CREATE_CONFLICT
        : isUnownedSessionLifecycle(pending.lifecycleState)
          ? SessionState.BACKEND_CREATE_UNKNOWN
          : SessionState.BACKEND_END_PENDING;
      trackingState.recoveryReason = 'cleanup_persistence_failed';
      return {
        canLogout: false,
        pendingCleanup: true,
        reason: 'cleanup_persistence_failed',
        error: error.message
      };
    }
  } else if (watcherMayExistWithoutId) {
    trackingState.activeSessionOwnerId = ownerId;
    trackingState.activeSessionId = isUnownedSessionLifecycle(pending.lifecycleState)
      ? null
      : pending.sessionId || null;
    trackingState.activeWatcherId = null;
    trackingState.backendCleanupPending = true;
    trackingState.watcherCleanupPending = true;
    trackingState.sessionState = SessionState.WATCHER_RECONCILIATION_PENDING;
    trackingState.recoveryReason = 'watcher_id_unavailable';
    return {
      canLogout: false,
      pendingCleanup: true,
      reason: 'watcher_id_unavailable'
    };
  }

  if (unauthorized) return { canLogout: true, pendingCleanup: true };
  if (!isValidBackendSessionId(pending.sessionId)) {
    return {
      canLogout: false,
      pendingCleanup: true,
      reason: 'invalid_pending_session_id'
    };
  }

  trackingState.activeSessionId = pending.sessionId;
  trackingState.activeSessionOwnerId = ownerId;
  trackingState.backendCleanupPending = true;
  trackingState.sessionState = SessionState.BACKEND_END_PENDING;
  return await stopSafetySession();
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
    activeSessionOwnerId: trackingState.activeSessionOwnerId,
    activeWatcherId: trackingState.activeWatcherId,
    backendCleanupPending: trackingState.backendCleanupPending,
    backendSessionEnded: trackingState.backendSessionEnded,
    watcherCleanupPending: trackingState.watcherCleanupPending,
    recoveryReason: trackingState.recoveryReason,
    locationSyncPending: trackingState.locationSyncPending,
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

  let latestLocation = null;
  for (const buffered of buffer) {
    if (buffered.error) {
      if (!isCallbackStale(buffered.generation)) {
        processLocationUpdate(buffered.location, buffered.error);
      }
      continue;
    }

    const locationTime = buffered.location?.time;
    if (
      Number.isSafeInteger(locationTime) &&
      locationTime > 0 &&
      (!latestLocation || locationTime > latestLocation.location.time)
    ) {
      latestLocation = buffered;
    }
  }

  if (
    latestLocation &&
    !isCallbackStale(latestLocation.generation) &&
    trackingState.sessionState === SessionState.ACTIVE
  ) {
    processLocationUpdate(latestLocation.location, undefined);
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
    queueLocationUpload(location, timestamp);
  }
}

function queueLocationUpload(location, timestamp) {
  if (
    !trackingState.acceptingLocationUploads ||
    trackingState.sessionState !== SessionState.ACTIVE ||
    !trackingState.activeSessionId
  ) {
    return;
  }

  const { latitude, longitude } = location;
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    console.warn('Ignoring location with invalid coordinates');
    return;
  }

  if (timestamp <= trackingState.lastQueuedLocationTimestamp) {
    return;
  }

  trackingState.lastQueuedLocationTimestamp = timestamp;
  trackingState.pendingLocationUpload = {
    timestamp,
    sessionId: trackingState.activeSessionId,
    latitude,
    longitude
  };
  startLocationUploadDrain();
}

function startLocationUploadDrain() {
  if (trackingState.locationUploadPromise) return;

  const drainPromise = drainLocationUploads();
  trackingState.locationUploadPromise = drainPromise;
  drainPromise.finally(() => {
    if (trackingState.locationUploadPromise === drainPromise) {
      trackingState.locationUploadPromise = null;
    }
    if (
      trackingState.acceptingLocationUploads &&
      trackingState.pendingLocationUpload
    ) {
      startLocationUploadDrain();
    }
  });
}

async function drainLocationUploads() {
  while (
    trackingState.acceptingLocationUploads &&
    trackingState.sessionState === SessionState.ACTIVE &&
    trackingState.pendingLocationUpload
  ) {
    const update = trackingState.pendingLocationUpload;
    trackingState.pendingLocationUpload = null;
    let uploadError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (
        !trackingState.acceptingLocationUploads ||
        trackingState.sessionState !== SessionState.ACTIVE ||
        update.sessionId !== trackingState.activeSessionId
      ) {
        return;
      }

      try {
        const response = await apiService.updateSessionLocation(update.sessionId, {
          latitude: update.latitude,
          longitude: update.longitude
        });
        if (!response?.success) {
          throw new Error(response?.message || 'Backend did not confirm location update');
        }

        trackingState.lastUploadedLocationTimestamp = update.timestamp;
        uploadError = null;
        break;
      } catch (error) {
        uploadError = error;
        if (error.status === 401 || (error.status >= 400 && error.status < 500)) {
          break;
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
        }
      }
    }

    if (uploadError) {
      trackingState.locationSyncPending = true;
      dispatchLocationSyncState(true, uploadError.message);
      console.error('Location sync pending after upload retries:', uploadError);
      return;
    }

    trackingState.locationSyncPending = false;
    dispatchLocationSyncState(false);
  }
}

function dispatchLocationSyncState(pending, message) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spheriva:location-sync-state', {
      detail: { pending, message }
    }));
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
    trackingState.acceptingLocationUploads = false;
    trackingState.pendingLocationUpload = null;
    trackingState.callbackGeneration++;
    trackingState.watcherCallback = null;
    trackingState.earlyCallbackBuffer = [];
    if (trackingState.locationUploadPromise) {
      await trackingState.locationUploadPromise;
    }

    // STEP 4: Attempt to remove watcher
    const watcherId = trackingState.activeWatcherId;
    const sessionId = trackingState.activeSessionId;
    const ownerId = trackingState.activeSessionOwnerId;
    if (!watcherId) {
      console.warn('No active watcher during failure cleanup');
      resetSessionState();
      notifySessionFailed(reason);
      const cleanupResult = sessionId
        ? await completeBackendSession(sessionId, ownerId)
        : { success: true };
      if (cleanupResult.success) resetActiveTrackingState();
      else trackingState.sessionState = SessionState.BACKEND_END_PENDING;
      trackingState.failureInProgress = false;
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
      trackingState.backendCleanupPending = Boolean(sessionId);
      trackingState.watcherCleanupPending = true;
      try {
        await persistTrackingState('watcher_cleanup_pending', {
          userId: ownerId,
          sessionId,
          watcherId,
          backendEnded: false
        });
      } catch (storageError) {
        console.error('Failed to persist session cleanup after watcher failure:', storageError);
      }

      // Cannot call notifySessionFailed yet - watcher still active
      console.error('Session failed but watcher is stuck - call retryCleanup()');
      return;
    }

    // STEP 4: Watcher removed successfully - reset permission state
    if (removalSucceeded) {
      resetSessionState();

      // STEP 5: Call notifySessionFailed (after reset)
      notifySessionFailed(reason);

      trackingState.activeWatcherId = null;
      const cleanupResult = sessionId
        ? await completeBackendSession(sessionId, ownerId)
        : { success: true };
      if (cleanupResult.success) resetActiveTrackingState();
      else trackingState.sessionState = SessionState.BACKEND_END_PENDING;
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
    [SessionState.FAILED_PERMISSION_REVOKED]: 'Permission revoked - cleanup in progress',
    [SessionState.BACKEND_END_PENDING]: 'Backend session ending is pending - retry cleanup before starting',
    [SessionState.BACKEND_CREATE_UNKNOWN]: 'Backend session ID is unknown - resolve the pending server session before starting',
    [SessionState.BACKEND_CREATE_CONFLICT]: 'An active session exists for this account - reconcile it before starting',
    [SessionState.WATCHER_RECONCILIATION_PENDING]: 'Watcher ID is unavailable - native watcher reconciliation is required before starting'
  };

  return guidance[currentState] || 'Unknown state';
}