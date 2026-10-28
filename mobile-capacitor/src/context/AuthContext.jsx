/**
 * Authentication Context
 * Manages authentication state across the application
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiService } from '../services/api.service';
import { storageService } from '../services/storage.service';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
        try {
          const response = await apiService.getMe();
          if (response.success) {
            setUser(response.data.user);
            setIsAuthenticated(true);
          } else {
            await logout();
          }
        } catch (error) {
          await logout();
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      setIsAuthenticated(false);
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
        
        setUser(response.data.user);
        setIsAuthenticated(true);
        
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
        
        setUser(response.data.user);
        setIsAuthenticated(true);
        
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
  const logout = async () => {
    try {
      await storageService.clearAll();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
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
