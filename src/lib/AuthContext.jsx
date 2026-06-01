import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    try {
      setAuthError(null);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
      setIsLoadingAuth(false);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      const status = error?.status ?? error?.response?.status;
      if (status !== 401 && status !== 403) {
        setAuthError({
          type: 'auth_required',
          message: error?.message || error?.response?.data?.message || 'Authentication required',
        });
      }
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = useCallback((shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout();
    if (shouldRedirect && typeof window !== 'undefined') window.location.href = '/login';
  }, []);

  const navigateToLogin = useCallback(() => {
    if (typeof window !== 'undefined') window.location.href = '/login';
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    authError,
    authChecked,
    logout,
    navigateToLogin,
    checkUserAuth,
  }), [user, isAuthenticated, isLoadingAuth, authError, authChecked, logout, navigateToLogin, checkUserAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
