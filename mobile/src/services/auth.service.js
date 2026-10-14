import api from './api';

export const authService = {
  async register(name, email, phoneNumber, password) {
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        phoneNumber,
        password
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  async login(emailOrPhone, password) {
    try {
      const response = await api.post('/auth/login', {
        emailOrPhone,
        password
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  async getProfile() {
    try {
      const response = await api.get('/auth/me');
      return response;
    } catch (error) {
      throw error;
    }
  },

  async updateProfile(data) {
    try {
      const response = await api.put('/auth/profile', data);
      return response;
    } catch (error) {
      throw error;
    }
  }
};
