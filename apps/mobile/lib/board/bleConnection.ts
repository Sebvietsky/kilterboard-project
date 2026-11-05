import {
  State,
  type BleManager,
  type Device,
  type Subscription,
} from 'react-native-ble-plx';
import type { LazyBleManager } from './lazyBleManager';
import { parseBoardName } from './parseBoardName';
import {
  ADVERTISING_SERVICE_UUID,
  UART_SERVICE_UUID,
  UART_WRITE_UUID,
  chunks,
  toBase64,
} from './protocol';
import {
  BluetoothUnavailableError,
  type BoardConnection,
  type DiscoveredBoard,
} from './types';

// iOS démarre en `Unknown` puis passe à l'état réel : on l'attend avant de
// scanner. Un Bluetooth éteint, refusé ou absent lève une erreur typée, que
// le store traduit en état `unavailable`.
function waitForPoweredOn(manager: BleManager): Promise<void> {
  return new Promise((resolve, reject) => {
    const subscription = manager.onStateChange((state) => {
      const reason =
        state === State.PoweredOff
          ? 'poweredOff'
          : state === State.Unauthorized
            ? 'unauthorized'
            : state === State.Unsupported
              ? 'unsupported'
              : null;
      if (state === State.PoweredOn) {
        subscription.remove();
        resolve();
      } else if (reason) {
        subscription.remove();
        reject(new BluetoothUnavailableError(reason));
      }
    }, true);
  });
}

// Par identifiant : sans délai, iOS attend indéfiniment un appareil qui ne
// s'annonce plus (une identité de passage disparue entre le scan et le tap).
const CONNECT_TIMEOUT_MS = 8_000;

// Connexion réelle, par react-native-ble-plx. Même contrat que la connexion
// simulée : le store ne voit pas la différence.
//
// Le manager est reçu, jamais créé ici : ble-plx n'en accepte qu'un par app,
// et c'est RootLayout qui le possède (docs/DECISIONS.md, 2026-10-23). Il ne
// démarre qu'au premier `get()`, c'est-à-dire au premier scan.
export function createBleConnection(lazy: LazyBleManager): BoardConnection {
  let device: Device | null = null;
  let disconnectSubscription: Subscription | null = null;
  // Fin du scan en cours : arrête la radio et résout la promesse de `scan`.
  let endScan: (() => void) | null = null;

  function forgetDevice() {
    disconnectSubscription?.remove();
    disconnectSubscription = null;
    device = null;
  }

  return {
    async scan(onBoard, durationMs) {
      endScan?.();
      const manager = lazy.get();
      await waitForPoweredOn(manager);

      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => endScan?.(), durationMs);
        const finish = (error?: Error) => {
          clearTimeout(timer);
          endScan = null;
          void manager.stopDeviceScan();
          if (error) reject(error);
          else resolve();
        };
        endScan = () => finish();

        void manager.startDeviceScan(
          [ADVERTISING_SERVICE_UUID],
          null,
          (error, found) => {
            if (error) {
              finish(error);
              return;
            }
            const advertisedName = found?.name ?? found?.localName;
            if (!found || !advertisedName) return;
            // Une annonce = un identifiant. Le store regroupe ceux d'une même
            // board sous sa série (`mergeBoard`).
            const parsed = parseBoardName(advertisedName);
            onBoard({
              key: parsed.serial ?? found.id,
              deviceIds: [found.id],
              ...parsed,
              rssi: found.rssi ?? null,
            } satisfies DiscoveredBoard);
          },
        );
      });
    },

    async stopScan() {
      endScan?.();
    },

    async connect(board, onDisconnect) {
      const manager = lazy.get();
      let lastError: unknown = null;

      // Dans l'ordre du scan : l'identité stable de la board est en général
      // vue la première. Une identité de passage peut avoir disparu depuis.
      for (const deviceId of board.deviceIds) {
        try {
          const connected = await manager.connectToDevice(deviceId, {
            timeout: CONNECT_TIMEOUT_MS,
          });
          try {
            await connected.discoverAllServicesAndCharacteristics();
          } catch (error) {
            // Connecté sans services utilisables : on libère avant d'essayer
            // l'identifiant suivant.
            await manager.cancelDeviceConnection(deviceId).catch(() => {});
            throw error;
          }
          device = connected;
          // Coupure qui ne vient pas de l'app : board éteinte, hors de
          // portée, ou un autre téléphone qui prend la main (vu en salle).
          disconnectSubscription = manager.onDeviceDisconnected(
            connected.id,
            () => {
              forgetDevice();
              onDisconnect();
            },
          );
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error('Board not reachable');
    },

    async disconnect() {
      if (!device) return;
      const { id } = device;
      // Avant l'annulation : une déconnexion voulue n'est pas une coupure.
      forgetDevice();
      await lazy.get().cancelDeviceConnection(id);
    },

    async write(packet) {
      if (!device) throw new Error('Not connected to a board');
      // Écriture sans réponse, tranche par tranche et dans l'ordre : la board
      // recompose le paquet.
      const manager = lazy.get();
      for (const chunk of chunks(packet)) {
        await manager.writeCharacteristicWithoutResponseForDevice(
          device.id,
          UART_SERVICE_UUID,
          UART_WRITE_UUID,
          toBase64(chunk),
        );
      }
    },
  };
}
