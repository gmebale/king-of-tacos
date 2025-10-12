import { useState, useEffect, useCallback } from 'react';
import { User } from '../Entities/User';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await User.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Vérifier l'authentification au montage
  useEffect(() => {
    checkAuth();
  }, []);

  // Écouter les changements d'authentification
  useEffect(() => {
    const handleAuthChange = () => {
      checkAuth();
    };

    window.addEventListener('auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, [checkAuth]);

  const login = useCallback(async (credentials) => {
    try {
      setIsLoading(true);
      const loggedUser = await User.login(credentials);
      setUser(loggedUser);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await User.logout();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      setIsLoading(true);
      const newUser = await User.register(userData);
      setUser(newUser);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (profileData) => {
    try {
      setIsLoading(true);
      const updatedUser = await User.updateProfile(profileData);
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
    updateProfile,
    checkAuth
  };
};
