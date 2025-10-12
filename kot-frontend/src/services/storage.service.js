class StorageService {
  // localStorage methods
  setItem(key, value) {
    try {
      const serializedValue = JSON.stringify(value);
      localStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde dans localStorage:', error);
      return false;
    }
  }

  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (error) {
      console.error('Erreur lors de la lecture depuis localStorage:', error);
      return defaultValue;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression depuis localStorage:', error);
      return false;
    }
  }

  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Erreur lors du nettoyage de localStorage:', error);
      return false;
    }
  }

  // sessionStorage methods
  setSessionItem(key, value) {
    try {
      const serializedValue = JSON.stringify(value);
      sessionStorage.setItem(key, serializedValue);
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde dans sessionStorage:', error);
      return false;
    }
  }

  getSessionItem(key, defaultValue = null) {
    try {
      const item = sessionStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (error) {
      console.error('Erreur lors de la lecture depuis sessionStorage:', error);
      return defaultValue;
    }
  }

  removeSessionItem(key) {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression depuis sessionStorage:', error);
      return false;
    }
  }

  clearSession() {
    try {
      sessionStorage.clear();
      return true;
    } catch (error) {
      console.error('Erreur lors du nettoyage de sessionStorage:', error);
      return false;
    }
  }

  // Utility methods
  hasItem(key) {
    return localStorage.getItem(key) !== null;
  }

  hasSessionItem(key) {
    return sessionStorage.getItem(key) !== null;
  }

  // Cart specific methods
  getCart() {
    return this.getItem('kingoftacos_cart', []);
  }

  setCart(cart) {
    return this.setItem('kingoftacos_cart', cart);
  }

  clearCart() {
    return this.removeItem('kingoftacos_cart');
  }

  // Auth specific methods
  getAuthToken() {
    return localStorage.getItem('auth_token');
  }

  setAuthToken(token) {
    if (token) {
      localStorage.setItem('auth_token', token);
      return true;
    }
    return false;
  }

  removeAuthToken() {
    localStorage.removeItem('auth_token');
    return true;
  }

  // User preferences
  getUserPreferences() {
    return this.getItem('user_preferences', {});
  }

  setUserPreferences(preferences) {
    return this.setItem('user_preferences', preferences);
  }
}

export default new StorageService();
