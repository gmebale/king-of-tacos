import api from '../services/api.service';

class Review {
  static async list(params = {}) {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.pageSize) queryParams.append('pageSize', params.pageSize);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.rating && params.rating !== 'all') queryParams.append('rating', params.rating);
    if (params.search) queryParams.append('search', params.search);

    const response = await api.get(`/reviews?${queryParams.toString()}`);
    return response.data;
  }

  static async create(data) {
    const response = await api.post('/reviews', data);
    return response.data;
  }

  static async updateStatus(id, status) {
    const response = await api.patch(`/reviews/${id}/status`, { status });
    return response.data;
  }
}

export { Review };

