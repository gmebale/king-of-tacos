import api from '../services/api.service';
import authService from '../services/auth.service';

class User {
  static async list() {
    try {
      const response = await api.get('/users');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de récupération des utilisateurs');
    }
  }

  static async me() {
    try {
      return await authService.me();
    } catch (error) {
      return null;
    }
  }

  static async logout() {
    await authService.logout();
  }

  static async login(credentials) {
    return await authService.login(credentials);
  }

  static async register(userData) {
    return await authService.register(userData);
  }

  static async updateProfile(profileData) {
    return await authService.updateProfile(profileData);
  }

  static async create(userData) {
    try {
      const response = await api.post('/users', userData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de création d\'utilisateur');
    }
  }

  static isAuthenticated() {
    return authService.isAuthenticated();
  }

  static getToken() {
    return authService.getToken();
  }
}

export { User };
