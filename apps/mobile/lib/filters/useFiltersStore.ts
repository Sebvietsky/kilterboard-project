import { create } from "zustand";

interface FiltersState {
  // l'état (les filtres appliqués)
  name?: string;
  creator?: string;
  angle?: number;
  gradeMin?: number;
  gradeMax?: number;
  tags: string[];
  // les actions qui le modifient
  setAngle: (angle?: number) => void;
  setGrade: (rank?: number) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  name: undefined,
  creator: undefined,
  angle: undefined,
  gradeMin: undefined,
  gradeMax: undefined,
  tags: [],
  setAngle: (angle) => set({ angle }),
  setGrade: (rank) => set({ gradeMin: rank, gradeMax: rank }),
  reset: () =>
    set({ name: undefined, creator: undefined, angle: undefined,
          gradeMin: undefined, gradeMax: undefined, tags: [] }),
}));
