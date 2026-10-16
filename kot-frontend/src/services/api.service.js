import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
    const url = String(config.url || '');
    const method = String(config.method || 'get').toLowerCase();
    const actionNeedsCode = method === 'put' && /^\/?cashier\/orders\/[^/]+\/refund(?:\?|$)/.test(url);
    if (actionNeedsCode && typeof window !== 'undefined') {
      let data = config.data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = {}; } }
      if (!data?.staff_action_code) {
        const code = window.prompt('Saisissez votre code personnel pour confirmer cette action sensible.');
        if (!code) return Promise.reject(new axios.Cancel('Confirmation annulée.'));
        config.data = { ...(data || {}), staff_action_code: code };
      }
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
      // Token expiré, supprimer le token mais ne pas rediriger automatiquement
      localStorage.removeItem('auth_token');
      // Les composants individuels géreront la redirection si nécessaire
    }
    return Promise.reject(error);
  }
);

export default api;
