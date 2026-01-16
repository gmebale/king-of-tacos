import api from './api.service';

class AuthService {

  async googleLogin(token) {
    try {
      if (token) {
        localStorage.setItem('auth_token', token);
        // Dispatch event pour notifier changement état auth
        window.dispatchEvent(new CustomEvent('auth-change'));
        // Récupérer infos utilisateur après stockage token
        const user = await this.me();
        return user;
      }
      throw new Error('No token provided');
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur connexion Google');
    }
  }
  async appleLogin(identityToken, authorizationCode) {
    try {
      const response = await api.post('/auth/apple', {
        identityToken,
        authorizationCode
      });
      const { token, user } = response.data;

      if (token) {
        localStorage.setItem('auth_token', token);
        window.dispatchEvent(new CustomEvent('auth-change'));
      }

      return user;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur connexion Apple');
    }
  }


  async login(credentials) {
    try {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data;

      if (token) {
        localStorage.setItem('auth_token', token);
      }

      return user;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de connexion');
    }
  }

  async register(userData) {
    try {
      const response = await api.post('/auth/register', userData);
      const { token, user } = response.data;

      if (token) {
        localStorage.setItem('auth_token', token);
      }

      return user;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur d\'inscription');
    }
  }

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      localStorage.removeItem('auth_token');
      // Dispatch custom event to notify auth state change
      window.dispatchEvent(new CustomEvent('auth-change'));
    }
  }

  async me() {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Utilisateur non authentifié');
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await api.put('/auth/profile', profileData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de mise à jour du profil');
    }
  }

  async changePassword(passwordData) {
    try {
      const response = await api.put('/auth/change-password', passwordData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de changement de mot de passe');
    }
  }

  isAuthenticated() {
    return !!localStorage.getItem('auth_token');
  }

  getToken() {
    return localStorage.getItem('auth_token');
  }
}

export default new AuthService();
