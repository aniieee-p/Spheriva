// import React, { useState, useEffect } from 'react';
// import { useParams } from 'react-router-dom';
// import api from '../services/api';

// const DashboardPage = () => {
//   const { sessionToken } = useParams();
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     const fetchSessionData = async () => {
//       try {
//         setLoading(true);
//         // This endpoint will be implemented in Phase 5
//         const response = await api.get(`/session/${sessionToken}/view`);
//         // sessionData will be used in Phase 5
//         console.log('Session data:', response.data);
//         setError(null);
//       } catch (err) {
//         setError(err.response?.data?.message || 'Failed to load session data');
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchSessionData();
//   }, [sessionToken]);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
//           <p className="text-gray-600">Loading session data...</p>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
//         <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
//           <div className="text-red-500 text-5xl mb-4">⚠️</div>
//           <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Error</h2>
//           <p className="text-gray-600 mb-6">{error}</p>
//           <a
//             href="/"
//             className="inline-block bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition"
//           >
//             Go to Home
//           </a>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       <header className="bg-white shadow">
//         <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
//           <h1 className="text-3xl font-bold text-gray-900">
//             Emergency Session Dashboard
//           </h1>
//         </div>
//       </header>

//       <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
//         <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
//           <div className="flex items-start">
//             <div className="text-yellow-600 text-2xl mr-4">🚧</div>
//             <div>
//               <h3 className="text-lg font-semibold text-yellow-900 mb-2">
//                 Dashboard Under Development
//               </h3>
//               <p className="text-yellow-800">
//                 The dashboard functionality will be implemented in Phase 5 and Phase 6.
//                 This page will display:
//               </p>
//               <ul className="mt-3 space-y-1 text-yellow-800">
//                 <li>• Real-time location on interactive map</li>
//                 <li>• Emergency alert details and status</li>
//                 <li>• Timeline of location updates</li>
//                 <li>• Option to acknowledge and respond</li>
//               </ul>
//             </div>
//           </div>
//         </div>

//         <div className="bg-white shadow rounded-lg p-6">
//           <h2 className="text-xl font-semibold text-gray-900 mb-4">
//             Session Token
//           </h2>
//           <p className="text-gray-600 font-mono bg-gray-100 p-3 rounded break-all">
//             {sessionToken}
//           </p>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default DashboardPage;








import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';

const DashboardPage = () => {
  const { sessionToken } = useParams();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [acknowledging, setAcknowledging] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const fetchSessionData = useCallback(async (initial = false) => {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await api.get(
        `/session/${encodeURIComponent(sessionToken)}/view`
      );

      setSession(response.data);
      setError('');
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Unable to load session data. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchSessionData(true);

    // Refresh session data every 15 seconds.
    const intervalId = setInterval(() => {
      fetchSessionData(false);
    }, 15000);

    return () => clearInterval(intervalId);
  }, [fetchSessionData]);

  const acknowledgeAlert = async () => {
    try {
      setAcknowledging(true);
      setActionMessage('');

      // The backend must implement this endpoint.
      await api.post(
        `/session/${encodeURIComponent(sessionToken)}/acknowledge`
      );

      setActionMessage('Alert acknowledged successfully.');
      await fetchSessionData(false);
    } catch (err) {
      setActionMessage(
        err.response?.data?.message ||
          'Unable to acknowledge the alert. Please try again.'
      );
    } finally {
      setAcknowledging(false);
    }
  };

  const location = session?.location;
  const latitude = location?.latitude;
  const longitude = location?.longitude;

  const hasLocation =
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    latitude !== null &&
    latitude !== '' &&
    longitude !== null &&
    longitude !== '';

  const timeline = Array.isArray(session?.timeline)
    ? session.timeline
    : [];

  const alerts = Array.isArray(session?.alerts)
    ? session.alerts
    : session?.alert
      ? [session.alert]
      : [];

  const isAcknowledged =
    session?.acknowledged === true ||
    alerts.some(
      (alert) =>
        alert.status?.toLowerCase() === 'acknowledged'
    );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading emergency session...</p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Unable to Open Dashboard
          </h2>
          <p className="text-slate-600 mb-6">{error}</p>

          <button
            onClick={() => fetchSessionData(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg"
          >
            Try Again
          </button>

          <div className="mt-4">
            <Link to="/" className="text-indigo-600 hover:underline">
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-2xl font-bold text-indigo-700">
              Spheriva
            </Link>
            <p className="text-sm text-slate-500 mt-1">
              Trusted Circle Dashboard
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {refreshing ? 'Updating...' : 'Session dashboard'}
            </span>
            <button
              onClick={() => fetchSessionData(false)}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-5 p-4 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
            Latest refresh failed: {error}. Showing previously loaded data.
          </div>
        )}

        <div className="mb-8">
          <p className="text-sm font-medium text-indigo-600 mb-2">
            EMERGENCY MONITORING
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            Emergency Session Dashboard
          </h1>
          <p className="text-slate-500 mt-2">
            Monitor emergency alerts, location updates and responses.
          </p>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">Session Status</p>
            <p className="text-xl font-bold mt-3 capitalize text-slate-900">
              {session?.status || session?.session?.status || 'Unknown'}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">Emergency Alerts</p>
            <p className="text-3xl font-bold mt-2 text-slate-900">
              {alerts.length}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">Location Status</p>
            <p className="text-xl font-bold mt-3 text-slate-900">
              {hasLocation ? 'Available' : 'Unavailable'}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">Alert Response</p>
            <p className="text-xl font-bold mt-3 text-slate-900">
              {isAcknowledged ? 'Acknowledged' : 'Pending'}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                Latest Location
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Most recent location received from the session API
              </p>
            </div>

            {hasLocation ? (
              <div className="p-5">
                <div className="rounded-xl bg-indigo-50 p-5 mb-4">
                  <p className="text-sm text-slate-600">Coordinates</p>
                  <p className="font-mono text-sm sm:text-base text-slate-900 mt-2 break-all">
                    {latitude}, {longitude}
                  </p>
                  {location?.address && (
                    <p className="text-slate-700 mt-3">
                      {location.address}
                    </p>
                  )}
                </div>

                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(
                    `${latitude},${longitude}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-5 py-3"
                >
                  View Location on Map ↗
                </a>

                <p className="text-xs text-slate-500 mt-4">
                  Last updated:{' '}
                  {location?.updatedAt
                    ? new Date(location.updatedAt).toLocaleString()
                    : 'Not provided by server'}
                </p>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">📍</div>
                <h3 className="font-semibold text-slate-800">
                  No Location Available
                </h3>
                <p className="text-slate-500 text-sm mt-2">
                  The session has not provided valid location coordinates yet.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Emergency Response
            </h2>

            <div className="bg-slate-50 rounded-lg p-4 mb-5">
              <p className="text-sm text-slate-500">Response Status</p>
              <p className="font-semibold mt-2 text-slate-900">
                {isAcknowledged
                  ? 'This alert has been acknowledged.'
                  : 'Waiting for trusted contact acknowledgement.'}
              </p>
            </div>

            <button
              onClick={acknowledgeAlert}
              disabled={acknowledging || isAcknowledged}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {acknowledging
                ? 'Submitting...'
                : isAcknowledged
                  ? 'Alert Acknowledged'
                  : 'Acknowledge Alert'}
            </button>

            {actionMessage && (
              <p
                role="status"
                className="text-sm text-slate-600 mt-3"
              >
                {actionMessage}
              </p>
            )}

            <p className="text-xs text-slate-500 mt-4">
              Acknowledgement records a response; it does not automatically
              contact emergency services.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-xl font-bold text-slate-900 mb-5">
              Emergency Alerts
            </h2>

            {alerts.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No alert records are available for this session.
              </p>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert, index) => (
                  <div
                    key={alert.id || alert._id || index}
                    className="border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="font-semibold text-slate-900">
                        {alert.title || alert.type || 'Emergency Alert'}
                      </h3>
                      <span className="text-xs rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 capitalize">
                        {alert.status || 'Unknown'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mt-2">
                      {alert.message || alert.description || 'No details provided.'}
                    </p>

                    {alert.createdAt && (
                      <p className="text-xs text-slate-500 mt-3">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-xl font-bold text-slate-900 mb-5">
              Session Timeline
            </h2>

            {timeline.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No timeline events are available yet.
              </p>
            ) : (
              <div className="space-y-5">
                {timeline.map((event, index) => (
                  <div
                    key={event.id || event._id || index}
                    className="flex gap-3"
                  >
                    <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-indigo-500" />
                    <div>
                      <p className="font-medium text-slate-900">
                        {event.title || event.type || 'Session Update'}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        {event.message || event.description || 'Event recorded.'}
                      </p>
                      {event.createdAt && (
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(event.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="text-center text-sm text-slate-500 mt-8">
          Spheriva — Your Personal Safety Companion
        </footer>
      </main>
    </div>
  );
};

export default DashboardPage;
