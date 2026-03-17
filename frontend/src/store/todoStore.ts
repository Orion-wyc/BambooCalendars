import { create } from 'zustand';
import type { Todo } from '../types';

interface TodoState {
  todos: Todo[];
  selectedTodo: Todo | null;
  filter: {
    search: string;
    status: string;
    priority: string;
    sort_by: string;
    order: string;
  };
  setTodos: (todos: Todo[]) => void;
  setSelectedTodo: (todo: Todo | null) => void;
  addTodo: (todo: Todo) => void;
  updateTodo: (todo: Todo) => void;
  removeTodo: (id: number) => void;
  setFilter: (filter: Partial<TodoState['filter']>) => void;
}

export const useTodoStore = create<TodoState>((set) => ({
  todos: [],
  selectedTodo: null,
  filter: {
    search: '',
    status: '',
    priority: '',
    sort_by: 'created_at',
    order: 'desc',
  },
  
  setTodos: (todos) => set({ todos }),
  
  setSelectedTodo: (todo) => set({ selectedTodo: todo }),
  
  addTodo: (todo) => set((state) => ({ todos: [todo, ...state.todos] })),
  
  updateTodo: (todo) => set((state) => ({
    todos: state.todos.map((t) => (t.id === todo.id ? todo : t)),
    selectedTodo: state.selectedTodo?.id === todo.id ? todo : state.selectedTodo,
  })),
  
  removeTodo: (id) => set((state) => ({
    todos: state.todos.filter((t) => t.id !== id),
    selectedTodo: state.selectedTodo?.id === id ? null : state.selectedTodo,
  })),
  
  setFilter: (filter) => set((state) => ({
    filter: { ...state.filter, ...filter },
  })),
}));