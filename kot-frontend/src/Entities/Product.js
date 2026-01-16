import api from '../services/api.service';

class Product {
  static async list() {
    try {
      const response = await api.get('/products');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de récupération des produits');
    }
  }

  static async getCategories() {
    try {
      const response = await api.get('/products/categories/list');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de récupération des catégories');
    }
  }

  static async create(data) {
    const response = await api.post('/products', data);
    return response.data;
  }

  static async update(id, data) {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  }

  static async delete(id) {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  }

  static async getOptions(productId) {
    try {
      const response = await api.get(`/products/${productId}/options`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de récupération des options');
    }
  }
}

export { Product };
