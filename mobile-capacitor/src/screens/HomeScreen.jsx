
/**
 * SPHERIVA
 * Safety Control Center
 *
 * Existing SOS and safety tracking functionality
 * with redesigned professional UI.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import {
  startSafetySession,
  stopSafetySession,
  getSafetySessionStatus,
} from '../services/trackingService';

import { Geolocation } from '@capacitor/geolocation';
import apiService from '../services/api.service';

import {
  ShieldCheck,
  Siren,
  Navigation,
  MapPin,
  ArrowLeft,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Users,
  Phone,
  ChevronRight,
  RefreshCw,
  Activity,
  LockKeyhole,
} from 'lucide-react';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ==========================================
  // SESSION STATES
  // ==========================================

  const [sessionActive, setSessionActive] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [locationSyncPending, setLocationSyncPending] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [sosLoading, setSosLoading] = useState(false);
  const sosInFlight = useRef(false);

  // ==========================================
  // CHECK SESSION STATUS
  // ==========================================

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
        setError(
          'A previous create request may have made a server session, but its ID is unavailable. The backend currently cannot look up that session.'
        );
      } else if (
        status.recoveryReason === 'active_session_already_exists'
      ) {
        setError(
          'An active safety session already exists for this account, possibly on another device. This device will not adopt or end it.'
        );
      } else if (status.recoveryReason === 'watcher_id_unavailable') {
        setError(
          'A previous native watcher may still exist, but the plugin cannot discover its ID. New sessions are blocked.'
        );
      } else if (status.recoveryReason === 'watcher_removal_failed') {
        setError(
          'Removing the previous native watcher failed. Retry cleanup before starting another session.'
        );
      } else if (status.recoveryReason === 'tracking_state_read_failed') {
        setError(
          'Saved tracking state could not be read. A new session is blocked until recovery succeeds.'
        );
      } else if (!needsCleanup) {
        setError(null);
      }

      if (isActive || needsCleanup) {
        setSessionId(status.activeSessionId);
      } else {
        setSessionId(null);
      }
    };

    checkSessionStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionStatus();
      }
    };

    const handleLocationSyncState = (event) => {
      setLocationSyncPending(event.detail?.pending === true);
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    window.addEventListener(
      'spheriva:location-sync-state',
      handleLocationSyncState
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );

      window.removeEventListener(
        'spheriva:location-sync-state',
        handleLocationSyncState
      );
    };
  }, []);

  // ==========================================
  // EMERGENCY SOS HANDLER
  // ==========================================

  const handleSOS = async () => {
    if (sosInFlight.current) return;

    const accountId = user?.id || user?._id;

    if (!accountId) {
      setError('Please sign in before recording an SOS alert.');
      return;
    }

    const pendingKey = `spheriva:sos-pending:${accountId}`;

    let pendingRequest;

    try {
      const stored = sessionStorage.getItem(pendingKey);

      pendingRequest = stored ? JSON.parse(stored) : null;
    } catch {
      setError(
        'Could not access SOS retry state. No request was sent.'
      );
      return;
    }

    const isRetry = Boolean(pendingRequest?.clientRequestId);

    const confirmed = window.confirm(
      isRetry
        ? 'A previous SOS request may already be recorded. Retry the SAME request to check its result?'
        : 'Record an emergency SOS alert? This saves an alert on the server, but does not yet confirm notifications to trusted contacts.'
    );

    if (!confirmed) return;

    sosInFlight.current = true;

    setSosLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let alertData = pendingRequest;

      if (!isRetry) {
        if (!globalThis.crypto?.getRandomValues) {
          throw new Error(
            'Secure request ID generation is unavailable. SOS was not sent.'
          );
        }

        const bytes = new Uint8Array(16);

        globalThis.crypto.getRandomValues(bytes);

        const clientRequestId = Array.from(
          bytes,
          (byte) => byte.toString(16).padStart(2, '0')
        ).join('');

        alertData = {
          clientRequestId,
          situation: 'User triggered emergency SOS',
        };

        // Location failure must not silently block SOS.

        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });

          if (
            Number.isFinite(position?.coords?.latitude) &&
            Number.isFinite(position?.coords?.longitude)
          ) {
            alertData.latitude = position.coords.latitude;
            alertData.longitude = position.coords.longitude;

            if (Number.isFinite(position.coords.accuracy)) {
              alertData.accuracy = position.coords.accuracy;
            }
          }
        } catch (locationError) {
          console.warn('SOS location unavailable:', locationError);

          const continueWithoutLocation = window.confirm(
            'GPS location is unavailable. Record the SOS alert without location?'
          );

          if (!continueWithoutLocation) return;
        }

        if (sessionActive && sessionId && !cleanupPending) {
          alertData.sessionId = sessionId;
        }

        sessionStorage.setItem(
          pendingKey,
          JSON.stringify(alertData)
        );
      }

      const result = await apiService.sendEmergencyAlert(alertData);

      if (result?.success === true) {
        sessionStorage.removeItem(pendingKey);

        setSuccessMessage(
          'SOS alert recorded on the server. Trusted-contact notification is not confirmed.'
        );
      } else {
        setError(
          result?.message ||
          'SOS result is uncertain. Retry using the same request.'
        );
      }
    } catch (err) {
      if (
        err?.status >= 400 &&
        err?.status < 500 &&
        err.status !== 408 &&
        err.status !== 429
      ) {
        try {
          sessionStorage.removeItem(pendingKey);
        } catch {
          // No operation
        }
      }

      setError(
        err?.status === 0
          ? 'Network or timeout error. SOS may have been recorded. Retry using the same request ID when connected.'
          : err?.message ||
            'Unable to confirm SOS alert. Please try again.'
      );
    } finally {
      sosInFlight.current = false;
      setSosLoading(false);
    }
  };

  // ==========================================
  // START SAFETY SESSION
  // ==========================================

  const handleStartSession = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await startSafetySession({
        userId: user?.id || user?._id,
        backgroundMessage: `${
          user?.name || 'User'
        } is being tracked for safety`,
        backgroundTitle: 'Spheriva Safety Session Active',
        distanceFilter: 10,
      });

      if (result.success) {
        setSessionActive(true);
        setCleanupPending(false);
        setSessionId(result.sessionId);

        setSuccessMessage(
          'Safety session started successfully!'
        );

        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setSessionActive(false);

        const needsCleanup =
          result.cleanupPending === true ||
          result.backendCleanupPending === true ||
          result.watcherCleanupPending === true;

        setCleanupPending(needsCleanup);
        setSessionId(result.sessionId || null);

        let errorMsg = 'Failed to start safety session';

        if (result.reason === 'invalid_options') {
          errorMsg =
            'Invalid session options: ' +
            result.errors.join(', ');
        } else if (
          result.reason === 'location_permission_denied'
        ) {
          errorMsg =
            'Location permission is required. Please enable it in Settings.';
        } else if (result.reason === 'stuck_watcher_exists') {
          errorMsg =
            result.note ||
            'Previous session cleanup required. Please retry cleanup.';
        } else if (result.reason === 'invalid_state') {
          errorMsg =
            result.note ||
            `Cannot start session in current state: ${result.currentState}`;
        } else if (
          result.reason === 'backend_create_result_unknown' ||
          result.reason === 'backend_session_id_unknown'
        ) {
          errorMsg =
            'The server may have created a session but its ID was not received. Another session is blocked until the backend can look it up.';
        } else if (result.reason === 'watcher_id_unavailable') {
          errorMsg =
            'A previous watcher may still be running, but its ID was not saved and the plugin cannot list watchers. Do not start another session.';
        } else if (result.watcherCleanupPending) {
          errorMsg =
            'Native watcher cleanup is pending. Retry cleanup before starting or logging out.';
        } else if (result.backendCleanupPending) {
          errorMsg =
            'The session could not start and backend cleanup is pending. Retry cleanup before starting again.';
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

      setSessionId(
        needsCleanup ? status.activeSessionId : null
      );

      setError('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // STOP SESSION / RETRY CLEANUP
  // ==========================================

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

        setLocationSyncPending(
          result.locationSyncPending === true
        );

        setSuccessMessage(
          result.locationSyncPending
            ? 'Safety session ended, but the latest location could not be synced.'
            : 'Safety session stopped successfully!'
        );

        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setSessionActive(false);

        const needsCleanup =
          result.cleanupPending === true ||
          result.backendCleanupPending === true ||
          result.watcherCleanupPending === true ||
          result.reason === 'watcher_removal_failed';

        setCleanupPending(needsCleanup);

        setSessionId(
          needsCleanup
            ? result.sessionId ||
              result.stoppedSessionId ||
              sessionId
            : null
        );

        if (result.locationSyncPending !== undefined) {
          setLocationSyncPending(
            result.locationSyncPending
          );
        }

        let errorMsg = 'Failed to stop safety session';

        if (result.reason === 'invalid_state') {
          errorMsg =
            `Cannot stop session in current state: ${result.currentState}`;
        } else if (
          result.reason === 'watcher_removal_failed'
        ) {
          errorMsg =
            'Tracking is still running because the watcher could not be removed. Retry cleanup before logging out.';
        } else if (
          result.reason === 'watcher_id_unavailable'
        ) {
          errorMsg =
            'A previous native watcher may remain, but the plugin cannot discover its ID. New sessions remain blocked.';
        } else if (
          result.reason === 'backend_session_id_unknown'
        ) {
          errorMsg =
            'The server may have created a session but the client did not receive its ID. Backend recovery is required before another session can start.';
        } else if (result.watcherCleanupPending) {
          errorMsg =
            'Native watcher cleanup is still pending. Retry cleanup before starting another session.';
        } else if (result.backendCleanupPending) {
          errorMsg =
            'Tracking stopped, but backend session cleanup is pending. Retry to confirm the session has ended.';
        } else {
          errorMsg =
            result.note || result.reason || errorMsg;
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

      setSessionId(
        needsCleanup ? status.activeSessionId : null
      );

      setError('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // PROFESSIONAL SAFETY CONTROL CENTER UI
  // ==========================================

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-900">

      {/* Top Navigation */}
      <header className="bg-[#0B1423] text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4">

          <button
            type="button"
            onClick={() => navigate('/home')}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>

          <div className="inline-flex items-center gap-2">
            <ShieldCheck
              size={25}
              className="text-teal-400"
            />

            <span className="font-extrabold tracking-widest text-lg">
              SPHERIVA
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 space-y-6">

        {/* Page Introduction */}
        <section className="flex flex-wrap items-end justify-between gap-4">

          <div>
            <p className="flex items-center gap-2 text-teal-700 font-bold text-xs uppercase tracking-[0.18em]">
              <ShieldCheck size={17} />
              Personal Safety
            </p>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
              Safety Control Center
            </h1>

            <p className="text-slate-500 text-sm sm:text-base mt-3 max-w-2xl">
              Manage safety sessions, location tracking,
              and emergency SOS alerts in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/history')}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm font-semibold hover:border-teal-300 hover:shadow-sm transition"
          >
            <Clock3 size={18} />
            View Session History
          </button>

        </section>

        {/* Error Feedback */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-50 border border-red-200 p-5 flex items-start gap-3 text-red-900"
          >
            <AlertTriangle
              size={21}
              className="shrink-0 mt-0.5"
            />

            <div>
              <p className="font-bold text-sm">
                Action Needs Attention
              </p>

              <p className="text-sm mt-1 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {successMessage && (
          <div
            role="status"
            className="rounded-2xl bg-teal-50 border border-teal-200 p-5 flex items-start gap-3 text-teal-900"
          >
            <CheckCircle2
              size={21}
              className="shrink-0 mt-0.5"
            />

            <p className="text-sm font-medium leading-relaxed">
              {successMessage}
            </p>
          </div>
        )}

        {/* Main Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ===================================
              SAFETY SESSION
          =================================== */}

          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">

            <div className="p-6 sm:p-8">

              <div className="flex items-start justify-between gap-3">

                <div className="w-14 h-14 bg-teal-50 rounded-2xl text-teal-700 flex items-center justify-center">
                  <Navigation size={28} />
                </div>

                <span
                  className={`text-xs font-bold px-3 py-2 rounded-full ${
                    cleanupPending
                      ? 'bg-amber-100 text-amber-800'
                      : sessionActive
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cleanupPending
                    ? 'Cleanup Pending'
                    : sessionActive
                    ? 'Tracking Active'
                    : 'Session Inactive'}
                </span>
              </div>

              <h2 className="text-2xl font-bold mt-6">
                Safety Session
              </h2>

              <p className="text-slate-500 text-sm leading-relaxed mt-2">
                Start safety tracking before a journey.
                Monitor session state and stop tracking
                when you are finished.
              </p>

              {/* Session Details */}
              <div className="mt-6 bg-[#F6FAF9] rounded-2xl p-5 border border-teal-100">

                <div className="flex items-start gap-3">

                  <MapPin
                    size={22}
                    className="shrink-0 text-teal-700"
                  />

                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Current Tracking Status
                    </p>

                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      {cleanupPending
                        ? 'A previous safety session requires cleanup or recovery before another session can start.'
                        : sessionActive
                        ? 'This device reports an active safety tracking session.'
                        : 'No active safety tracking session is reported on this device.'}
                    </p>
                  </div>

                </div>

                {sessionId && (
                  <div className="mt-4 border-t border-teal-100 pt-4">
                    <p className="text-xs text-slate-500 font-semibold">
                      Session Reference
                    </p>

                    <p className="text-xs font-mono text-slate-600 break-all mt-1">
                      {sessionId}
                    </p>
                  </div>
                )}

                {locationSyncPending && (
                  <div
                    role="status"
                    className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs leading-relaxed"
                  >
                    {sessionActive
                      ? 'A location update could not sync. Tracking continues and will retry with a newer update.'
                      : 'The latest location could not sync before tracking stopped.'}
                  </div>
                )}

              </div>

              {/* Functional Session Controls */}
              {!sessionActive && !cleanupPending ? (
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={loading || sosLoading}
                  className="w-full mt-6 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-5 py-4 text-white font-bold flex items-center justify-center gap-2 transition"
                >
                  <Navigation size={20} />

                  {loading
                    ? 'Starting Session...'
                    : 'Start Safety Session'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopSession}
                  disabled={loading || sosLoading}
                  className="w-full mt-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-5 py-4 text-white font-bold flex items-center justify-center gap-2 transition"
                >
                  <RefreshCw size={20} />

                  {loading
                    ? 'Processing Session...'
                    : cleanupPending
                    ? 'Retry Session Cleanup'
                    : 'Stop Safety Session'}
                </button>
              )}

              <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
                GPS permission may be requested.
                Session actions use the existing tracking service.
              </p>

            </div>
          </section>

          {/* ===================================
              EMERGENCY SOS
          =================================== */}

          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101B2B] via-[#301B2B] to-[#581B32] text-white shadow-sm">

            <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

            <div className="relative p-6 sm:p-8">

              <div className="w-14 h-14 bg-rose-500/20 border border-rose-300/20 rounded-2xl flex items-center justify-center text-rose-200">
                <Siren size={29} />
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-400/10 text-rose-200 px-3 py-2 mt-6 text-xs font-bold">
                <Activity size={15} />
                Server Alert Recording
              </span>

              <h2 className="text-3xl font-extrabold mt-5">
                Emergency SOS
              </h2>

              <p className="text-slate-300 text-sm mt-4 leading-relaxed">
                In an emergency, you can record an SOS alert
                on the backend. GPS coordinates will be
                attached when available.
              </p>

              <button
                type="button"
                onClick={handleSOS}
                disabled={sosLoading || loading}
                className="mt-7 w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-5 py-4 text-white font-bold flex justify-center items-center gap-3 transition"
              >
                <Siren size={22} />

                {sosLoading
                  ? 'Recording SOS...'
                  : 'Record Emergency SOS'}
              </button>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/10 p-4">

                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={20}
                    className="shrink-0 text-amber-300"
                  />

                  <div>
                    <p className="text-sm font-bold text-white">
                      Important Safety Information
                    </p>

                    <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                      SOS recording does not confirm
                      notification delivery to trusted contacts
                      or emergency services.
                    </p>

                    <p className="text-xs text-slate-200 mt-2">
                      For immediate emergency assistance
                      in India, dial 112.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          </section>

        </div>

        {/* ===================================
            QUICK ACCESS
        =================================== */}

        <section>
          <div className="flex items-center gap-3 mb-5">
            <LockKeyhole
              size={20}
              className="text-teal-700"
            />

            <h2 className="text-lg font-bold">
              Quick Safety Access
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Contacts */}
            <button
              type="button"
              onClick={() => navigate('/contacts')}
              className="bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md rounded-2xl p-5 flex items-center gap-4 text-left transition"
            >
              <span className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-700">
                <Users size={23} />
              </span>

              <span className="flex-1">
                <span className="block font-bold text-sm">
                  Trusted Contacts
                </span>

                <span className="block text-xs text-slate-500 mt-1">
                  Manage your trusted circle
                </span>
              </span>

              <ChevronRight
                size={18}
                className="text-slate-400"
              />
            </button>

            {/* Calling */}
            <button
              type="button"
              onClick={() => navigate('/real-calling')}
              className="bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md rounded-2xl p-5 flex items-center gap-4 text-left transition"
            >
              <span className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center text-sky-700">
                <Phone size={23} />
              </span>

              <span className="flex-1">
                <span className="block font-bold text-sm">
                  Voice & Video Calls
                </span>

                <span className="block text-xs text-slate-500 mt-1">
                  Open real calling center
                </span>
              </span>

              <ChevronRight
                size={18}
                className="text-slate-400"
              />
            </button>

            {/* History */}
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="bg-white border border-slate-200 hover:border-teal-300 hover:shadow-md rounded-2xl p-5 flex items-center gap-4 text-left transition"
            >
              <span className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center text-violet-700">
                <Clock3 size={23} />
              </span>

              <span className="flex-1">
                <span className="block font-bold text-sm">
                  Safety History
                </span>

                <span className="block text-xs text-slate-500 mt-1">
                  View your session records
                </span>
              </span>

              <ChevronRight
                size={18}
                className="text-slate-400"
              />
            </button>

          </div>
        </section>

        <footer className="text-center text-xs text-slate-400 py-5">
          Spheriva — Your Safety, Your Control.
        </footer>

      </main>
    </div>
  );
};

export default HomeScreen;
