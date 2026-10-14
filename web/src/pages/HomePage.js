import React from 'react';

const HomePage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="bg-white rounded-2xl shadow-2xl p-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Spheriva
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Trusted Circle Dashboard
          </p>
          
          <div className="bg-primary-50 rounded-lg p-6 mb-8">
            <p className="text-lg text-gray-700 mb-4">
              This dashboard allows authorized contacts to view emergency alerts and location information during active safety sessions.
            </p>
            <p className="text-gray-600">
              Access is provided through secure session tokens sent by the user during emergencies.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Phase 1 Complete! 🎉
            </h2>
            <p className="text-gray-600 mb-4">
              The web dashboard foundation is ready. Upcoming features:
            </p>
            <ul className="text-left space-y-2 text-gray-700 mx-auto max-w-md">
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">•</span>
                View emergency SOS alerts
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">•</span>
                Real-time location tracking on map
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">•</span>
                Acknowledge and respond to alerts
              </li>
              <li className="flex items-start">
                <span className="text-primary-500 mr-2">•</span>
                Session history and timeline
              </li>
            </ul>
          </div>

          <div className="mt-8 text-sm text-gray-500">
            <p>Spheriva - Your Personal Safety Companion</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
