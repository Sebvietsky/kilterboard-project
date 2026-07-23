export interface BoulderSummary {
  id: number;
  name: string;
  gradeLabel: string;
  gradeRank: number;
  angleDegrees: number;
  creatorUsername: string;
  tags: string[];
  ascentCount: number;
  averageRating: number;
  isPublic: boolean;
  createdAt: string; // string JSON, PAS Date
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface BoulderFilters {
  angle?: number;
  gradeMin?: number;
  gradeMax?: number;
  tags?: string[];
  name?: string;
  creator?: string;
}
