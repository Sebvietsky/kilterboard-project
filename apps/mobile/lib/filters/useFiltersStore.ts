import { create } from 'zustand';
import { FiltersState, FiltersValues } from './types';
import { DEFAULT_ANGLE } from './const';

const INITIAL: FiltersValues = {
  name: undefined,
  creator: undefined,
  angle: DEFAULT_ANGLE,
  gradeMin: undefined,
  gradeMax: undefined,
  tags: [],
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...INITIAL,
  setAngle: (angle) => set({ angle }),
  setGrade: (rank) => set({ gradeMin: rank, gradeMax: rank }),
  setFilters: (values: Partial<FiltersValues>) => set(values),
  // L'inclinaison n'est pas un filtre qu'on efface : c'est celle de la board.
  reset: () => set((state) => ({ ...INITIAL, angle: state.angle })),
}));
