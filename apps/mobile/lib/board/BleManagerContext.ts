import { createContext, useContext } from 'react';
import type { LazyBleManager } from './lazyBleManager';

// Le BleManager unique de l'app, possédé par RootLayout et démarré au premier
// `get()`. `null` quand la connexion est simulée : pas de Bluetooth du tout.
export const BleManagerContext = createContext<LazyBleManager | null>(null);

// Pour les outils qui parlent à ble-plx directement (écran d'essai). Le reste
// de l'app passe par le store et l'interface `BoardConnection`.
export function useBleManager(): LazyBleManager | null {
  return useContext(BleManagerContext);
}
