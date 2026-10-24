import { create } from 'zustand';
import { mergeBoard } from './mergeBoard';
import {
  BluetoothUnavailableError,
  type BoardConnection,
  type BoardConnectionState,
  type DiscoveredBoard,
} from './types';

const SCAN_DURATION_MS = 10_000;

// Connexion simulée avec `EXPO_PUBLIC_BOARD_SIMULATED=1` dans `.env` :
// développer l'interface sans board. Affiché sur la carte (« Demo ») : les
// boards simulées ne doivent pas passer pour des vraies.
export const IS_SIMULATED_CONNECTION =
  process.env.EXPO_PUBLIC_BOARD_SIMULATED === '1';

type BoardStore = {
  state: BoardConnectionState;
  // Injectée par RootLayout, qui possède le BleManager (un seul par app).
  // `null` avant son premier effet : les actions ne font alors rien.
  connection: BoardConnection | null;
  setConnection: (connection: BoardConnection | null) => void;
  scan: () => Promise<void>;
  connect: (board: DiscoveredBoard) => Promise<void>;
  disconnect: () => Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Store global et non state d'écran : la connexion doit survivre à l'écran
// qui l'ouvre. Home se connecte, le détail d'un bloc l'utilisera pour
// allumer ses prises.
export const useBoardStore = create<BoardStore>((set, get) => ({
  state: { status: 'idle' },
  connection: null,

  setConnection: (connection) => set({ connection }),

  scan: async () => {
    const { state, connection } = get();
    if (!connection) return;
    if (state.status === 'scanning' || state.status === 'connected') return;

    set({ state: { status: 'scanning', boards: [] } });
    try {
      await connection.scan((board) => {
        const current = get().state;
        // Une board découverte après un Connect n'a plus d'écran où
        // s'afficher.
        if (current.status !== 'scanning') return;
        const boards = mergeBoard(current.boards, board);
        if (boards === current.boards) return;
        set({ state: { status: 'scanning', boards } });
      }, SCAN_DURATION_MS);
    } catch (error) {
      set({
        state:
          error instanceof BluetoothUnavailableError
            ? { status: 'unavailable', reason: error.reason }
            : { status: 'error', message: errorMessage(error) },
      });
      return;
    }

    // Fin du scan : on ne garde la liste que si rien d'autre ne s'est passé
    // entre-temps (un Connect arrête le scan).
    const current = get().state;
    if (current.status === 'scanning') {
      set({ state: { status: 'scanned', boards: current.boards } });
    }
  },

  connect: async (board) => {
    const { connection } = get();
    if (!connection) return;
    await connection.stopScan();
    set({ state: { status: 'connecting', board } });
    try {
      await connection.connect(board, () => {
        set({ state: { status: 'idle' } });
      });
      set({ state: { status: 'connected', board } });
    } catch (error) {
      set({ state: { status: 'error', message: errorMessage(error) } });
    }
  },

  disconnect: async () => {
    await get().connection?.disconnect();
    set({ state: { status: 'idle' } });
  },
}));
