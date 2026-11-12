/**
 * Home Screen
 * Main dashboard after login - shows safety session controls
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startSafetySession, stopSafetySession, getSafetySessionStatus } from '../services/trackingService';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [locationSyncPending, setLocationSyncPending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Check for active session on mount and when component becomes visible
  useEffect(() => {
    const checkSessionStatus = () => {
      const status = getSafetySessionStatus();
      const isActive = status.sessionState === 'active';
      setLocationSyncPending(status.locationSyncPending);
      const needsCleanup =
        status.backendCleanupPending ||
        status.watcherCleanupPending ||
        status.sessionState === 'backend_end_pending' ||
        status.sessionState === 'failed_watcher_stuck' ||
        status.sessionState === 'backend_create_unknown' ||
        status.sessionState === 'watcher_reconciliation_pending';
      setSessionActive(isActive);
      setCleanupPending(needsCleanup);
      if (status.recoveryReason === 'backend_session_id_unknown') {
        setError('A previous create request may have made a server session, but its ID is unavailable. The backend currently cannot look up that session.');
      } else if (status.recoveryReason === 'active_session_already_exists') {
        setError('An active safety session already exists for this account, possibly on another device. This device will not adopt or end it.');
      } else if (status.recoveryReason === 'watcher_id_unavailable') {
        setError('A previous native watcher may still exist, but the plugin cannot discover its ID. New sessions are blocked.');
      } else if (status.recoveryReason === 'watcher_removal_failed') {
        setError('Removing the previous native watcher failed. Retry cleanup before starting another session.');
      } else if (status.recoveryReason === 'tracking_state_read_failed') {
        setError('Saved tracking state could not be read. A new session is blocked until recovery succeeds.');
      } else if (!needsCleanup) {
        setError(null);
      }
      if (isActive) {
        setSessionId(status.activeSessionId);
      } else if (needsCleanup) {
        setSessionId(status.activeSessionId);
      } else {
        setSessionId(null);
      }
    };

    // Check on mount
    checkSessionStatus();

    // Check when returning to this screen (optional: add visibility listener)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const handleLocationSyncState = (event) => {
      setLocationSyncPending(event.detail?.pending === true);
    };
    window.addEventListener('spheriva:location-sync-state', handleLocationSyncState);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('spheriva:location-sync-state', handleLocationSyncState);
    };
  }, []);

  const handleLogout = async () => {
    const result = await logout();
    if (!result?.success) {
      setError(result?.message || 'Tracking cleanup failed. Please retry before logging out.');
      return;
    }
    navigate('/login');
  };

  const handleStartSession = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await startSafetySession({
        userId: user?.id || user?._id,
        backgroundMessage: `${user?.name || 'User'} is being tracked for safety`,
        backgroundTitle: 'Spheriva Safety Session Active',
        distanceFilter: 10 // Update every 10 meters
      });

      if (result.success) {
        setSessionActive(true);
        setCleanupPending(false);
        setSessionId(result.sessionId);
        setSuccessMessage('Safety session started successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setSessionActive(false);
        const needsCleanup = result.cleanupPending === true ||
          result.backendCleanupPending === true ||
          result.watcherCleanupPending === true;
        setCleanupPending(needsCleanup);
        setSessionId(result.sessionId || null);
        // Handle specific error reasons
        let errorMsg = 'Failed to start safety session';
        if (result.reason === 'invalid_options') {
          errorMsg = 'Invalid session options: ' + result.errors.join(', ');
        } else if (result.reason === 'location_permission_denied') {
          errorMsg = 'Location permission is required. Please enable it in Settings.';
        } else if (result.reason === 'stuck_watcher_exists') {
          errorMsg = result.note || 'Previous session cleanup required. Please retry cleanup.';
        } else if (result.reason === 'invalid_state') {
          errorMsg = result.note || `Cannot start session in current state: ${result.currentState}`;
        } else if (result.reason === 'backend_create_result_unknown' ||
                   result.reason === 'backend_session_id_unknown') {
          errorMsg = 'The server may have created a session but its ID was not received. Another session is blocked until the backend can look it up.';
        } else if (result.reason === 'watcher_id_unavailable') {
          errorMsg = 'A previous watcher may still be running, but its ID was not saved and the plugin cannot list watchers. Do not start another session.';
        } else if (result.watcherCleanupPending) {
          errorMsg = 'Native watcher cleanup is pending. Retry cleanup before starting or logging out.';
        } else if (result.backendCleanupPending) {
          errorMsg = 'The session could not start and backend cleanup is pending. Retry cleanup before starting again.';
        } else {
          errorMsg = result.note || result.reason || errorMsg;
        }
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Error starting session:', err);
      const status = getSafetySessionStatus();
      const needsCleanup =
        status.backendCleanupPending ||
        status.watcherCleanupPending ||
        status.sessionState === 'backend_create_unknown' ||
        status.sessionState === 'watcher_reconciliation_pending' ||
        status.sessionState === 'failed_watcher_stuck';
      setSessionActive(status.sessionState === 'active');
      setCleanupPending(needsCleanup);
      setSessionId(needsCleanup ? status.activeSessionId : null);
      setError('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await stopSafetySession();

      if (result.success) {
        setSessionActive(false);
        setCleanupPending(false);
        setSessionId(null);
        setLocationSyncPending(result.locationSyncPending === true);
        setSuccessMessage(
          result.locationSyncPending
            ? 'Safety session ended, but the latest location could not be synced.'
            : 'Safety session stopped successfully!'
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setSessionActive(false);
        const needsCleanup = result.cleanupPending === true ||
          result.backendCleanupPending === true ||
          result.watcherCleanupPending === true ||
          result.reason === 'watcher_removal_failed';
        setCleanupPending(needsCleanup);
        setSessionId(needsCleanup ? (result.sessionId || result.stoppedSessionId || sessionId) : null);
        if (result.locationSyncPending !== undefined) {
          setLocationSyncPending(result.locationSyncPending);
        }
        let errorMsg = 'Failed to stop safety session';
        if (result.reason === 'invalid_state') {
          errorMsg = `Cannot stop session in current state: ${result.currentState}`;
        } else if (result.reason === 'watcher_removal_failed') {
          errorMsg = 'Tracking is still running because the watcher could not be removed. Retry cleanup before logging out.';
        } else if (result.reason === 'watcher_id_unavailable') {
          errorMsg = 'A previous native watcher may remain, but the plugin cannot discover its ID. New sessions remain blocked.';
        } else if (result.reason === 'backend_session_id_unknown') {
          errorMsg = 'The server may have created a session but the client did not receive its ID. Backend recovery is required before another session can start.';
        } else if (result.watcherCleanupPending) {
          errorMsg = 'Native watcher cleanup is still pending. Retry cleanup before starting another session.';
        } else if (result.backendCleanupPending) {
          errorMsg = 'Tracking stopped, but backend session cleanup is pending. Retry to confirm the session has ended.';
        } else {
          errorMsg = result.note || result.reason || errorMsg;
        }
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Error stopping session:', err);
      const status = getSafetySessionStatus();
      const needsCleanup =
        status.backendCleanupPending ||
        status.watcherCleanupPending ||
        status.sessionState === 'backend_create_unknown' ||
        status.sessionState === 'watcher_reconciliation_pending' ||
        status.sessionState === 'failed_watcher_stuck';
      setSessionActive(status.sessionState === 'active');
      setCleanupPending(needsCleanup);
      setSessionId(needsCleanup ? status.activeSessionId : null);
      setError('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Spheriva</h1>
            <p className="text-sm opacity-90">Your Safety Companion</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* User Info Card */}
      <div className="p-4">
        <div className="bg-white rounded-xl shadow-md p-6 mb-4">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Welcome, {user?.name || 'User'}!
          </h2>
          <p className="text-gray-600 text-sm">{user?.email}</p>
          <p className="text-gray-600 text-sm">{user?.phoneNumber}</p>
        </div>

        {/* Safety Session Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Safety Session</h3>

          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          {/* Active Session Info */}
          {(sessionActive || cleanupPending) && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${sessionActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
                <p className="text-sm font-medium text-blue-900">
                  {sessionActive ? 'Session Active' : 'Session cleanup pending'}
                </p>
              </div>
              {sessionId && (
                <p className="text-xs text-blue-700 mt-1 font-mono">
                  ID: {sessionId.substring(0, 20)}...
                </p>
              )}
            </div>
          )}
          {locationSyncPending && (
            <div role="status" className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
              {sessionActive
                ? 'A location update could not sync. Tracking will continue and retry with a newer update.'
                : 'The latest location could not sync before tracking stopped.'}
            </div>
          )}

          <div className="space-y-3">
            {/* Start/Stop Session Button */}
            {!sessionActive && !cleanupPending ? (
              <button
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold transition shadow-lg flex items-center justify-center"
                onClick={handleStartSession}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Starting Session...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Safety Session
                  </>
                )}
              </button>
            ) : (
              <button
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold transition shadow-lg flex items-center justify-center"
                onClick={handleStopSession}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Stopping Session...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    {cleanupPending ? 'Retry Session Cleanup' : 'Stop Safety Session'}
                  </>
                )}
              </button>
            )}

            {/* Emergency SOS Button */}
            <button
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-semibold transition shadow-lg flex items-center justify-center"
              onClick={() => alert('Emergency SOS feature coming soon!')}
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Emergency SOS
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Session History */}
            <button
              className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg transition text-center"
              onClick={() => navigate('/history')}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">History</p>
            </button>

            {/* Trusted Contacts */}
            <button
              className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg transition text-center"
              onClick={() => navigate('/contacts')}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">Contacts</p>
            </button>

            {/* Settings */}
            <button
              className="bg-gray-50 hover:bg-gray-100 p-4 rounded-lg transition text-center"
              onClick={() => alert('Settings coming soon!')}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">Settings</p>
            </button>

            {/* Profile */}
            <button
              className="bg-green-50 hover:bg-green-100 p-4 rounded-lg transition text-center"
              onClick={() => navigate('/profile')}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">Profile</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
