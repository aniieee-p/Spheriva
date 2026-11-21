
import React, { useEffect, useState } from 'react';
import {
  StreamVideo,
  useCalls,
  CallingState,
} from '@stream-io/video-react-sdk';
import { useAuth } from '../context/AuthContext';
import {
  createStreamCallingClient,
  disconnectStreamCallingClient,
} from '../services/streamCalling.service';
import RealCallRoom from './RealCallRoom';

function IncomingCallListener({ client, children }) {
  const calls = useCalls();
  const [activeCall, setActiveCall] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const incomingCall = calls.find(
    (call) =>
      !call.isCreatedByMe &&
      call.state.callingState === CallingState.RINGING
  );

  const acceptCall = async () => {
    if (!incomingCall || busy) return;

    setBusy(true);
    setError('');

    try {
      await incomingCall.join();
      setActiveCall(incomingCall);
    } catch (err) {
      console.error('Accept call failed:', err);
      setError(err.message || 'Unable to accept call');
    } finally {
      setBusy(false);
    }
  };

  const rejectCall = async () => {
    if (!incomingCall || busy) return;

    setBusy(true);
    setError('');

    try {
      await incomingCall.leave({
        reject: true,
        reason: 'decline',
      });
    } catch (err) {
      console.error('Reject call failed:', err);
      setError(err.message || 'Unable to reject call');
    } finally {
      setBusy(false);
    }
  };

  const leaveCall = async () => {
    if (!activeCall) return;

    const call = activeCall;
    setActiveCall(null);

    try {
      await call.leave();
    } catch (err) {
      console.error('Leave call failed:', err);
    }
  };

  return (
    <>
      {children}

      {activeCall ? (
        <div className="fixed inset-0 z-[100] bg-slate-950 overflow-auto">
          <RealCallRoom
            client={client}
            call={activeCall}
            contactName="Incoming Spheriva Call"
            onLeave={leaveCall}
          />
        </div>
      ) : incomingCall ? (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="text-6xl mb-5">📞</div>

            <p className="text-purple-700 text-sm font-semibold">
              SPHERIVA CONNECT
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mt-3">
              Incoming Call
            </h2>

            <p className="text-gray-600 mt-3">
              Someone from your Spheriva circle is calling.
            </p>

            {error && (
              <p role="alert" className="text-red-600 mt-4 text-sm">
                {error}
              </p>
            )}

            <div className="flex justify-center gap-5 mt-8">
              <button
                type="button"
                disabled={busy}
                onClick={rejectCall}
                className="rounded-xl bg-red-600 text-white px-6 py-3 font-semibold disabled:opacity-50"
              >
                Decline
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={acceptCall}
                className="rounded-xl bg-green-600 text-white px-6 py-3 font-semibold disabled:opacity-50"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function IncomingRealCallManager({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [client, setClient] = useState(null);

  const userId = user?.id || user?._id;

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setClient(null);
      return;
    }

    let disposed = false;
    let connectedClient = null;

    const connect = async () => {
      try {
        const newClient = await createStreamCallingClient(user);
        connectedClient = newClient;

        if (disposed) {
          await disconnectStreamCallingClient(newClient);
          return;
        }

        setClient(newClient);
      } catch (err) {
        console.error('Incoming calling connection failed:', err);
      }
    };

    void connect();

    return () => {
      disposed = true;
      setClient(null);

      if (connectedClient) {
        void disconnectStreamCallingClient(connectedClient);
      }
    };
  }, [isAuthenticated, userId]);

  if (!client) return <>{children}</>;

  return (
    <StreamVideo client={client}>
      <IncomingCallListener client={client}>
        {children}
      </IncomingCallListener>
    </StreamVideo>
  );
}
