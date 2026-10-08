import type { Session } from '../types';
export const SESSION_KEY = 'liquid247:admin-session';
export function storedSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = storedSession()?.token;
  const response = await fetch('/api/admin/' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.includes('login'))
      window.dispatchEvent(new CustomEvent('session-expired'));
    throw new Error(data.message || '操作失败');
  }
  return data;
}
export const post = <T = any>(path: string, body: unknown = {}) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const patch = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const remove = (path: string) => api(path, { method: 'DELETE' });
export function queryString(values: Record<string, any>) {
  const q = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.set(key, String(value));
  });
  return q.toString();
}
