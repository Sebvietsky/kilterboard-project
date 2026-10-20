import { parseBoardName } from './parseBoardName';
import type { BoardConnection, DiscoveredBoard } from './types';

// Deux boards fictives, découvertes l'une après l'autre comme dans un vrai
// scan. Noms au format diffusé par une board (`nom#série#niveauAPI`).
const FAKE_BOARDS = [
  { id: 'sim-1', advertisedName: 'Kilter Board#12345#3', rssi: -58 },
  { id: 'sim-2', advertisedName: 'Kilter Board#67890#3', rssi: -81 },
];
const DISCOVERY_DELAY_MS = 900;
const CONNECT_DELAY_MS = 800;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Connexion simulée : même contrat que la vraie, sans Bluetooth. Sert à
// construire et tester l'interface sans board.
export function createSimulatedConnection(): BoardConnection {
  let scanTimers: ReturnType<typeof setTimeout>[] = [];
  let endScan: (() => void) | null = null;

  function clearScan() {
    scanTimers.forEach(clearTimeout);
    scanTimers = [];
    endScan?.();
    endScan = null;
  }

  return {
    scan(onBoard, durationMs) {
      clearScan();
      return new Promise((resolve) => {
        endScan = resolve;
        FAKE_BOARDS.forEach(({ id, advertisedName, rssi }, index) => {
          const board: DiscoveredBoard = {
            id,
            ...parseBoardName(advertisedName),
            rssi,
          };
          scanTimers.push(
            setTimeout(() => onBoard(board), DISCOVERY_DELAY_MS * (index + 1)),
          );
        });
        scanTimers.push(setTimeout(clearScan, durationMs));
      });
    },
    async stopScan() {
      clearScan();
    },
    async connect() {
      await wait(CONNECT_DELAY_MS);
    },
    async disconnect() {},
    async write() {},
  };
}
