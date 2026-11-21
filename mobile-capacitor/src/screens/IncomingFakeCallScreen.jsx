import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useFakeCallAlert from '../components/useFakeCallAlert';

export default function IncomingFakeCallScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { startAlert, stopAlert, soundOn } = useFakeCallAlert();

  const [caller] = useState(() => ({
    callerName: location.state?.callerName || 'Mom',
    callType: location.state?.callType === 'video' ? 'video' : 'voice'
  }));

  const rejectCall = () => {
    stopAlert();
    navigate('/fake-call', { replace: true });
  };

  const acceptCall = () => {
    stopAlert();
    navigate('/fake-call/active', {
      replace: true,
      state: caller
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-950 text-white flex flex-col items-center justify-between px-6 py-16">

      <div className="text-center">
        <p className="text-sm tracking-widest text-purple-200 uppercase mb-8">
          Simulated Incoming {caller.callType === 'video' ? 'Video' : 'Voice'} Call
        </p>

        <div className="relative w-32 h-32 mx-auto mb-7">
          <div className="absolute inset-0 bg-purple-400/30 rounded-full animate-ping" />
          <div className="relative w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-xl">
            <span className="text-6xl font-bold">
              {caller.callerName.trim().charAt(0).toUpperCase() || 'M'}
            </span>
          </div>
        </div>

        <h1 className="text-4xl font-semibold">
          {caller.callerName}
        </h1>

        <p className="mt-4 text-gray-300">
          Incoming call...
        </p>
        <button
          type="button"
          onClick={soundOn ? stopAlert : startAlert}
          className="mt-5 px-5 py-3 rounded-full bg-white/15 hover:bg-white/25 text-sm"
        >
          {soundOn ? '🔕 Silence Ringtone' : '🔔 Play Ringtone'}
        </button>
      </div>

      <div className="w-full max-w-sm flex justify-around items-center">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={rejectCall}
            className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg"
            aria-label="Decline fake call"
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round"
              strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M3 15.5c5-5 13-5 18 0l-2.5 4-4-2-.5-3a13 13 0 00-4 0l-.5 3-4 2z"/>
            </svg>
          </button>
          <span className="text-sm font-medium">Decline</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={acceptCall}
            className="w-20 h-20 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center shadow-lg"
            aria-label="Accept fake call"
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round"
              strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013 5.18 2 2 0 015 3h3a2 2 0 012 1.72c.12.96.35 1.9.69 2.79a2 2 0 01-.45 2.11L9 10.87a16 16 0 006.13 6.13l1.25-1.24a2 2 0 012.11-.45c.89.34 1.83.57 2.79.69A2 2 0 0122 16.92z"/>
            </svg>
          </button>
          <span className="text-sm font-medium">Accept</span>
        </div>
      </div>
    </div>
  );
}
