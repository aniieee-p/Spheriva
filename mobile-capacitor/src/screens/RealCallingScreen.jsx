
import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';
import { CallingState } from '@stream-io/video-react-sdk';

import {
  ArrowLeft,
  ShieldCheck,
  Phone,
  Video,
  Search,
  Users,
  PhoneOff,
  Clock3,
  AlertCircle,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react';

import { apiService } from '../services/api.service';

import { useRealCalling } from '../components/IncomingRealCallManager';

import RealCallRoom from '../components/RealCallRoom';

const RING_TIMEOUT_SECONDS = 45;

// ======================================
// HELPERS
// ======================================

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remaining
  ).padStart(2, '0')}`;
};

// ======================================
// REAL CALLING SCREEN
// ======================================

export default function RealCallingScreen() {
  const navigate = useNavigate();

  const { client } = useRealCalling() || {};

  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [calling, setCalling] = useState(false);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const [secondsLeft, setSecondsLeft] = useState(
    RING_TIMEOUT_SECONDS
  );

  const startingRef = useRef(false);
  const outgoingRef = useRef(null);
  const connectedRef = useRef(false);

  // ======================================
  // LOAD TRUSTED CONTACTS
  // ======================================

  useEffect(() => {
    let cancelled = false;

    const loadContacts = async () => {
      try {
        const response =
          await apiService.getEmergencyContacts();

        if (cancelled) return;

        if (!response?.success) {
          throw new Error(
            response?.message || 'Unable to load contacts'
          );
        }

        setContacts(response.data?.contacts || []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || 'Could not load trusted contacts'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadContacts();

    return () => {
      cancelled = true;
    };
  }, []);

  // ======================================
  // CLEAR OUTGOING CALL STATE
  // ======================================

  const clearOutgoingState = () => {
    outgoingRef.current = null;

    setOutgoingCall(null);
    setCalling(false);

    startingRef.current = false;
  };

  // ======================================
  // CANCEL UNANSWERED CALL
  // ======================================

  const cancelOutgoing = async (
    message = 'Call cancelled',
    reason = 'cancel'
  ) => {
    const current = outgoingRef.current;

    if (!current || connectedRef.current) {
      return;
    }

    clearOutgoingState();
    setNotice(message);

    try {
      await current.call.leave({
        reject: true,
        reason,
      });
    } catch (err) {
      console.error(
        'Could not cancel outgoing call:',
        err
      );

      setError(
        err.message ||
          'Could not complete call cancellation'
      );
    }
  };

  // ======================================
  // START REAL VOICE / VIDEO CALL
  // ======================================

  const requestCall = async (contact, type) => {
    if (
      startingRef.current ||
      outgoingRef.current ||
      activeCall
    ) {
      return;
    }

    if (!client) {
      setError(
        'Calling service is connecting. Please try again.'
      );
      return;
    }

    startingRef.current = true;
    connectedRef.current = false;

    setCalling(true);
    setError('');
    setNotice('');

    try {
      const selectedType =
        type === 'Voice' ? 'voice' : 'video';

      // Existing backend call creation
      const response = await apiService.createRealCall(
        contact._id,
        selectedType
      );

      if (!response?.success || !response?.data) {
        throw new Error(
          response?.message || 'Unable to create call'
        );
      }

      const { callId, callType } = response.data;

      if (!callId || !callType) {
        throw new Error(
          'Backend returned incomplete call details'
        );
      }

      // Existing shared Stream client
      const call = client.call(callType, callId);

      const outgoing = {
        call,
        contactName: contact.name,
        type: selectedType,
        startedAt: Date.now(),
      };

      outgoingRef.current = outgoing;

      setSecondsLeft(RING_TIMEOUT_SECONDS);
      setOutgoingCall(outgoing);

      // Fetch call without joining before acceptance
      await call.get();
    } catch (err) {
      console.error(
        'Outgoing calling failed:',
        err
      );

      const current = outgoingRef.current;

      clearOutgoingState();

      if (current && !connectedRef.current) {
        try {
          await current.call.leave({
            reject: true,
            reason: 'cancel',
          });
        } catch (cleanupError) {
          console.error(
            'Failed to cancel unsuccessful call:',
            cleanupError
          );
        }
      }

      setError(
        err.message || 'Unable to start real call'
      );
    } finally {
      startingRef.current = false;
      setCalling(false);
    }
  };

  // ======================================
  // STREAM CALL EVENTS
  // ======================================

  useEffect(() => {
    if (!client || !outgoingCall) {
      return;
    }

    const { call } = outgoingCall;

    const matchesCall = (event) => {
      return (
        event.call_cid === call.cid ||
        (
          event.call?.id === call.id &&
          event.call?.type === call.type
        )
      );
    };

    // Join caller after the receiver accepts
    const onAccepted = async (event) => {
      if (!matchesCall(event)) return;
      if (connectedRef.current) return;

      try {
        if (
          call.state.callingState !==
          CallingState.JOINED
        ) {
          await call.join({ create: false });
        }

        connectedRef.current = true;
        outgoingRef.current = null;

        setOutgoingCall(null);
        setActiveCall(outgoingCall);
      } catch (err) {
        console.error(
          'Caller joining failed:',
          err
        );

        outgoingRef.current = null;
        setOutgoingCall(null);

        setError(
          err.message ||
            'Unable to connect the video call'
        );
      }
    };

    const onRejected = (event) => {
      if (!matchesCall(event)) return;
      if (connectedRef.current) return;

      clearOutgoingState();

      setNotice(
        event.reason === 'timeout'
          ? 'No Answer'
          : 'Call Declined'
      );
    };

    const onMissed = (event) => {
      if (!matchesCall(event)) return;
      if (connectedRef.current) return;

      clearOutgoingState();
      setNotice('No Answer');
    };

    const unsubscribeAccepted = client.on(
      'call.accepted',
      onAccepted
    );

    const unsubscribeRejected = client.on(
      'call.rejected',
      onRejected
    );

    const unsubscribeMissed = client.on(
      'call.missed',
      onMissed
    );

    return () => {
      unsubscribeAccepted?.();
      unsubscribeRejected?.();
      unsubscribeMissed?.();
    };
  }, [client, outgoingCall]);

  // ======================================
  // OUTGOING CALL COUNTDOWN
  // ======================================

  useEffect(() => {
    if (!outgoingCall) return;

    const updateCountdown = () => {
      if (connectedRef.current) return;

      const elapsed = Math.floor(
        (Date.now() - outgoingCall.startedAt) / 1000
      );

      const remaining = Math.max(
        0,
        RING_TIMEOUT_SECONDS - elapsed
      );

      setSecondsLeft(remaining);

      if (remaining === 0) {
        void cancelOutgoing(
          'No Answer',
          'timeout'
        );
      }
    };

    updateCountdown();

    const interval = setInterval(
      updateCountdown,
      250
    );

    return () => clearInterval(interval);
  }, [outgoingCall]);

  // ======================================
  // LEAVE CONNECTED CALL
  // ======================================

  const handleLeaveCall = async () => {
    const current = activeCall;

    if (!current) return;

    setActiveCall(null);
    connectedRef.current = false;

    try {
      if (
        current.call.state.callingState !==
        CallingState.LEFT
      ) {
        await current.call.leave();
      }
    } catch (err) {
      console.error('Leave call failed:', err);

      setError(
        err.message || 'Unable to leave call'
      );
    }
  };

  // ======================================
  // SEARCH CONTACTS
  // ======================================

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      contact.relationship
        ?.toLowerCase()
        .includes(search.toLowerCase())
  );

  // ======================================
  // CONNECTED CALL ROOM
  // Keep existing RealCallRoom functionality
  // ======================================

  if (activeCall) {
    return (
      <RealCallRoom
        client={client}
        call={activeCall.call}
        contactName={activeCall.contactName}
        onLeave={handleLeaveCall}
      />
    );
  }

  // ======================================
  // OUTGOING RINGING SCREEN
  // ======================================

  if (outgoingCall) {
    return (
      <div className="min-h-screen bg-[#0B1423] text-white flex flex-col items-center justify-center px-5 py-12">

        <div className="w-full max-w-md text-center">

          <div className="flex items-center justify-center gap-2 mb-12">
            <ShieldCheck
              size={24}
              className="text-teal-400"
            />

            <span className="font-bold tracking-[0.16em] text-sm">
              SPHERIVA CONNECT
            </span>
          </div>

          {/* Avatar */}
          <div className="relative mx-auto w-32 h-32 mb-9">

            <div className="absolute inset-0 rounded-full bg-teal-400/10 animate-pulse" />

            <div className="absolute inset-3 rounded-full bg-[#153B43] border border-teal-400/20 flex items-center justify-center">
              {outgoingCall.type === 'voice' ? (
                <Phone
                  size={44}
                  className="text-teal-300"
                />
              ) : (
                <Video
                  size={44}
                  className="text-teal-300"
                />
              )}
            </div>
          </div>

          <p className="text-teal-300 text-xs font-bold tracking-[0.18em] uppercase">
            {outgoingCall.type === 'voice'
              ? 'Voice Call'
              : 'Video Call'}
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold mt-4 break-words">
            {outgoingCall.contactName}
          </h1>

          <p className="text-slate-300 mt-3">
            Calling... Waiting for an answer
          </p>

          {/* Countdown */}
          <div className="mt-9 rounded-2xl border border-white/10 bg-white/5 px-6 py-5">

            <div className="flex justify-center items-center gap-2 text-slate-400 text-sm">
              <Clock3 size={17} />
              Ringing countdown
            </div>

            <p className="text-4xl font-extrabold tabular-nums mt-3">
              {formatTime(secondsLeft)}
            </p>
          </div>

          {/* Cancel */}
          <button
            type="button"
            onClick={() => void cancelOutgoing()}
            className="mt-9 inline-flex justify-center items-center gap-3 bg-rose-600 hover:bg-rose-700 px-8 py-4 rounded-2xl font-bold transition"
          >
            <PhoneOff size={21} />
            Cancel Call
          </button>
        </div>
      </div>
    );
  }

  // ======================================
  // PROFESSIONAL REAL CALLING PAGE
  // ======================================

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24 text-slate-900">

      {/* Compact Header */}
      <header className="bg-[#0B1423] text-white">

        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-6 pb-10">

          <button
            type="button"
            onClick={() => navigate('/home')}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3 mt-7">

            <span className="w-12 h-12 shrink-0 rounded-2xl bg-teal-400/10 border border-teal-300/20 flex items-center justify-center">
              <Phone
                size={25}
                className="text-teal-300"
              />
            </span>

            <div>
              <p className="text-xs text-teal-300 font-bold uppercase tracking-[0.15em]">
                Spheriva Connect
              </p>

              <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
                Real Voice & Video Calls
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-300 mt-3 max-w-xl">
            Choose a trusted contact to start a voice or video call.
          </p>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-7">

        {/* Single wide contacts panel */}
        <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">

          {/* Panel Header */}
          <div className="px-5 sm:px-8 pt-7 pb-5">

            <div className="flex flex-wrap items-center justify-between gap-3">

              <div className="flex items-center gap-3">

                <span className="w-11 h-11 bg-teal-50 text-teal-700 rounded-xl flex items-center justify-center">
                  <Users size={22} />
                </span>

                <div>
                  <h2 className="font-bold text-lg">
                    Trusted Circle
                  </h2>

                  <p className="text-xs text-slate-500 mt-1">
                    Select a contact to connect
                  </p>
                </div>
              </div>

              <span className="text-sm font-semibold text-teal-700 bg-teal-50 rounded-full px-4 py-2">
                {contacts.length}{' '}
                {contacts.length === 1
                  ? 'Contact'
                  : 'Contacts'}
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative mt-6">

              <Search
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by name or relationship..."
                aria-label="Search trusted contacts"
                className="w-full h-12 rounded-xl bg-slate-50 border border-slate-200 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition"
              />
            </div>
          </div>

          {/* Message Area */}
          <div className="px-5 sm:px-8">

            {calling && (
              <div
                role="status"
                className="mb-4 p-4 rounded-xl border border-teal-100 bg-teal-50 text-teal-800 text-sm flex items-center gap-3"
              >
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
                Starting secure call...
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm"
              >
                {notice}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-2"
              >
                <AlertCircle
                  size={18}
                  className="shrink-0 mt-0.5"
                />

                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Contacts */}
          <div className="px-5 sm:px-8 pb-8">

            {loading ? (
              <div className="min-h-[220px] flex flex-col justify-center items-center gap-3">
                <LoaderCircle
                  size={28}
                  className="animate-spin text-teal-700"
                />

                <p className="text-sm text-slate-500">
                  Loading your contacts...
                </p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="min-h-[220px] rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-6">

                <Users
                  size={29}
                  className="text-teal-700"
                />

                <p className="font-semibold text-slate-800 mt-4">
                  {contacts.length
                    ? 'No matching contacts'
                    : 'No trusted contacts yet'}
                </p>

                {!contacts.length && (
                  <button
                    type="button"
                    onClick={() => navigate('/contacts')}
                    className="mt-4 inline-flex items-center gap-2 text-sm text-teal-700 hover:text-teal-900 font-bold"
                  >
                    Add Trusted Contacts
                    <ChevronRight size={17} />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">

                {filteredContacts.map((contact) => (
                  <div
                    key={contact._id}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-5 rounded-2xl bg-[#F8FAFB] border border-slate-200 p-4 sm:p-5 hover:border-teal-200 hover:bg-white hover:shadow-sm transition"
                  >

                    {/* Contact Avatar */}
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-xl font-extrabold">
                      {contact.name
                        ?.trim()
                        .charAt(0)
                        .toUpperCase() || '?'}
                    </div>

                    {/* Contact Info */}
                    <div className="min-w-0 flex-1">

                      <p className="text-base font-bold text-slate-900 truncate">
                        {contact.name}
                      </p>

                      <p className="text-sm text-slate-500 mt-1">
                        {contact.relationship ||
                          'Trusted Contact'}
                      </p>
                    </div>

                    {/* Working Call Buttons */}
                    <div className="w-full sm:w-auto flex items-center gap-3 justify-end">

                      {/* Voice Call */}
                      <button
                        type="button"
                        disabled={calling || !client}
                        onClick={() =>
                          requestCall(contact, 'Voice')
                        }
                        aria-label={`Voice call ${contact.name}`}
                        title={`Voice call ${contact.name}`}
                        className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition"
                      >
                        <Phone size={21} />
                      </button>

                      {/* Video Call */}
                      <button
                        type="button"
                        disabled={calling || !client}
                        onClick={() =>
                          requestCall(contact, 'Video')
                        }
                        aria-label={`Video call ${contact.name}`}
                        title={`Video call ${contact.name}`}
                        className="w-12 h-12 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition"
                      >
                        <Video size={22} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
