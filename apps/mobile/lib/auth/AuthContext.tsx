// lib/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import { authStorage } from "./storage";
import type { AuthContextValue, AuthStatus, AuthTokens, User } from "./types";
import { config } from "@/lib/api/config";
import { configureAuthBridge } from "../api/authBridge";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  async function fetchAndSetUser(accessToken: string) {
    const resUser = await fetch(`${config.API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!resUser.ok) throw new Error("Fetch user failed");
    const dataUser = await resUser.json();
    setUser(dataUser.user);
  }

  async function login(identifier: string, password: string) {
    const res = await fetch(`${config.API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Login failed" }));
      throw new Error(error.message ?? "Login failed");
    }

    const data: AuthTokens = await res.json();

    await authStorage.setRefreshToken(data.refreshToken.token);

    await fetchAndSetUser(data.accessToken.token);
    setAccessToken(data.accessToken.token);

    setStatus("authenticated");
  }

  async function register(email: string, password: string, username: string) {
    const res = await fetch(`${config.API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username }),
    });

    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: "Register failed" }));
      throw new Error(error.message ?? "Register failed");
    }

    await login(email, password);
  }

  async function logout() {
    const refreshToken = await authStorage.getRefreshToken();
    if (refreshToken) {
      fetch(`${config.API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // On ignore les erreurs : si le serveur est down, on logout quand même côté client
      });
    }

    await authStorage.clearRefreshToken();
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }

  async function refreshTokens(): Promise<string | null> {
    const refreshToken = await authStorage.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${config.API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        throw new Error("Refresh tokens failed");
      }
      const data: AuthTokens = await res.json();
      await authStorage.setRefreshToken(data.refreshToken.token);
      setAccessToken(data.accessToken.token);

      return data.accessToken.token;
    } catch {
      await authStorage.clearRefreshToken();
      return null;
    }
  }

  useEffect(() => {
    async function bootstrap() {
      // Tout le bootstrap est sous try/catch : quelle que soit l'erreur
      // (SecureStore indisponible, réseau, /auth/me KO), on doit TOUJOURS
      // sortir de "loading" — sinon splash screen éternel.
      try {
        const newAccessToken = await refreshTokens();

        if (!newAccessToken) {
          setStatus("unauthenticated");
          return;
        }

        await fetchAndSetUser(newAccessToken);
        setStatus("authenticated");
      } catch {
        await authStorage.clearRefreshToken().catch(() => {});
        setAccessToken(null);
        setStatus("unauthenticated");
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    configureAuthBridge({
      getAccessToken: () => accessTokenRef.current,
      refresh: refreshTokens,
      onAuthFailure: () => {
        logout();
      },
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ status, user, accessToken, login, logout, register }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
