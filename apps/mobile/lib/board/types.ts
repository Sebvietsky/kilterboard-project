// Une board vue au scan Bluetooth.
export type DiscoveredBoard = {
  // Clé de la board dans l'app : son numéro de série, ou à défaut son
  // identifiant BLE. Une ligne par clé dans la liste du scan.
  key: string;
  // Identifiants BLE sous lesquels elle s'est annoncée, dans l'ordre où le
  // scan les a vus. Une même board en montre plusieurs à la fois autour d'une
  // connexion, la sienne ou celle d'un autre grimpeur ; ceux de passage
  // disparaissent en moins de 2 minutes (relevé en salle le 2026-10-23). Sur
  // iOS, ils sont propres au téléphone.
  deviceIds: string[];
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
  // Essaie les identifiants de la board dans l'ordre, jusqu'au premier qui
  // répond. `onDisconnect` : coupure qui ne vient pas de l'app (board
  // éteinte, hors de portée, autre téléphone).
  connect(board: DiscoveredBoard, onDisconnect: () => void): Promise<void>;
  disconnect(): Promise<void>;
  write(packet: number[]): Promise<void>;
}
