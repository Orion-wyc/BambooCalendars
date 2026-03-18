import api from './api';
import type { ApiResponse, Step } from '../types';

export const stepService = {
  getSteps: async (todoId: number) => {
    const response = await api.get<ApiResponse<{ steps: Step[] }>>(`/todos/${todoId}/steps`);
    return response.data;
  },

  createStep: async (todoId: number, data: {
    content: string;
  }) => {
    const response = await api.post<ApiResponse<Step>>(`/todos/${todoId}/steps`, data);
    return response.data;
  },

  updateStep: async (stepId: number, data: {
    content?: string;
    order?: number;
  }) => {
    const response = await api.put<ApiResponse<Step>>(`/steps/${stepId}`, data);
    return response.data;
  },

  toggleComplete: async (stepId: number, isCompleted: boolean) => {
    const response = await api.patch<ApiResponse<Step>>(`/steps/${stepId}/complete`, {
      is_completed: isCompleted,
    });
    return response.data;
  },

  deleteStep: async (stepId: number) => {
    const response = await api.delete<ApiResponse<null>>(`/steps/${stepId}`);
    return response.data;
  },

  reorderSteps: async (steps: Array<{ id: number; order: number }>) => {
    const response = await api.put<ApiResponse<null>>('/steps/reorder', {
      steps,
    });
    return response.data;
  },
};