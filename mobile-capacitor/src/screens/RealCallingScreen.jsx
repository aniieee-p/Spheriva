
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CallingState } from '@stream-io/video-react-sdk';

import { apiService } from '../services/api.service';
import { useRealCalling } from '../components/IncomingRealCallManager';
import RealCallRoom from '../components/RealCallRoom';

const RING_TIMEOUT_SECONDS = 45;

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remaining
  ).padStart(2, '0')}`;
};

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

  // Load trusted contacts
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
        if (!cancelled) setLoading(false);
      }
    };

    void loadContacts();

    return () => {
      cancelled = true;
    };
  }, []);

  const clearOutgoingState = () => {
    outgoingRef.current = null;
    setOutgoingCall(null);
    setCalling(false);
    startingRef.current = false;
  };

  // Cancel an unanswered outgoing call
  const cancelOutgoing = async (
    message = 'Call cancelled',
    reason = 'cancel'
  ) => {
    const current = outgoingRef.current;

    if (!current || connectedRef.current) return;

    clearOutgoingState();
    setNotice(message);

    try {
      await current.call.leave({
        reject: true,
        reason,
      });
    } catch (err) {
      console.error('Could not cancel outgoing call:', err);
      setError(
        err.message || 'Could not complete call cancellation'
      );
    }
  };

  // Start a real voice or video call
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

      // Backend creates the Stream ringing call
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

      // Reuse the shared authenticated Stream client
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

      // Fetch existing call without joining before acceptance
      await call.get();

    } catch (err) {
      console.error('Outgoing calling failed:', err);

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

  // Listen for Stream call events
  useEffect(() => {
    if (!client || !outgoingCall) return;

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

    // FIX: Join caller before showing the connected call room
    const onAccepted = async (event) => {
      if (!matchesCall(event)) return;
      if (connectedRef.current) return;

      try {
        // If Stream has not joined automatically, join now
        if (call.state.callingState !== CallingState.JOINED) {
          await call.join({ create: false });
        }

        connectedRef.current = true;
        outgoingRef.current = null;

        setOutgoingCall(null);
        setActiveCall(outgoingCall);
      } catch (err) {
        console.error('Caller joining failed:', err);

        outgoingRef.current = null;
        setOutgoingCall(null);

        setError(
          err.message || 'Unable to connect the video call'
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

  // 45-second outgoing call countdown
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
        void cancelOutgoing('No Answer', 'timeout');
      }
    };

    updateCountdown();

    const interval = setInterval(updateCountdown, 250);

    return () => clearInterval(interval);
  }, [outgoingCall]);

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
      setError(err.message || 'Unable to leave call');
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      contact.relationship
        ?.toLowerCase()
        .includes(search.toLowerCase())
  );

  // Connected call room
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

  // Outgoing ringing screen
  if (outgoingCall) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-950 via-purple-950 to-slate-950 text-white flex flex-col items-center justify-center px-6">
        <p className="text-purple-300 text-sm tracking-widest mb-10">
          SPHERIVA CONNECT
        </p>

        <div className="w-28 h-28 rounded-full bg-purple-500/20 flex items-center justify-center text-6xl mb-8">
          {outgoingCall.type === 'voice' ? '📞' : '📹'}
        </div>

        <h1 className="text-3xl font-bold text-center">
          Calling {outgoingCall.contactName}...
        </h1>

        <p className="text-purple-200 mt-4">
          Waiting for an answer
        </p>

        <div className="mt-10 text-center">
          <p className="text-sm text-purple-300 mb-2">
            Ringing countdown
          </p>

          <p className="text-5xl font-bold tabular-nums">
            {formatTime(secondsLeft)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void cancelOutgoing()}
          className="mt-14 bg-red-600 hover:bg-red-700 px-10 py-4 rounded-full font-bold text-lg"
        >
          Cancel Call
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950 text-white px-5 pt-8 pb-12 rounded-b-3xl">
        <button
          onClick={() => navigate('/home')}
          className="text-purple-200 text-sm mb-8"
        >
          ← Back to Home
        </button>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-200 text-sm mb-2">
              SPHERIVA CONNECT
            </p>

            <h1 className="text-3xl font-bold">
              Stay Connected
            </h1>

            <p className="text-purple-200 text-sm mt-2">
              Your trusted circle, one tap away.
            </p>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
            ♡
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-6 relative">
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-gray-900">
              Trusted Circle
            </h2>

            <span className="text-sm text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
              {contacts.length} contacts
            </span>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            aria-label="Search trusted contacts"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 mb-5 outline-none focus:ring-2 focus:ring-purple-400"
          />

          {calling && (
            <div
              role="status"
              className="bg-purple-50 text-purple-800 rounded-xl p-3 mb-4 text-sm"
            >
              Starting secure call...
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="bg-amber-50 text-amber-900 rounded-xl p-3 mb-4 text-sm"
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="bg-red-50 text-red-700 rounded-xl p-3 mb-4 text-sm"
            >
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-gray-500 text-center py-8">
              Loading your contacts...
            </p>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-10">
              <p className="font-medium text-gray-700">
                {contacts.length
                  ? 'No matching contacts'
                  : 'No trusted contacts yet'}
              </p>

              {!contacts.length && (
                <button
                  onClick={() => navigate('/contacts')}
                  className="text-purple-700 font-medium mt-3"
                >
                  Add Trusted Contacts
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContacts.map((contact) => (
                <div
                  key={contact._id}
                  className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {contact.name
                      ?.trim()
                      .charAt(0)
                      .toUpperCase() || '?'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">
                      {contact.name}
                    </p>

                    <p className="text-xs text-gray-500">
                      {contact.relationship || 'Trusted Contact'}
                    </p>

                    <p className="text-xs text-purple-700 mt-1">
                      Tap voice or video to call
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={calling || !client}
                    onClick={() => requestCall(contact, 'Voice')}
                    className="w-10 h-10 shrink-0 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center disabled:opacity-50"
                    aria-label={`Voice call ${contact.name}`}
                  >
                    <svg
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013 5.18 2 2 0 015 3h3a2 2 0 012 1.72c.12.96.35 1.9.69 2.79a2 2 0 01-.45 2.11L9 10.87a16 16 0 006.13 6.13l1.25-1.24a2 2 0 012.11-.45c.89.34 1.83.57 2.79.69A2 2 0 0122 16.92z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    disabled={calling || !client}
                    onClick={() => requestCall(contact, 'Video')}
                    className="w-10 h-10 shrink-0 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center disabled:opacity-50"
                    aria-label={`Video call ${contact.name}`}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="5" width="13" height="14" rx="2" />
                      <path d="m16 10 5-3v10l-5-3" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
