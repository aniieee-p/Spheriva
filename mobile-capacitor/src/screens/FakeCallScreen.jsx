import '../styles/secondary-ui.css';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const callDelays = [
  { label: 'Call Now', value: 0 },
  { label: 'After 10 seconds', value: 10 },
  { label: 'After 30 seconds', value: 30 },
  { label: 'After 1 minute', value: 60 },
  { label: 'After 5 minutes', value: 300 }
];

export default function FakeCallScreen() {
  const navigate = useNavigate();

  const [callerName, setCallerName] = useState('Mom');
  const [callType, setCallType] = useState('voice');
  const [delay, setDelay] = useState(0);
  const [scheduledCall, setScheduledCall] = useState(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!scheduledCall) return;

    const checkSchedule = () => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((scheduledCall.dueAt - Date.now()) / 1000)
      );

      setRemaining(secondsLeft);

      if (secondsLeft === 0) {
        clearInterval(timer);
        navigate('/fake-call/incoming', {
          replace: true,
          state: {
            callerName: scheduledCall.callerName,
            callType: scheduledCall.callType
          }
        });
      }
    };

    const timer = setInterval(checkSchedule, 250);
    checkSchedule();

    return () => clearInterval(timer);
  }, [scheduledCall, navigate]);

  const startFakeCall = () => {
    const name = callerName.trim();

    if (!name) {
      alert('Please enter a caller name');
      return;
    }

    if (delay === 0) {
      navigate('/fake-call/incoming', {
        state: { callerName: name, callType }
      });
      return;
    }

    setRemaining(delay);
    setScheduledCall({
      callerName: name,
      callType,
      dueAt: Date.now() + delay * 1000
    });
  };

  const cancelScheduledCall = () => {
    setScheduledCall(null);
    setRemaining(0);
  };

  return (
    <div className="sph-fake min-h-screen bg-gray-50 p-5">
      <button
        onClick={() => navigate('/home')}
        className="mb-6 text-purple-700 font-medium"
      >
        ← Back to Home
      </button>

      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Fake Call
        </h1>

        <p className="text-sm text-gray-500 mt-2 mb-6">
          Simulate an incoming voice or video call.
        </p>

        {scheduledCall ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">📞</div>

            <h2 className="text-xl font-bold text-purple-700">
              Fake Call Scheduled
            </h2>

            <p className="text-gray-500 mt-2">
              Incoming {scheduledCall.callType} call from{' '}
              {scheduledCall.callerName}
            </p>

            <div
              role="timer"
              className="text-5xl font-bold text-gray-900 my-8"
            >
              {String(Math.floor(remaining / 60)).padStart(2, '0')}:
              {String(remaining % 60).padStart(2, '0')}
            </div>

            <p className="text-sm text-gray-500 mb-6">
              Keep this screen open until the call begins.
            </p>

            <button
              type="button"
              onClick={cancelScheduledCall}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold"
            >
              Cancel Scheduled Call
            </button>
          </div>
        ) : (
          <>
            <label
              htmlFor="fake-caller-name"
              className="block font-medium mb-2"
            >
              Caller Name
            </label>

            <input
              id="fake-caller-name"
              type="text"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              maxLength={40}
              className="w-full border rounded-xl p-3 mb-6"
              placeholder="Enter caller name"
            />

            <label className="block font-medium mb-3">
              Call Type
            </label>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setCallType('voice')}
                className={`p-4 rounded-xl border ${
                  callType === 'voice'
                    ? 'bg-purple-100 border-purple-600'
                    : 'bg-gray-50'
                }`}
              >
                📞 Voice Call
              </button>

              <button
                type="button"
                onClick={() => setCallType('video')}
                className={`p-4 rounded-xl border ${
                  callType === 'video'
                    ? 'bg-purple-100 border-purple-600'
                    : 'bg-gray-50'
                }`}
              >
                📹 Video Call
              </button>
            </div>

            <label
              htmlFor="fake-call-delay"
              className="block font-medium mb-2"
            >
              Schedule Fake Call
            </label>

            <select
              id="fake-call-delay"
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              className="w-full border rounded-xl p-3 mb-8 bg-white"
            >
              {callDelays.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={startFakeCall}
              className="w-full bg-purple-700 hover:bg-purple-800 text-white py-3 rounded-xl font-semibold"
            >
              {delay === 0 ? 'Start Fake Call' : 'Schedule Fake Call'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
