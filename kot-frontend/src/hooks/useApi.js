import { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const useApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Configuration axios par défaut
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Intercepteur pour ajouter le token d'authentification
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Intercepteur pour gérer les erreurs de réponse
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Token expiré, déconnexion
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  const executeRequest = useCallback(async (method, url, data = null, config = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.request({
        method,
        url,
        data,
        ...config,
      });

      return { success: true, data: response.data };
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Une erreur est survenue';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const get = useCallback((url, config = {}) => {
    return executeRequest('GET', url, null, config);
  }, [executeRequest]);

  const post = useCallback((url, data, config = {}) => {
    return executeRequest('POST', url, data, config);
  }, [executeRequest]);

  const put = useCallback((url, data, config = {}) => {
    return executeRequest('PUT', url, data, config);
  }, [executeRequest]);

  const patch = useCallback((url, data, config = {}) => {
    return executeRequest('PATCH', url, data, config);
  }, [executeRequest]);

  const del = useCallback((url, config = {}) => {
    return executeRequest('DELETE', url, null, config);
  }, [executeRequest]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    get,
    post,
    put,
    patch,
    delete: del,
    clearError,
    api,
  };
};
