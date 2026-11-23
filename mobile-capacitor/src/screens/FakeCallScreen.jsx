
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Video,
  PhoneIncoming,
  ShieldCheck,
  Clock3,
  ArrowLeft,
  LockKeyhole,
  X,
} from 'lucide-react';

import '../styles/secondary-ui.css';

const callDelays = [
  { label: 'Immediately', value: 0 },
  { label: 'After 10 seconds', value: 10 },
  { label: 'After 30 seconds', value: 30 },
  { label: 'After 1 minute', value: 60 },
  { label: 'After 5 minutes', value: 300 },
];

export default function FakeCallScreen() {
  const navigate = useNavigate();

  const [callerName, setCallerName] = useState('Mom');
  const [callType, setCallType] = useState('voice');
  const [delay, setDelay] = useState(0);
  const [scheduledCall, setScheduledCall] = useState(null);
  const [remaining, setRemaining] = useState(0);

  // Scheduled Fake Call Countdown
  useEffect(() => {
    if (!scheduledCall) return;

    const checkSchedule = () => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((scheduledCall.dueAt - Date.now()) / 1000)
      );

      setRemaining(secondsLeft);

      if (secondsLeft === 0) {
        navigate('/fake-call/incoming', {
          replace: true,
          state: {
            callerName: scheduledCall.callerName,
            callType: scheduledCall.callType,
          },
        });
      }
    };

    const timer = setInterval(checkSchedule, 250);
    checkSchedule();

    return () => clearInterval(timer);
  }, [scheduledCall, navigate]);

  // Start Fake Call
  const startFakeCall = () => {
    const name = callerName.trim();

    if (!name) {
      alert('Please enter a caller name');
      return;
    }

    if (delay === 0) {
      navigate('/fake-call/incoming', {
        state: {
          callerName: name,
          callType,
        },
      });
      return;
    }

    setRemaining(delay);

    setScheduledCall({
      callerName: name,
      callType,
      dueAt: Date.now() + delay * 1000,
    });
  };

  // Cancel Scheduled Call
  const cancelScheduledCall = () => {
    setScheduledCall(null);
    setRemaining(0);
  };

  // Format Countdown Timer
  const formatTime = (value) => {
    const minutes = String(
      Math.floor(value / 60)
    ).padStart(2, '0');

    const seconds = String(value % 60).padStart(2, '0');

    return `${minutes}:${seconds}`;
  };

  const initials =
    callerName.trim().charAt(0).toUpperCase() || 'M';

  return (
    <div className="min-h-screen bg-[#E8EFF2] text-[#173B47] px-4 py-7 pb-28 sm:px-6">

      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-[#47646D] hover:text-[#0F766E] transition"
          >
            <ArrowLeft size={21} />
            <span className="text-sm font-medium">
              Back
            </span>
          </button>

          <div className="flex items-center gap-2">
            <ShieldCheck
              size={24}
              className="text-[#0F766E]"
            />

            <span className="font-bold tracking-[0.18em] text-sm text-[#173B47]">
              SPHERIVA
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#C6E4E1] via-[#D7E9E7] to-[#DDDCEF] p-6 mb-5 border border-[#B8D8D5]">

          <div className="absolute -right-10 -top-12 w-44 h-44 rounded-full bg-teal-300/20 blur-2xl" />

          <div className="relative">

            <span className="text-[#0F766E] text-xs font-semibold tracking-[0.18em] uppercase">
              Personal Safety
            </span>

            <h1 className="text-3xl font-bold mt-3 mb-2 text-[#173B47]">
              Fake Call
            </h1>

            <p className="text-[#47646D] text-sm leading-6 max-w-sm">
              Create a realistic incoming call and feel safer
              with a familiar recorded voice.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#E5F3F1] border border-[#B1D7D1] px-3 py-2">

              <span className="w-2 h-2 bg-[#0F766E] rounded-full" />

              <span className="text-xs text-[#245B59]">
                Offline voice recording available
              </span>

            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl bg-[#F2F6F7] border border-[#C9DADD] p-5 sm:p-7 shadow-lg shadow-slate-400/10">

          {scheduledCall ? (

            /* Scheduled Call Screen */
            <div className="text-center py-8">

              <div className="w-24 h-24 rounded-full bg-[#D5E9E7] flex items-center justify-center mx-auto mb-6">
                <PhoneIncoming
                  size={42}
                  className="text-[#0F766E]"
                />
              </div>

              <h2 className="text-2xl font-bold text-[#173B47]">
                Call Scheduled
              </h2>

              <p className="text-[#607782] text-sm mt-3">
                Incoming {scheduledCall.callType} call from
              </p>

              <p className="text-[#0F766E] font-semibold text-xl mt-1">
                {scheduledCall.callerName}
              </p>

              <div
                role="timer"
                className="text-6xl font-bold tracking-wider text-[#173B47] my-10"
              >
                {formatTime(remaining)}
              </div>

              <p className="text-sm text-[#607782] mb-7">
                Keep this page open until the call begins.
              </p>

              <button
                type="button"
                onClick={cancelScheduledCall}
                className="w-full py-4 rounded-2xl bg-red-50 text-red-700 border border-red-200 font-semibold hover:bg-red-100 transition flex items-center justify-center gap-2"
              >
                <X size={20} />
                Cancel Scheduled Call
              </button>

            </div>

          ) : (

            <>
              {/* Caller Preview */}
              <div className="flex items-center gap-4 bg-[#DFEBED] rounded-2xl p-4 mb-7 border border-[#D0E0E3]">

                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#71BDB5] to-[#16877E] flex items-center justify-center text-3xl font-bold text-white shrink-0">
                  {initials}
                </div>

                <div className="flex-1 min-w-0">

                  <p className="text-xs text-[#607782] mb-1">
                    INCOMING CALL PREVIEW
                  </p>

                  <p className="text-lg font-semibold text-[#173B47] truncate">
                    {callerName.trim() || 'Unknown caller'}
                  </p>

                  <p className="text-sm text-[#0F766E]">
                    {callType === 'voice'
                      ? 'Voice call'
                      : 'Video call'}
                  </p>

                </div>

                <div className="w-11 h-11 rounded-full bg-[#C5E6E1] flex items-center justify-center text-[#0F766E]">
                  {callType === 'voice' ? (
                    <PhoneIncoming size={23} />
                  ) : (
                    <Video size={23} />
                  )}
                </div>

              </div>

              {/* Caller Name */}
              <label
                htmlFor="fake-caller-name"
                className="block text-sm font-semibold mb-3 text-[#254854]"
              >
                Caller Name
              </label>

              <input
                id="fake-caller-name"
                type="text"
                maxLength={40}
                value={callerName}
                onChange={(e) =>
                  setCallerName(e.target.value)
                }
                placeholder="Enter caller name"
                className="w-full rounded-xl bg-[#E3ECEF] border border-[#C7D7DC] px-4 py-4 text-[#173B47] placeholder:text-[#7B919B] focus:outline-none focus:ring-2 focus:ring-[#0F766E] mb-7"
              />

              {/* Call Type */}
              <label className="block text-sm font-semibold mb-3 text-[#254854]">
                Choose Call Type
              </label>

              <div className="grid grid-cols-2 gap-3 mb-7">

                {/* Voice Call */}
                <button
                  type="button"
                  aria-pressed={callType === 'voice'}
                  onClick={() => setCallType('voice')}
                  className={`rounded-2xl py-5 flex flex-col items-center gap-3 border transition ${
                    callType === 'voice'
                      ? 'border-[#0F766E] bg-[#B8DDD8] text-[#164E49]'
                      : 'border-[#CEDCE0] bg-[#E3ECEF] text-[#526A76] hover:bg-[#D8E7E9]'
                  }`}
                >
                  <Phone size={27} strokeWidth={2} />
                  <span className="text-sm font-semibold">
                    Voice Call
                  </span>
                </button>

                {/* Video Call */}
                <button
                  type="button"
                  aria-pressed={callType === 'video'}
                  onClick={() => setCallType('video')}
                  className={`rounded-2xl py-5 flex flex-col items-center gap-3 border transition ${
                    callType === 'video'
                      ? 'border-[#0F766E] bg-[#B8DDD8] text-[#164E49]'
                      : 'border-[#CEDCE0] bg-[#E3ECEF] text-[#526A76] hover:bg-[#D8E7E9]'
                  }`}
                >
                  <Video size={27} strokeWidth={2} />
                  <span className="text-sm font-semibold">
                    Video Call
                  </span>
                </button>

              </div>

              {/* Schedule Fake Call */}
              <label
                htmlFor="fake-call-delay"
                className="flex items-center gap-2 text-sm font-semibold mb-3 text-[#254854]"
              >
                <Clock3
                  size={19}
                  className="text-[#0F766E]"
                />
                When should it ring?
              </label>

              <select
                id="fake-call-delay"
                value={delay}
                onChange={(e) =>
                  setDelay(Number(e.target.value))
                }
                className="w-full rounded-xl bg-[#E3ECEF] border border-[#C7D7DC] px-4 py-4 text-[#173B47] focus:outline-none focus:ring-2 focus:ring-[#0F766E] mb-8"
              >
                {callDelays.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Start Fake Call */}
              <button
                type="button"
                onClick={startFakeCall}
                className="w-full rounded-2xl bg-[#0F766E] hover:bg-[#0B5F58] text-white py-4 font-bold text-base transition shadow-md shadow-teal-900/10"
              >
                <span className="flex items-center justify-center gap-3">

                  {delay === 0 ? (
                    <Phone size={21} />
                  ) : (
                    <Clock3 size={21} />
                  )}

                  {delay === 0
                    ? 'Start Fake Call'
                    : 'Schedule Fake Call'}

                </span>
              </button>

              {/* Privacy Information */}
              <div className="flex items-center justify-center gap-2 text-xs text-[#607782] mt-5">
                <LockKeyhole size={14} />
                <span>
                  Private • No paid API required
                </span>
              </div>

            </>
          )}

        </div>

        {/* Safety Note */}
        <div className="flex gap-3 mt-5 px-3 text-[#607782] text-xs leading-5">

          <ShieldCheck
            size={20}
            className="text-[#0F766E] shrink-0"
          />

          <p>
            Fake Call simulates a conversation.
            It does not connect to a real person
            or emergency service.
          </p>

        </div>

      </div>
    </div>
  );
}
