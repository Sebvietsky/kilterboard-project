/**
 * Issue d'une tentative de refresh. Trois cas, que l'ancien `string | null`
 * confondait en deux :
 *
 * - `refreshed` : nouveau token d'accès, on rejoue la requête.
 * - `rejected` : le SERVEUR a refusé le refresh token. La session est morte,
 *   seule issue possible : déconnecter.
 * - `unavailable` : on n'a pas pu savoir (réseau coupé, serveur qui redémarre,
 *   5xx, 429). La session est peut-être encore bonne : on ne déconnecte pas.
 */
export type RefreshResult =
  | { status: 'refreshed'; accessToken: string }
  | { status: 'rejected' }
  | { status: 'unavailable' };

type AuthBridge = {
  getAccessToken: () => string | null;
  refresh: () => Promise<RefreshResult>;
  onAuthFailure: () => void;
};

let bridge: AuthBridge | null = null;

export function configureAuthBridge(b: AuthBridge): void {
  bridge = b;
}

export function getAuthBridge(): AuthBridge {
  if (!bridge) {
    throw new Error('AuthBridge not configured. Did you mount AuthProvider?');
  }
  return bridge;
}
