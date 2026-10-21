import { getAuthBridge, type RefreshResult } from './authBridge';
import { ApiError, extractApiErrorMessage, NetworkError } from './errors';
import { request } from './request';

let refreshPromise: Promise<RefreshResult> | null = null;

async function deduplicatedRefresh(): Promise<RefreshResult> {
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

  const res = await request(path, { ...options, headers });

  if (res.status === 401 && !isRetry) {
    const refresh = await deduplicatedRefresh();

    // Déconnexion uniquement quand le serveur a refusé le refresh token.
    if (refresh.status === 'rejected') {
      getAuthBridge().onAuthFailure();
      throw new Error('Session expired');
    }

    // Serveur injoignable : la requête échoue, la session est conservée.
    // L'écran affiche son état d'erreur et son Retry, comme pour toute panne
    // réseau — au lieu de renvoyer l'utilisateur à l'écran de connexion.
    if (refresh.status === 'unavailable') {
      throw new NetworkError();
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
