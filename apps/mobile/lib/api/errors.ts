// La ValidationPipe de NestJS renvoie `message: string[]` (une entrée par
// règle violée) ; les autres erreurs (401, 409…) renvoient une string.
// Ce helper normalise les deux formes en un message affichable.
export function extractApiErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) return message.join('\n');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// La requête n'a pas abouti (pas de réseau, serveur éteint, timeout) : le
// serveur n'a rien répondu, donc rien refusé. Pas de `status`, contrairement
// à ApiError.
export class NetworkError extends Error {
  constructor(message = 'Couldn’t reach the server. Please try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}
