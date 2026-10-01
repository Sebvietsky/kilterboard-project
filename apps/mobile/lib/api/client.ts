import { getAuthBridge } from './authBridge';
import { config } from './config';
import { ApiError, extractApiErrorMessage } from './errors';

let refreshPromise: Promise<string | null> | null = null;

async function deduplicatedRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = getAuthBridge()
    .refresh()
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T | null> {
  const accessToken = getAuthBridge().getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${config.API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !isRetry) {
    const newAccessToken = await deduplicatedRefresh();

    if (!newAccessToken) {
      getAuthBridge().onAuthFailure();
      throw new Error('Session expired');
    }

    return apiFetch<T>(path, options, true);
  }

  if (res.status === 401 && isRetry) {
    getAuthBridge().onAuthFailure();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      extractApiErrorMessage(error, `Request failed with status ${res.status}`),
    );
  }

  const rawBody = await res.text();
  // Une réponse OK peut n'avoir aucun corps => 204 ou GET /sessions/active (sans session active)
  // on traduit en null ces réponses
  // Les méthodes décident si c'est normal de renvoyer null
  if (!rawBody) return null;

  return JSON.parse(rawBody) as T;
}

async function apiFetchNonNullable<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const data = await apiFetch<T>(path, options);
  if (data === null)
    throw new Error(`Empty response body for ${options.method} ${path}`);
  return data;
}

export const api = {
  get: <T>(path: string): Promise<T> =>
    apiFetchNonNullable<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    apiFetchNonNullable<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown): Promise<T> =>
    apiFetchNonNullable<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    apiFetchNonNullable<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: async (path: string): Promise<void> => {
    await apiFetch(path, { method: 'DELETE' });
  },
  getOrNull: <T>(path: string): Promise<T | null> =>
    apiFetch<T>(path, {
      method: 'GET',
    }),
};
