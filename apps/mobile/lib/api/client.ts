import { getAuthBridge } from "./authBridge";
import { config } from "./config";

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
): Promise<T> {
  const accessToken = getAuthBridge().getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${config.API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !isRetry) {
    const newAccessToken = await deduplicatedRefresh();

    if (!newAccessToken) {
      getAuthBridge().onAuthFailure();
      throw new Error("Session expired");
    }

    return apiFetch<T>(path, options, true);
  }

  if (res.status === 401 && isRetry) {
    getAuthBridge().onAuthFailure();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({
      message: `Request failed with status ${res.status}`,
    }));
    throw new Error(
      error.message ?? `Request failed with status ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
