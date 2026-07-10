'use client';

import { useAuth } from '@/store/auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  _retried?: boolean;
}

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken, setAccessToken, clear } = useAuth.getState();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      clear();
      return false;
    }
    const json = await res.json();
    setAccessToken(json.data.access_token);
    return true;
  } catch {
    clear();
    return false;
  }
}

export async function apiRequest<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const token = useAuth.getState().accessToken;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !opts._retried) {
    const ok = await refreshAccessToken();
    if (ok) return apiRequest<T>(path, { ...opts, _retried: true });
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }

  if (!res.ok) {
    const err = json?.error;
    throw new ApiError(res.status, err?.code || 'ERROR', err?.message || `Request failed (${res.status})`);
  }
  return json as T;
}

/** Upload a file via multipart/form-data with auth (used for media uploads). */
export async function uploadFile(file: File): Promise<{ url: string; filename: string; mime: string; size: number }> {
  const token = useAuth.getState().accessToken;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/uploads`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code || 'ERROR', json?.error?.message || 'Upload thất bại');
  }
  // Static uploads are served from the backend origin (not under /api/v1).
  const origin = BASE_URL.replace(/\/api\/v1\/?$/, '');
  return { ...json.data, url: `${origin}${json.data.url}` };
}

// Typed helpers
export const api = {
  get: <T = any>(path: string) => apiRequest<T>(path),
  post: <T = any>(path: string, body?: unknown, auth = true) => apiRequest<T>(path, { method: 'POST', body, auth }),
  patch: <T = any>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  del: <T = any>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
