/**
 * Authentication Context
 * Manages authentication state across the application
 */

import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { apiService } from '../services/api.service';
import { storageService } from '../services/storage.service';
import {
  cleanupSafetySessionForLogout,
  recoverSafetySession
} from '../services/trackingService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const userRef = useRef(user);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const logoutPromiseRef = useRef(null);
  const recoveryRetryPromiseRef = useRef(null);
  const lastRecoveryAttemptAtRef = useRef(0);
  const networkConnectedRef = useRef(null);
  userRef.current = user;
  isAuthenticatedRef.current = isAuthenticated;

  const setAuthenticationState = (authenticated) => {
    isAuthenticatedRef.current = authenticated;
    setIsAuthenticated(authenticated);
  };

  const recoverSafetySessionForUser = async (userId) => {
    lastRecoveryAttemptAtRef.current = Date.now();
    return await recoverSafetySession(userId);
  };

  const retrySafetySessionRecovery = async () => {
    const ownerId = userRef.current?.id || userRef.current?._id;
    if (
      !ownerId ||
      !isAuthenticatedRef.current ||
      logoutPromiseRef.current
    ) {
      return;
    }

    if (recoveryRetryPromiseRef.current) {
      return await recoveryRetryPromiseRef.current;
    }

    if (Date.now() - lastRecoveryAttemptAtRef.current < 10000) return;

    const retryPromise = (async () => {
      try {
        const [token, storedUser] = await Promise.all([
          storageService.getToken(),
          storageService.getUser()
        ]);
        const currentOwnerId = userRef.current?.id || userRef.current?._id;
        const storedOwnerId = storedUser?.id || storedUser?._id;
        if (
          !token ||
          !isAuthenticatedRef.current ||
          logoutPromiseRef.current ||
          String(currentOwnerId || '') !== String(ownerId) ||
          String(storedOwnerId || '') !== String(ownerId) ||
          Date.now() - lastRecoveryAttemptAtRef.current < 10000
        ) {
          return;
        }

        const recovery = await recoverSafetySessionForUser(ownerId);
        if (!recovery.success) {
          console.warn('Safety session retry requires recovery:', recovery);
        }
      } catch (error) {
        console.warn('Safety session retry failed:', error);
      }
    })();

    recoveryRetryPromiseRef.current = retryPromise;
    try {
      return await retryPromise;
    } finally {
      if (recoveryRetryPromiseRef.current === retryPromise) {
        recoveryRetryPromiseRef.current = null;
      }
    }
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      void logout({ unauthorized: true });
    };

    window.addEventListener('spheriva:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('spheriva:unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let networkListener;
    let appStateListener;

    const registerListeners = async () => {
      try {
        const listener = await Network.addListener(
          'networkStatusChange',
          (status) => {
            const wasConnected = networkConnectedRef.current;
            networkConnectedRef.current = status.connected;
            if (status.connected && wasConnected !== true) {
              void retrySafetySessionRecovery();
            }
          }
        );
        if (disposed) {
          await listener.remove();
          return;
        }
        networkListener = listener;
      } catch (error) {
        console.error('Failed to register network recovery listener:', error);
      }

      if (disposed) return;

      try {
        const listener = await App.addListener('appStateChange', (state) => {
          if (state.isActive) {
            void retrySafetySessionRecovery();
          }
        });
        if (disposed) {
          await listener.remove();
          return;
        }
        appStateListener = listener;
      } catch (error) {
        console.error('Failed to register foreground recovery listener:', error);
      }
    };

    void registerListeners();
    return () => {
      disposed = true;
      if (networkListener) {
        void networkListener.remove().catch((error) => {
          console.error('Failed to remove network recovery listener:', error);
        });
      }
      if (appStateListener) {
        void appStateListener.remove().catch((error) => {
          console.error('Failed to remove foreground recovery listener:', error);
        });
      }
    };
  }, []);

  // Initialize auth state on app load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  /**
   * Check if user is authenticated
   */
  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      
      const token = await storageService.getToken();
      const storedUser = await storageService.getUser();

      if (token && storedUser) {
        const restoreStoredAuthentication = () => {
          userRef.current = storedUser;
          setUser(storedUser);
          setAuthenticationState(true);
          void retrySafetySessionRecovery();
        };

        userRef.current = storedUser;
        try {
          const response = await apiService.getMe();
          if (response.success) {
            const authenticatedUser = response.data.user;
            userRef.current = authenticatedUser;
            const recovery = await recoverSafetySessionForUser(
              authenticatedUser?.id || authenticatedUser?._id
            );
            if (!recovery.success) {
              console.warn('Safety session requires recovery:', recovery);
            }
            if (!(await storageService.getToken())) {
              setUser(null);
              userRef.current = null;
              setAuthenticationState(false);
              return;
            }
            setUser(authenticatedUser);
            setAuthenticationState(true);
          } else {
            console.warn('Authentication restoration returned an unsuccessful response');
            restoreStoredAuthentication();
          }
        } catch (error) {
          if (error.status === 401) {
            await logout();
            return;
          }

          console.warn(
            'Could not verify stored authentication; preserving the local session:',
            error
          );
          restoreStoredAuthentication();
        }
      } else {
        setUser(null);
        userRef.current = null;
        setAuthenticationState(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      userRef.current = null;
      setAuthenticationState(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Register a new user
   */
  const register = async (userData) => {
    try {
      const response = await apiService.register(userData);
      
      if (response.success) {
        await storageService.saveToken(response.data.token);
        await storageService.saveUser(response.data.user);
        userRef.current = response.data.user;
        const recovery = await recoverSafetySessionForUser(
          response.data.user?.id || response.data.user?._id
        );
        if (!recovery.success) {
          console.warn('Safety session requires recovery:', recovery);
        }
        if (!(await storageService.getToken())) {
          return {
            success: false,
            message: 'Authentication expired while recovering the safety session'
          };
        }
        
        setUser(response.data.user);
        setAuthenticationState(true);
        
        return { success: true, message: response.message };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Registration failed',
      };
    }
  };

  /**
   * Login user
   */
  const login = async ({ emailOrPhone, password, rememberMe }) => {
    try {
      const response = await apiService.login({ emailOrPhone, password });
      
      if (response.success) {
        await storageService.saveToken(response.data.token);
        await storageService.saveUser(response.data.user);
        await storageService.saveRememberMe(rememberMe);

        userRef.current = response.data.user;
        const recovery = await recoverSafetySessionForUser(
          response.data.user?.id || response.data.user?._id
        );
        if (!recovery.success) {
          console.warn('Safety session requires recovery:', recovery);
        }
        if (!(await storageService.getToken())) {
          return {
            success: false,
            message: 'Authentication expired while recovering the safety session'
          };
        }
        
        setUser(response.data.user);
        setAuthenticationState(true);
        
        return { success: true, message: response.message };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Login failed',
      };
    }
  };

  /**
   * Logout user
   */
  const logout = async ({ unauthorized = false } = {}) => {
    if (logoutPromiseRef.current) return await logoutPromiseRef.current;

    const logoutPromise = (async () => {
      try {
        if (recoveryRetryPromiseRef.current) {
          await recoveryRetryPromiseRef.current;
        }
        const currentUserId = userRef.current?.id || userRef.current?._id;
        const cleanup = await cleanupSafetySessionForLogout(currentUserId, {
          unauthorized
        });

        if (!cleanup.canLogout) {
          return {
            success: false,
            message: 'Tracking cleanup failed. Please retry before logging out.',
            pendingCleanup: cleanup.pendingCleanup,
            reason: cleanup.reason
          };
        }

        await storageService.clearAuth();
        setUser(null);
        userRef.current = null;
        setAuthenticationState(false);
        return {
          success: true,
          pendingCleanup: cleanup.pendingCleanup
        };
      } catch (error) {
        console.error('Logout cleanup error:', error);
        return {
          success: false,
          message: error.message || 'Could not complete logout cleanup'
        };
      }
    })();

    logoutPromiseRef.current = logoutPromise;
    try {
      return await logoutPromise;
    } finally {
      if (logoutPromiseRef.current === logoutPromise) {
        logoutPromiseRef.current = null;
      }
    }
  };

  /**
   * Update user profile
   */
  const updateUser = async (userData) => {
    try {
      const response = await apiService.updateProfile(userData);
      
      if (response.success) {
        await storageService.saveUser(response.data.user);
        setUser(response.data.user);
        
        return { success: true, message: response.message };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Update failed',
      };
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    register,
    login,
    logout,
    updateUser,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;