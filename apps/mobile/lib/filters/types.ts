export type FiltersValues = {
  name?: string;
  creator?: string;
  angle?: number;
  gradeMin?: number;
  gradeMax?: number;
  tags: string[];
};

export interface FiltersState extends FiltersValues {
  setAngle: (angle?: number) => void;
  setGrade: (rank?: number) => void;
  setFilters: (partial: Partial<FiltersValues>) => void;
  reset: () => void;
}
