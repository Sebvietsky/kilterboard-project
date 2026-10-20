import { create } from 'zustand';
import { createSimulatedConnection } from './simulatedConnection';
import {
  BluetoothUnavailableError,
  type BoardConnection,
  type BoardConnectionState,
  type DiscoveredBoard,
} from './types';

const SCAN_DURATION_MS = 10_000;

// Simulée tant que l'essai en salle n'a pas validé le protocole
// (docs/notes/ble-essai-salle.md). La vraie connexion remplacera cette ligne.
const connection: BoardConnection = createSimulatedConnection();
// Affiché sur la carte : les boards simulées ne doivent pas passer pour des
// vraies.
export const IS_SIMULATED_CONNECTION = true;

type BoardStore = {
  state: BoardConnectionState;
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

  scan: async () => {
    const { state } = get();
    if (state.status === 'scanning' || state.status === 'connected') return;

    set({ state: { status: 'scanning', boards: [] } });
    try {
      await connection.scan((board) => {
        const current = get().state;
        // Une board découverte après un Connect n'a plus d'écran où
        // s'afficher.
        if (current.status !== 'scanning') return;
        if (current.boards.some(({ id }) => id === board.id)) return;
        set({
          state: { status: 'scanning', boards: [...current.boards, board] },
        });
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
    await connection.disconnect();
    set({ state: { status: 'idle' } });
  },
}));
