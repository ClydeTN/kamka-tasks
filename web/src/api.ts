import type { Task, Tag, Comment, Activity, Stats, Priority } from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text();
    }
    throw new Error(`${res.status} ${res.statusText} — ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listTasks: (params: { tag?: string; done?: 'true' | 'false' } = {}): Promise<Task[]> => {
    const qs = new URLSearchParams();
    if (params.tag) qs.set('tag', params.tag);
    if (params.done) qs.set('done', params.done);
    const suffix = qs.toString() ? `?${qs}` : '';
    return request<Task[]>(`/tasks${suffix}`);
  },
  getTask: (id: number) => request<Task>(`/tasks/${id}`),
  createTask: (input: {
    title: string;
    description?: string | null;
    due_date?: string | null;
    priority?: Priority;
    tag_ids?: number[];
  }) => request<Task>(`/tasks`, { method: 'POST', body: JSON.stringify(input) }),
  patchTask: (id: number, input: Partial<{
    title: string;
    description: string | null;
    due_date: string | null;
    priority: Priority;
    done: boolean;
    tag_ids: number[];
  }>) => request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  stats: () => request<Stats>(`/tasks/_stats/summary`),

  listTags: () => request<Tag[]>(`/tags`),
  createTag: (name: string, color?: string) =>
    request<Tag>(`/tags`, { method: 'POST', body: JSON.stringify({ name, color }) }),
  deleteTag: (id: number) => request<void>(`/tags/${id}`, { method: 'DELETE' }),

  listComments: (taskId: number) => request<Comment[]>(`/tasks/${taskId}/comments`),
  addComment: (taskId: number, body: string, author?: string) =>
    request<Comment>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, author }),
    }),

  taskActivity: (taskId: number) => request<Activity[]>(`/tasks/${taskId}/activity`),
  globalActivity: (limit = 50) => request<Activity[]>(`/activity?limit=${limit}`),
};
