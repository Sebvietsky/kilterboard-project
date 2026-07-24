export interface BoulderSummary {
  id: number;
  name: string;
  gradeLabel: string;
  gradeRank: number;
  angleDegrees: number;
  creatorUsername: string;
  tags: string[];
  ascentCount: number;
  averageRating: number | null;
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

export type HoldRole = 'START' | 'HAND' | 'FOOT' | 'FINISH'; // = enum Prisma
export interface Hold {
  holdCode: string;
  x: number;
  y: number;
  role: HoldRole;
}
export interface PublicNote {
  username: string;
  avatarUrl: string | null;
  content: string;
  feltGradeLabel: string | null;
  likesCount: number;
  createdAt: string;
}
export interface BoulderDetail extends BoulderSummary {
  description: string | null;
  holds: Hold[];
  publicNotes: PublicNote[];
}
