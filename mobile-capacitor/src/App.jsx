
import React from 'react';

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';

import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import IncomingRealCallManager from './components/IncomingRealCallManager';

// Authentication screens
import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

// Dashboard screens
import DashboardPreview from './screens/DashboardPreview';
import HomeScreen from './screens/HomeScreen';

// Other screens
import ProfileScreen from './screens/ProfileScreen';
import SessionHistoryScreen from './screens/SessionHistoryScreen';
import TrustedContactsScreen from './screens/TrustedContactsScreen';

// Real calling
import RealCallingScreen from './screens/RealCallingScreen';

// Fake calling
import ActiveFakeCallScreen from './screens/ActiveFakeCallScreen';
import IncomingFakeCallScreen from './screens/IncomingFakeCallScreen';
import FakeCallScreen from './screens/FakeCallScreen';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Public routes */}

          <Route
            path="/"
            element={<WelcomeScreen />}
          />

          <Route
            path="/login"
            element={<LoginScreen />}
          />

          <Route
            path="/register"
            element={<RegisterScreen />}
          />

          {/* Protected application */}

          <Route
            element={
              <ProtectedRoute>
                <IncomingRealCallManager>
                  <AppLayout />
                </IncomingRealCallManager>
              </ProtectedRoute>
            }
          >

            {/* New professional dashboard */}

            <Route
              path="/home"
              element={<DashboardPreview />}
            />

            {/* Dedicated dashboard preview */}

            <Route
              path="/dashboard-preview"
              element={<DashboardPreview />}
            />

            {/* Old dashboard kept for reference */}

            <Route
              path="/home-old"
              element={<HomeScreen />}
            />

            {/* History */}

            <Route
              path="/history"
              element={<SessionHistoryScreen />}
            />

            {/* Profile */}

            <Route
              path="/profile"
              element={<ProfileScreen />}
            />

            {/* Trusted Contacts */}

            <Route
              path="/contacts"
              element={<TrustedContactsScreen />}
            />

            {/* Real voice and video calling */}

            <Route
              path="/real-calling"
              element={<RealCallingScreen />}
            />

            {/* Fake calling */}

            <Route
              path="/fake-call"
              element={<FakeCallScreen />}
            />

            <Route
              path="/fake-call/incoming"
              element={<IncomingFakeCallScreen />}
            />

            <Route
              path="/fake-call/active"
              element={<ActiveFakeCallScreen />}
            />

          </Route>

          {/* Unknown routes */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
