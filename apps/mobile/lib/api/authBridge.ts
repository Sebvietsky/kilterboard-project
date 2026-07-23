type AuthBridge = {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
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
