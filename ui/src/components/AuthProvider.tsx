/**
 * Authentication context provider
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  initAuth,
  isAuthenticated,
  isAuthConfigured,
  getCurrentUser,
  login,
  logout,
  type User,
} from '@/services/auth';

interface AuthContextType {
  isConfigured: boolean;
  isLoggedIn: boolean;
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const isConfigured = isAuthConfigured();

  useEffect(() => {
    async function init() {
      if (isConfigured) {
        await initAuth();
        setIsLoggedIn(isAuthenticated());
        setUser(getCurrentUser());
      }
      setLoading(false);
    }
    init();
  }, [isConfigured]);

  const handleLogin = async () => {
    await login();
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setUser(null);
  };

  // Refresh auth state after callback
  const refreshAuthState = () => {
    setIsLoggedIn(isAuthenticated());
    setUser(getCurrentUser());
  };

  return (
    <AuthContext.Provider
      value={{
        isConfigured,
        isLoggedIn,
        user,
        loading,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      <AuthRefreshContext.Provider value={refreshAuthState}>
        {children}
      </AuthRefreshContext.Provider>
    </AuthContext.Provider>
  );
}

// Separate context for refresh function to avoid circular deps
const AuthRefreshContext = createContext<(() => void) | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthRefresh(): () => void {
  const refresh = useContext(AuthRefreshContext);
  if (!refresh) {
    throw new Error('useAuthRefresh must be used within an AuthProvider');
  }
  return refresh;
}
