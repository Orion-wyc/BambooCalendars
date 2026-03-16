import api from './api';
import type { ApiResponse, Todo, TodosResponse } from '../types';

export const todoService = {
  getTodos: async (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: string;
    priority?: string;
    sort_by?: string;
    order?: string;
  }) => {
    const response = await api.get<ApiResponse<TodosResponse>>('/todos', { params });
    return response.data;
  },

  getTodo: async (id: number) => {
    const response = await api.get<ApiResponse<Todo>>(`/todos/${id}`);
    return response.data;
  },

  createTodo: async (data: {
    title: string;
    description?: string;
    priority?: 'high' | 'medium' | 'low';
    due_date?: string;
  }) => {
    const response = await api.post<ApiResponse<Todo>>('/todos', data);
    return response.data;
  },

  updateTodo: async (id: number, data: {
    title?: string;
    description?: string;
    priority?: 'high' | 'medium' | 'low';
    due_date?: string | null;
  }) => {
    const response = await api.put<ApiResponse<Todo>>(`/todos/${id}`, data);
    return response.data;
  },

  deleteTodo: async (id: number) => {
    const response = await api.delete<ApiResponse<null>>(`/todos/${id}`);
    return response.data;
  },

  toggleComplete: async (id: number, isCompleted: boolean) => {
    const response = await api.patch<ApiResponse<Todo>>(`/todos/${id}/complete`, {
      is_completed: isCompleted,
    });
    return response.data;
  },
};