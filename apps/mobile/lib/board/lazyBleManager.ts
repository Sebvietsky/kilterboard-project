import { BleManager } from 'react-native-ble-plx';

export type LazyBleManager = { get: () => BleManager };

// Un BleManager démarre le Bluetooth d'iOS dès sa création : Bluetooth coupé,
// iOS affiche alors une alerte, à chaque lancement de l'app. Créé au premier
// besoin (un scan), il ne dérange pas qui ouvre l'app sans board.
// Toujours une seule instance : `get` renvoie la même à chaque appel.
export function createLazyBleManager(): LazyBleManager {
  let manager: BleManager | null = null;
  return {
    get: () => {
      manager ??= new BleManager();
      return manager;
    },
  };
}
