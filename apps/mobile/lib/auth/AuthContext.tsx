// lib/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useCallback,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authStorage } from './storage';
import type { AuthContextValue, AuthStatus, AuthTokens, User } from './types';
import { request } from '../api/request';
import { configureAuthBridge, type RefreshResult } from '../api/authBridge';
import { extractApiErrorMessage, NetworkError } from '../api/errors';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // AuthProvider est monté SOUS QueryClientProvider (cf. app/_layout.tsx),
  // donc le client est disponible ici.
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  // Le ref est écrit de façon SYNCHRONE, le state suit pour le rendu.
  //
  // Un effet de synchronisation (ref <- state) était en retard d'un rendu, et
  // ça coûtait une déconnexion toutes les 15 minutes : sur 401, le client
  // rafraîchit puis rejoue AUSSITÔT la requête en relisant le ref. Le state
  // n'étant pas encore committé, il rejouait avec le token expiré, prenait un
  // second 401, et déclenchait onAuthFailure — donc logout. Le serveur, lui,
  // avait bien rafraîchi.
  const applyAccessToken = useCallback((token: string | null) => {
    accessTokenRef.current = token;
    setAccessToken(token);
  }, []);

  // En useCallback : `bootstrap` en dépend.
  const fetchAndSetUser = useCallback(async (accessToken: string) => {
    const resUser = await request('/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!resUser.ok) throw new Error('Fetch user failed');
    // GET /users/me renvoie l'utilisateur DIRECTEMENT, pas enveloppé dans
    // { user }. Attention : res.json() est typé `any`, donc rien ici n'est
    // vérifié par tsc — l'annotation est la seule garde. La réponse porte
    // aussi `_count`, ignoré à ce niveau : le contexte est la source
    // d'IDENTITÉ, les statistiques appartiennent à la query de profil.
    const dataUser = (await resUser.json()) as User;
    setUser(dataUser);
  }, []);

  async function login(identifier: string, password: string) {
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => null);
      throw new Error(extractApiErrorMessage(error, 'Login failed'));
    }

    const data: AuthTokens = await res.json();

    await authStorage.setRefreshToken(data.refreshToken.token);

    await fetchAndSetUser(data.accessToken.token);
    applyAccessToken(data.accessToken.token);

    setStatus('authenticated');
  }

  async function register(email: string, password: string, username: string) {
    const res = await request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(extractApiErrorMessage(payload, 'Register failed'));
    }

    await login(email, password);
  }

  const logout = useCallback(async () => {
    const refreshToken = await authStorage.getRefreshToken();
    if (refreshToken) {
      request('/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessTokenRef.current}`,
        },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // On ignore les erreurs : si le serveur est down, on logout quand même côté client
      });
    }

    await authStorage.clearRefreshToken();
    applyAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');

    // Le cache TanStack survit à la déconnexion : sans ce clear, se connecter
    // avec un AUTRE compte affiche brièvement les données du précédent (ses
    // ascensions, ses projets) avant le refetch. C'est ici et non dans un
    // écran, parce que la déconnexion arrive aussi par onAuthFailure — un 401
    // en cours de route ne passe par aucun écran.
    queryClient.clear();
  }, [queryClient, applyAccessToken]);

  const refreshTokens = useCallback(async (): Promise<RefreshResult> => {
    const refreshToken = await authStorage.getRefreshToken();
    if (!refreshToken) return { status: 'rejected' };

    let res: Response;
    try {
      res = await request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // `request` ne lève que si la requête n'a pas abouti (pas de réseau,
      // serveur éteint, timeout). Le serveur n'a rien refusé : le token reste.
      return { status: 'unavailable' };
    }

    // Le serveur répond 401 à un refresh token inconnu ou expiré, 400 à un
    // corps invalide : dans les deux cas ce token ne servira plus jamais.
    if (res.status === 401 || res.status === 400) {
      await authStorage.clearRefreshToken();
      return { status: 'rejected' };
    }

    // 5xx, 429… : panne passagère, le token est peut-être encore bon.
    if (!res.ok) return { status: 'unavailable' };

    const data = (await res.json()) as AuthTokens;
    await authStorage.setRefreshToken(data.refreshToken.token);
    applyAccessToken(data.accessToken.token);

    return { status: 'refreshed', accessToken: data.accessToken.token };
  }, [applyAccessToken]);

  // Incrémenté par `retry` : relance l'effet de démarrage.
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  // Un seul essai, sans nouvelle tentative automatique : depuis le timeout,
  // un hôte muet coûte 10 s par essai (trois essais faisaient 33 s de
  // splash). C'est l'utilisateur qui relance, par le Retry de l'écran
  // hors ligne.
  useEffect(() => {
    async function bootstrap() {
      // Tout le bootstrap est sous try/catch : quelle que soit l'erreur
      // (SecureStore indisponible, réseau, /users/me KO), on doit TOUJOURS
      // sortir de "loading" — sinon splash screen éternel.
      try {
        const refresh = await refreshTokens();

        if (refresh.status === 'rejected') {
          setStatus('unauthenticated');
          return;
        }

        // Serveur injoignable : le refresh token est conservé, et on
        // n'affiche pas l'écran de connexion — la session est peut-être bonne.
        if (refresh.status === 'unavailable') {
          setStatus('offline');
          return;
        }

        await fetchAndSetUser(refresh.accessToken);
        setStatus('authenticated');
      } catch (error) {
        // Pas de clearRefreshToken ici : une erreur de ce bloc est une panne
        // (réseau, stockage), pas un refus du serveur. Effacer le token
        // transformerait une coupure passagère en déconnexion.
        applyAccessToken(null);
        setStatus(
          error instanceof NetworkError ? 'offline' : 'unauthenticated',
        );
      }
    }

    void bootstrap();
  }, [refreshTokens, fetchAndSetUser, applyAccessToken, bootstrapAttempt]);

  const retry = useCallback(() => {
    setStatus('loading');
    setBootstrapAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    configureAuthBridge({
      getAccessToken: () => accessTokenRef.current,
      refresh: refreshTokens,
      onAuthFailure: () => {
        logout();
      },
    });
  }, [logout, refreshTokens]);

  return (
    <AuthContext.Provider
      value={{ status, user, accessToken, login, logout, register, retry }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
