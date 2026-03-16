import api from './api';
import type { ApiResponse, Attachment } from '../types';

export const attachmentService = {
  getTodoAttachments: async (todoId: number) => {
    const response = await api.get<ApiResponse<Attachment[]>>(`/todo/${todoId}`);
    return response.data;
  },

  uploadAttachment: async (todoId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<ApiResponse<Attachment>>(
      `/todo/${todoId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  getAttachment: async (id: number) => {
    const response = await api.get<ApiResponse<Attachment>>(`/${id}`);
    return response.data;
  },

  downloadAttachment: async (id: number) => {
    const response = await api.get(`/${id}/download`, {
      responseType: 'blob',
    });
    return response;
  },

  previewAttachment: async (id: number) => {
    const response = await api.get(`/${id}/preview`, {
      responseType: 'blob',
    });
    return response;
  },

  deleteAttachment: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/${id}`);
    return response.data;
  },
};