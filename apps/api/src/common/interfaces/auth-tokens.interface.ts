interface Token {
  token: string;
  type: 'Bearer';
  expiresInMs: number;
}

export interface AuthTokens {
  accessToken: Token;
  refreshToken: Token;
}
