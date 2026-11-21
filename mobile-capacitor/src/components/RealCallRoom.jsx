import React from 'react';
import {
  StreamVideo,
  StreamCall,
  StreamTheme,
  SpeakerLayout,
  CallControls,
} from '@stream-io/video-react-sdk';

import '@stream-io/video-react-sdk/dist/css/styles.css';

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
              <p className="text-sm text-slate-400">
                Secure Voice & Video Calling
              </p>
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
