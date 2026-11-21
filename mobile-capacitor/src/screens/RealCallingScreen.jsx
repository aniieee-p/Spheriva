
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';
import RealCallRoom from '../components/RealCallRoom';
import {
  createStreamCallingClient,
  disconnectStreamCallingClient,
} from '../services/streamCalling.service';

export default function RealCallingScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [calling, setCalling] = useState(false);
  const [activeCall, setActiveCall] = useState(null);

  const clientRef = useRef(null);
  const callRef = useRef(null);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const loadContacts = async () => {
      try {
        const response = await apiService.getEmergencyContacts();

        if (cancelled) return;

        if (!response.success) {
          throw new Error(
            response.message || 'Unable to load contacts'
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

    loadContacts();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const cleanupCall = async () => {
    const call = callRef.current;
    const client = clientRef.current;

    callRef.current = null;
    clientRef.current = null;

    if (mountedRef.current) {
      setActiveCall(null);
    }

    try {
      if (call) {
        await call.leave();
      }
    } catch (err) {
      console.error('Failed to leave call:', err);
    } finally {
      if (client) {
        try {
          await disconnectStreamCallingClient(client);
        } catch (err) {
          console.error(
            'Failed to disconnect Stream client:',
            err
          );
        }
      }
    }
  };

  const requestCall = async (contact, type) => {
    if (startingRef.current || callRef.current) return;

    startingRef.current = true;
    setCalling(true);
    setError('');
    setNotice('');

    try {
      if (!user) {
        throw new Error('Please log in to start calling.');
      }

      const selectedType =
        type === 'Voice' ? 'voice' : 'video';

      // Step 1: Create authorized call in backend
      const response = await apiService.createRealCall(
        contact._id,
        selectedType
      );

      if (!response?.success || !response?.data) {
        throw new Error(
          response?.message || 'Unable to create call'
        );
      }

      const {
        callId,
        callType,
      } = response.data;

      if (!callId || !callType) {
        throw new Error(
          'Backend returned incomplete call details'
        );
      }

      // Step 2: Connect authenticated user to Stream
      const client = await createStreamCallingClient(user);
      clientRef.current = client;

      // Step 3: Access backend-created call
      const call = client.call(callType, callId);
      callRef.current = call;

      // Step 4: Configure voice or video
      if (selectedType === 'voice') {
        await call.camera.disable();
      }

      // Step 5: Join existing call
      await call.join({ create: false });

      if (!mountedRef.current) {
        await cleanupCall();
        return;
      }

      // Step 6: Display calling room
      setActiveCall({
        client,
        call,
        contactName: contact.name,
        type: selectedType,
      });

    } catch (err) {
      console.error('Real calling failed:', err);

      await cleanupCall();

      if (mountedRef.current) {
        setError(
          err.message || 'Unable to start call'
        );
      }
    } finally {
      startingRef.current = false;

      if (mountedRef.current) {
        setCalling(false);
      }
    }
  };

  const handleLeaveCall = async () => {
    await cleanupCall();
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(search.toLowerCase()) ||
    contact.relationship
      ?.toLowerCase()
      .includes(search.toLowerCase())
  );

  // Show active calling screen
  if (activeCall) {
    return (
      <RealCallRoom
        client={activeCall.client}
        call={activeCall.call}
        contactName={activeCall.contactName}
        onLeave={handleLeaveCall}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">

      {/* Header */}
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

      {/* Trusted contacts */}
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
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts..."
            aria-label="Search trusted contacts"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 mb-5 outline-none focus:ring-2 focus:ring-purple-400"
          />

          {/* Connecting status */}
          {calling && (
            <div
              role="status"
              className="bg-purple-50 text-purple-800 rounded-xl p-3 mb-4 text-sm text-center"
            >
              Connecting secure call...
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
              <p className="text-gray-700 font-medium">
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

              {filteredContacts.map(contact => (

                <div
                  key={contact._id}
                  className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-3"
                >

                  {/* Contact avatar */}
                  <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                    {contact.name
                      ?.trim()
                      .charAt(0)
                      .toUpperCase() || '?'}
                  </div>

                  {/* Contact information */}
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

                  {/* Voice call */}
                  <button
                    type="button"
                    disabled={calling}
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
                      <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013 5.18 2 2 0 015 3h3a2 2 0 012 1.72c.12.96.35 1.9.69 2.79a2 2 0 01-.45 2.11L9 10.87a16 16 0 006.13 6.13l1.25-1.24a2 2 0 012.11-.45c.89.34 1.83.57 2.79.69A2 2 0 0122 16.92z"/>
                    </svg>
                  </button>

                  {/* Video call */}
                  <button
                    type="button"
                    disabled={calling}
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
                      <rect
                        x="3"
                        y="5"
                        width="13"
                        height="14"
                        rx="2"
                      />
                      <path d="m16 10 5-3v10l-5-3"/>
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
