import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AnimatedFakeCaller from '../components/AnimatedFakeCaller';

export default function ActiveFakeCallScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  const callerName = location.state?.callerName || 'Mom';
  const callType = location.state?.callType === 'video' ? 'video' : 'voice';

  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (value) => {
    const minutes = Math.floor(value / 60);
    const remainingSeconds = value % 60;

    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-purple-950 text-white flex flex-col justify-between items-center px-6 py-14">
      <div className="text-center w-full">
        <p className="text-sm text-purple-200 mb-6">
          Simulated {callType === 'video' ? 'Video' : 'Voice'} Call
        </p>

        {callType === 'voice' && (
          <>
            <div className="w-32 h-32 bg-purple-600 rounded-full mx-auto flex items-center justify-center text-6xl mb-6">
              👤
            </div>
            <h1 className="text-3xl font-bold">{callerName}</h1>
          </>
        )}

        <p className="mt-3 text-lg text-gray-300">
          {formatTime(seconds)}
        </p>

        {callType === 'video' && (
          <div className="mt-8 bg-gray-800 rounded-2xl overflow-hidden">
            <AnimatedFakeCaller callerName={callerName} />
          </div>
        )}
      </div>

      <div className="w-full max-w-sm flex justify-evenly items-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted(prev => !prev)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition ${
              muted ? 'bg-white text-gray-900' : 'bg-gray-700 text-white'
            }`}
            aria-label={muted ? 'Unmute simulated call' : 'Mute simulated call'}
            aria-pressed={muted}
          >
            {muted ? (
              <span className="text-2xl">🔇</span>
            ) : (
              <svg className="w-7 h-7" fill="none" stroke="currentColor"
                strokeWidth="2" viewBox="0 0 24 24">
                <rect x="9" y="2" width="6" height="12" rx="3"/>
                <path d="M5 10a7 7 0 0014 0M12 17v5m-4 0h8"/>
              </svg>
            )}
          </button>
          <span className="text-xs">{muted ? 'Unmute' : 'Mute'}</span>
        </div>

        {callType === 'video' && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setCameraOn(prev => !prev)}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition ${
                cameraOn ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
              }`}
              aria-label={cameraOn ? 'Turn simulated camera off' : 'Turn simulated camera on'}
              aria-pressed={!cameraOn}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                viewBox="0 0 24 24">
                <rect x="3" y="5" width="13" height="14" rx="2"/>
                <path d="m16 10 5-3v10l-5-3"/>
                {!cameraOn && <path d="M2 2l20 20"/>}
              </svg>
            </button>
            <span className="text-xs">{cameraOn ? 'Camera' : 'Camera Off'}</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/fake-call', { replace: true })}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition"
            aria-label="End fake call"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              viewBox="0 0 24 24">
              <path d="M3 15.5c5-5 13-5 18 0l-2.5 4-4-2-.5-3a13 13 0 00-4 0l-.5 3-4 2z"/>
            </svg>
          </button>
          <span className="text-xs">End Call</span>
        </div>
      </div>
    </div>
  );
}
