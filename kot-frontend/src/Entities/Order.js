import api from '../services/api.service';

class Order {
  static async list() {
    try {
      const response = await api.get('/orders');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de récupération des commandes');
    }
  }

  static async create(data) {
    const response = await api.post('/orders', data);
    return response.data;
  }

  static async update(id, data) {
    const response = await api.put(`/orders/${id}`, data);
    return response.data;
  }

  static async delete(id) {
    await api.delete(`/orders/${id}`);
  }

  static async filter(filters, sort = '') {
    try {
      const queryParams = new URLSearchParams();

      if (filters.status) queryParams.append('status', filters.status);
      if (filters.user_id) queryParams.append('user_id', filters.user_id);
      if (filters.date_from) queryParams.append('date_from', filters.date_from);
      if (filters.date_to) queryParams.append('date_to', filters.date_to);

      const response = await api.get(`/orders/filter?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de filtrage des commandes');
    }
  }

  static async myOrders() {
    try {
      const response = await api.get('/orders/my-orders');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Erreur de récupération des commandes');
    }
  }
}

export { Order };
