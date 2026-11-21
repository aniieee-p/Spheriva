
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  StreamVideo,
  StreamCall,
  StreamTheme,
  SpeakerLayout,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
  ScreenShareButton,
  CallingState,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';

import { apiService } from '../services/api.service';

import '@stream-io/video-react-sdk/dist/css/styles.css';

// ========================================
// Call duration timer
// ========================================

function CallDurationTimer() {
  const {
    useCallCallingState,
    useRemoteParticipants,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const remoteParticipants = useRemoteParticipants();

  const [startedAt, setStartedAt] = useState(null);
  const [seconds, setSeconds] = useState(0);

  const connected =
    callingState === CallingState.JOINED &&
    remoteParticipants.length > 0;

  useEffect(() => {
    if (connected) {
      setStartedAt(
        (previous) => previous ?? Date.now()
      );
    }
  }, [connected]);

  useEffect(() => {
    if (startedAt === null) return;

    const updateTimer = () => {
      setSeconds(
        Math.floor(
          (Date.now() - startedAt) / 1000
        )
      );
    };

    updateTimer();

    const interval = setInterval(
      updateTimer,
      1000
    );

    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(
    (seconds % 3600) / 60
  );
  const remainingSeconds = seconds % 60;

  const pad = (value) =>
    String(value).padStart(2, '0');

  const duration =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`
      : `${pad(minutes)}:${pad(remainingSeconds)}`;

  return (
    <div
      className="flex items-center gap-2 mt-2"
      aria-label={`Call duration ${duration}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          connected
            ? 'bg-green-400'
            : 'bg-amber-400'
        }`}
      />

      <span className="text-sm text-slate-300">
        {startedAt !== null
          ? `Call duration: ${duration}`
          : 'Waiting for other participant...'}
      </span>
    </div>
  );
}

// ========================================
// Real call room
// ========================================

export default function RealCallRoom({
  client,
  call,
  contactName = 'Spheriva Contact',
  onLeave,
}) {
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');

  // Avoid running cleanup more than once
  const closingRef = useRef(false);
  const onLeaveRef = useRef(onLeave);

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  // Close the current user's call screen
  const closeCallScreen = useCallback(async () => {
    if (closingRef.current) return;

    closingRef.current = true;

    try {
      // Parent clears active call state
      // and releases local calling resources
      await onLeaveRef.current?.();
    } catch (err) {
      console.error(
        'Error cleaning up ended call:',
        err
      );
    }
  }, []);

  // ========================================
  // Listen when either participant ends call
  // ========================================

  useEffect(() => {
    if (!call) return;

    const unsubscribe = call.on(
      'call.ended',
      () => {
        console.log(
          'Spheriva: Call ended for everyone'
        );

        void closeCallScreen();
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [call, closeCallScreen]);

  // ========================================
  // End call for both participants
  // ========================================

  const handleEndCall = async () => {
    if (!call || ending || closingRef.current) {
      return;
    }

    setEnding(true);
    setError('');

    try {
      // Backend verifies authenticated membership
      // and ends the call for all Stream members
      const response = await apiService.endRealCall(
        call.id,
        call.type
      );

      if (!response?.success) {
        throw new Error(
          response?.message ||
          'Unable to end call'
        );
      }

      // Stream broadcasts call.ended to both users.
      // Also close locally in case the event is delayed.
      await closeCallScreen();

    } catch (err) {
      console.error(
        'End call failed:',
        err
      );

      setError(
        err.message ||
        'Unable to end call. Please try again.'
      );

    } finally {
      setEnding(false);
    }
  };

  // ========================================
  // Connection fallback
  // ========================================

  if (!client || !call) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-5">
          📞
        </div>

        <h1 className="text-2xl font-bold mb-3">
          Secure Calling
        </h1>

        <p className="text-slate-300">
          Secure calling connection is not ready yet.
        </p>

        <button
          type="button"
          onClick={() => void closeCallScreen()}
          className="mt-8 bg-purple-600 px-6 py-3 rounded-xl font-semibold"
        >
          Back to Contacts
        </button>
      </div>
    );
  }

  // ========================================
  // Active call UI
  // ========================================

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <StreamTheme>
          <div className="min-h-screen bg-slate-950 text-white flex flex-col">

            <header className="px-5 py-5 bg-slate-900">

              <p className="text-xs tracking-widest text-purple-300">
                SPHERIVA CONNECT
              </p>

              <h1 className="text-xl font-bold mt-1">
                {contactName}
              </h1>

              <CallDurationTimer />

            </header>

            <main className="flex-1 min-h-[360px] flex flex-col">

              <div className="flex-1 min-h-[300px]">
                <SpeakerLayout />
              </div>

              {error && (
                <div
                  role="alert"
                  className="mx-4 mb-3 rounded-xl bg-red-950 border border-red-600 p-3 text-red-200 text-sm"
                >
                  {error}
                </div>
              )}

              {/* Custom controls prevent the default
                  leave-only behavior */}

              <div className="p-4 bg-slate-900">

                <div className="flex flex-wrap items-center justify-center gap-4">

                  <ToggleAudioPublishingButton />

                  {call.type !== 'audio_call' && (
                    <>
                      <ToggleVideoPublishingButton />
                      <ScreenShareButton />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleEndCall()}
                    disabled={ending}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-full font-semibold"
                  >
                    {ending
                      ? 'Ending Call...'
                      : 'End Call'}
                  </button>

                </div>

                <p className="text-center text-xs text-slate-400 mt-3">
                  Ending this call disconnects both participants.
                </p>

              </div>

            </main>
          </div>
        </StreamTheme>
      </StreamCall>
    </StreamVideo>
  );
}
