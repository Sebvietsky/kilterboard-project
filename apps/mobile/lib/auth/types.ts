export type GradeSystem = "V_SCALE" | "FONT_SCALE";
export type User = {
  id: number;
  email: string;
  username: string;
  role: "USER" | "ADMIN";
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
  type: "Bearer";
  expiresInMs: number;
};

export type AuthTokens = {
  accessToken: TokenPayload;
  refreshToken: TokenPayload;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

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
};
