import api from './api';
import type { ApiResponse, Record, RecordsResponse } from '../types';

export const recordService = {
  getRecords: async (params?: {
    page?: number;
    per_page?: number;
  }) => {
    const response = await api.get<ApiResponse<RecordsResponse>>('/records', { params });
    return response.data;
  },

  getRecord: async (id: number) => {
    const response = await api.get<ApiResponse<Record>>(`/records/${id}`);
    return response.data;
  },

  createRecord: async (data: {
    content: string;
  }) => {
    const response = await api.post<ApiResponse<Record>>('/records', data);
    return response.data;
  },

  updateRecord: async (id: number, data: {
    content: string;
  }) => {
    const response = await api.put<ApiResponse<Record>>(`/records/${id}`, data);
    return response.data;
  },

  deleteRecord: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/records/${id}`);
    return response.data;
  },
};