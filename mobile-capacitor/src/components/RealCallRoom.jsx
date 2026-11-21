
import React, { useEffect, useState } from 'react';
import {
  StreamVideo,
  StreamCall,
  StreamTheme,
  SpeakerLayout,
  CallControls,
  CallingState,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';

import '@stream-io/video-react-sdk/dist/css/styles.css';

// Timer starts when another participant joins
function CallDurationTimer() {
  const { useCallCallingState, useRemoteParticipants } =
    useCallStateHooks();

  const callingState = useCallCallingState();
  const remoteParticipants = useRemoteParticipants();

  const [startedAt, setStartedAt] = useState(null);
  const [seconds, setSeconds] = useState(0);

  const connected =
    callingState === CallingState.JOINED &&
    remoteParticipants.length > 0;

  useEffect(() => {
    if (connected) {
      setStartedAt(previous => previous ?? Date.now());
    }
  }, [connected]);

  useEffect(() => {
    if (startedAt === null) return;

    const updateTimer = () => {
      setSeconds(
        Math.floor((Date.now() - startedAt) / 1000)
      );
    };

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const pad = value => String(value).padStart(2, '0');

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
          connected ? 'bg-green-400' : 'bg-amber-400'
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

export default function RealCallRoom({
  client,
  call,
  contactName = 'Spheriva Contact',
  onLeave,
}) {
  if (!client || !call) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-5">📞</div>

        <h1 className="text-2xl font-bold mb-3">
          Secure Calling
        </h1>

        <p className="text-slate-300 text-center">
          Secure calling connection is not ready yet.
        </p>

        <button
          type="button"
          onClick={onLeave}
          className="mt-8 bg-purple-600 px-6 py-3 rounded-xl font-semibold"
        >
          Back to Contacts
        </button>
      </div>
    );
  }

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

              <div className="p-4 bg-slate-900">
                <CallControls onLeave={onLeave} />
              </div>

            </main>
          </div>
        </StreamTheme>
      </StreamCall>
    </StreamVideo>
  );
}
