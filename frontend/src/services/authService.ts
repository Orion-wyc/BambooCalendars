import api from './api';
import type { ApiResponse, AuthResponse, User } from '../types';

export const authService = {
  register: async (username: string, email: string, password: string) => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', {
      username,
      email,
      password,
    });
    return response.data;
  },

  login: async (username: string, password: string) => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      username,
      password,
    });
    return response.data;
  },

  logout: async () => {
    const response = await api.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },
};