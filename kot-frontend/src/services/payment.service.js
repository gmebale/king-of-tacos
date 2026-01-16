import api from './api.service';

export const PaymentService = {
  async createStripeIntent(orderId) {
    const response = await api.post('/payments/stripe/create-intent', { orderId });
    return response.data;
  },

  async createPaypalOrder(orderId) {
    const response = await api.post('/payments/paypal/create', { orderId });
    return response.data;
  }
};


