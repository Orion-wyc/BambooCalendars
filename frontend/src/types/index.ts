export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  is_completed: boolean;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
}

export interface Attachment {
  id: number;
  todo_id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  thumbnail_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  file_type: 'image' | 'document' | 'other';
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    fields?: string[];
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface TodosResponse {
  todos: Todo[];
  total: number;
  pages: number;
  current_page: number;
}

export interface Record {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface RecordsResponse {
  records: Record[];
  total: number;
  pages: number;
  current_page: number;
}