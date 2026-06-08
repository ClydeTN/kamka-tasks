export type Priority = 'low' | 'medium' | 'high';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  done: boolean;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface Comment {
  id: number;
  taskId: number;
  author: string;
  body: string;
  createdAt: string;
}

export interface Activity {
  id: number;
  taskId: number | null;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface Stats {
  total: number;
  done: number;
  overdue: number;
}
