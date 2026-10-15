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
  id: number;
  // Inclinaison de l'ascension commentée : l'écran n'affiche que les
  // commentaires de l'inclinaison sélectionnée.
  angleDegrees: number;
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

export interface BoulderLikeStatus {
  liked: boolean;
}

// Un favori = un bloc à une inclinaison : le même bloc peut apparaître deux
// fois. `angleDegrees` est celle du like, pas celle du créateur, et la
// cotation celle de cette inclinaison : `null` quand elle n'est pas cotée.
export interface BoulderLiked {
  id: number;
  name: string;
  gradeLabel: string | null;
  gradeRank: number | null;
  angleDegrees: number;
  likedAt: string;
}
