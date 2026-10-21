export type GradeSystem = 'V_SCALE' | 'FONT_SCALE';
export type User = {
  id: number;
  email: string;
  username: string;
  role: 'USER' | 'ADMIN';
  bio: string | null;
  avatarUrl: string | null;
  country: string | null;
  gradeSystem: GradeSystem;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

type TokenPayload = {
  token: string;
  type: 'Bearer';
  expiresInMs: number;
};

export type AuthTokens = {
  accessToken: TokenPayload;
  refreshToken: TokenPayload;
};

// `offline` : au lancement, le serveur n'a pas répondu. La session est
// peut-être bonne, on ne sait pas : ni écran de connexion, ni onglets.
export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'offline';

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    username: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  // Relance le démarrage depuis l'état `offline`.
  retry: () => void;
};
