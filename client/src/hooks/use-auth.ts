import { useState, useEffect } from 'react';
import { User } from '@shared/schema';
import { getStoredUser, setStoredUser, clearStoredUser } from '@/lib/auth-utils';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const user = getStoredUser();
    return {
      user,
      isAdmin: Boolean(user?.isAdmin),
      isAuthenticated: Boolean(user?.id),
      isLoading: false,
    };
  });

  useEffect(() => {
    const checkUser = () => {
      const user = getStoredUser();
      if (user?.id) {
        setAuthState({
          user,
          isAdmin: Boolean(user.isAdmin),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setAuthState({ user: null, isAdmin: false, isAuthenticated: false, isLoading: false });
      }
    };

    checkUser();
    window.addEventListener('storage', checkUser);
    return () => window.removeEventListener('storage', checkUser);
  }, []);

  // Update lastActive timestamp periodically
  useEffect(() => {
    if (!authState.user?.id) return;

    const updateLastActive = async () => {
      try {
        const res = await fetch(`/api/users/${authState.user?.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastActive: new Date() }),
        });
        if (res.ok) {
          const updated = await res.json();
          setStoredUser(updated);
          setAuthState(prev => ({
            ...prev,
            user: updated,
            isAdmin: Boolean(updated.isAdmin),
          }));
        }
      } catch (err) {
        console.error('Failed to update last active:', err);
      }
    };

    updateLastActive();
    const interval = setInterval(updateLastActive, 60 * 1000);
    return () => clearInterval(interval);
  }, [authState.user?.id]);

  const login = (userData: User) => {
    setStoredUser(userData);
    setAuthState({
      user: userData,
      isAdmin: Boolean(userData.isAdmin),
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearStoredUser();
    setAuthState({
      user: null,
      isAdmin: false,
      isAuthenticated: false,
      isLoading: false,
    });
    window.location.href = '/auth';
  };

  return {
    ...authState,
    login,
    logout,
  };
}
