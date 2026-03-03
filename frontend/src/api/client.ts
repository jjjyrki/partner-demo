const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

// Auth
export interface AuthUser {
  id: number;
  username: string;
  kyc_status: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function register(username: string, password: string) {
  return api<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string) {
  return api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export interface MeResponse extends AuthUser {
  wallet: {
    available_balance: number;
    locked_balance: number;
    status: string;
  } | null;
}

export function getMe() {
  return api<MeResponse>('/auth/me');
}

// Users
export function patchMe(data: { username?: string; password?: string }) {
  return api<AuthUser>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Tasks
export interface TaskStep {
  id: number;
  task_id: number;
  step_order: number;
  label: string;
}

export interface TaskUser {
  id: number;
  username: string;
}

export interface TaskSubmission {
  id: number;
  task_id: number;
  completer_user_id: number;
  completed_step_ids: number[];
  submitted_at: string;
  approved_at: string | null;
  User?: TaskUser;
}

export interface Task {
  id: number;
  owner_user_id: number;
  title: string;
  description: string | null;
  reward_amount: number;
  status: 'open' | 'in_review' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  User?: TaskUser;
  TaskSteps?: TaskStep[];
  TaskSubmission?: TaskSubmission | null;
}

export function getTasks(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return api<Task[]>(`/tasks${q}`);
}

export function getTask(id: number) {
  return api<Task>(`/tasks/${id}`);
}

export function createTask(data: {
  title: string;
  description?: string;
  steps: { label: string }[];
  reward_amount: number;
}) {
  return api<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTask(
  id: number,
  data: {
    title?: string;
    description?: string;
    steps?: { label: string }[];
    reward_amount?: number;
  }
) {
  return api<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function cancelTask(id: number) {
  return api<{ message: string }>(`/tasks/${id}`, {
    method: 'DELETE',
  });
}

export function submitTask(id: number, completed_step_ids: number[]) {
  return api<Task>(`/tasks/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ completed_step_ids }),
  });
}

export function approveTask(id: number) {
  return api<Task>(`/tasks/${id}/approve`, {
    method: 'POST',
  });
}

// Messages
export interface TaskMessage {
  id: number;
  task_id: number;
  author_user_id: number;
  body: string;
  created_at: string;
  User?: TaskUser;
}

export function getMessages(taskId: number) {
  return api<TaskMessage[]>(`/tasks/${taskId}/messages`);
}

export function postMessage(taskId: number, body: string) {
  return api<TaskMessage>(`/tasks/${taskId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}
