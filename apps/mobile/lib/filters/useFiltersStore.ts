import { create } from "zustand";
import { FiltersState, FiltersValues } from "./types";

const INITIAL: FiltersValues = {
  name: undefined, creator: undefined, angle: undefined,
  gradeMin: undefined, gradeMax: undefined, tags: []
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...INITIAL,
  setAngle: (angle) => set({ angle }),
  setGrade: (rank) => set({ gradeMin: rank, gradeMax: rank }),
  setFilters: (values: Partial<FiltersValues>) => set(values),
  reset: () => set(INITIAL)
}));
