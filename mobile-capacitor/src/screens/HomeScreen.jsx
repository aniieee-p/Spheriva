/**
 * Home Screen
 * Main dashboard after login - shows safety session controls
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Spheriva</h1>
            <p className="text-sm opacity-90">Your Safety Companion</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* User Info Card */}
      <div className="p-4">
        <div className="bg-white rounded-xl shadow-md p-6 mb-4">
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Welcome, {user?.name || 'User'}!
          </h2>
          <p className="text-gray-600 text-sm">{user?.email}</p>
          <p className="text-gray-600 text-sm">{user?.phoneNumber}</p>
        </div>

        {/* Safety Session Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Safety Session</h3>
          
          <div className="space-y-3">
            {/* Start Session Button */}
            <button 
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-semibold transition shadow-lg flex items-center justify-center"
              onClick={() => alert('Start Session feature coming soon!')}
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Safety Session
            </button>

            {/* Emergency SOS Button */}
            <button 
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-semibold transition shadow-lg flex items-center justify-center"
              onClick={() => alert('Emergency SOS feature coming soon!')}
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Emergency SOS
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Session History */}
            <button 
              className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg transition text-center"
              onClick={() => alert('Session History coming soon!')}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">History</p>
            </button>

            {/* Trusted Contacts */}
            <button 
              className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg transition text-center"
              onClick={() => navigate('/contacts')}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">Contacts</p>
            </button>

            {/* Settings */}
            <button 
              className="bg-gray-50 hover:bg-gray-100 p-4 rounded-lg transition text-center"
              onClick={() => alert('Settings coming soon!')}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">Settings</p>
            </button>

            {/* Profile */}
            <button 
              className="bg-green-50 hover:bg-green-100 p-4 rounded-lg transition text-center"
              onClick={() => alert('Profile coming soon!')}
            >
              <svg className="w-8 h-8 mx-auto mb-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-sm font-medium text-gray-700">Profile</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
