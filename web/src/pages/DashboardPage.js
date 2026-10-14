import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const DashboardPage = () => {
  const { sessionToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        setLoading(true);
        // This endpoint will be implemented in Phase 5
        const response = await api.get(`/session/${sessionToken}/view`);
        // sessionData will be used in Phase 5
        console.log('Session data:', response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load session data');
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Emergency Session Dashboard
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-start">
            <div className="text-yellow-600 text-2xl mr-4">🚧</div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                Dashboard Under Development
              </h3>
              <p className="text-yellow-800">
                The dashboard functionality will be implemented in Phase 5 and Phase 6.
                This page will display:
              </p>
              <ul className="mt-3 space-y-1 text-yellow-800">
                <li>• Real-time location on interactive map</li>
                <li>• Emergency alert details and status</li>
                <li>• Timeline of location updates</li>
                <li>• Option to acknowledge and respond</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Session Token
          </h2>
          <p className="text-gray-600 font-mono bg-gray-100 p-3 rounded break-all">
            {sessionToken}
          </p>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
