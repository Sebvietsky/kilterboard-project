// Une board vue au scan Bluetooth.
export type DiscoveredBoard = {
  // Identifiant BLE. Sur iOS, il est propre au téléphone : il ne désigne pas
  // la board d'un appareil à l'autre. Le numéro de série, lui, si.
  id: string;
  // Partie du nom diffusé avant le premier `#`.
  name: string;
  serial: string | null;
  // Fixe l'encodage des prises (docs/ble-protocol.md, section 4).
  apiLevel: 2 | 3;
  // Force du signal en dBm, quand le scan la donne.
  rssi: number | null;
};

// Union discriminée sur `status` : chaque état ne porte que ce qui existe
// dans cet état. Une board connectée n'a pas de liste de scan, une erreur
// n'a pas de board.
export type BoardConnectionState =
  | { status: 'idle' }
  | { status: 'unavailable'; reason: BluetoothUnavailableReason }
  | { status: 'scanning'; boards: DiscoveredBoard[] }
  | { status: 'scanned'; boards: DiscoveredBoard[] }
  | { status: 'connecting'; board: DiscoveredBoard }
  | { status: 'connected'; board: DiscoveredBoard }
  | { status: 'error'; message: string };

export type BluetoothUnavailableReason =
  | 'poweredOff'
  | 'unauthorized'
  | 'unsupported';

export class BluetoothUnavailableError extends Error {
  constructor(readonly reason: BluetoothUnavailableReason) {
    super(`Bluetooth unavailable: ${reason}`);
  }
}

// Ce que l'app attend d'une connexion à une board, quelle qu'elle soit :
// la vraie (ble-plx) ou la simulée, qui permet de construire l'interface
// sans board. Le store ne connaît que cette interface.
export interface BoardConnection {
  // Se résout à la fin du scan. Lève `BluetoothUnavailableError` si le
  // Bluetooth est éteint ou refusé.
  scan(
    onBoard: (board: DiscoveredBoard) => void,
    durationMs: number,
  ): Promise<void>;
  stopScan(): Promise<void>;
  // `onDisconnect` : coupure qui ne vient pas de l'app (board éteinte,
  // hors de portée).
  connect(board: DiscoveredBoard, onDisconnect: () => void): Promise<void>;
  disconnect(): Promise<void>;
  write(packet: number[]): Promise<void>;
}
