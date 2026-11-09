export interface BoulderSummary {
  id: number;
  name: string;
  // Le serveur n'envoie que le rang : `useGradeLabel` le traduit dans
  // l'échelle de l'utilisateur.
  gradeRank: number;
  angleDegrees: number;
  creatorUsername: string;
  // Pseudo Kilter d'un bloc importé, à afficher à la place du compte système
  // `kilter` ; `null` pour un bloc créé dans l'app.
  setterName: string | null;
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
  // Obligatoire côté API : une carte = un bloc à cette inclinaison.
  angle: number;
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
  feltGradeRank: number | null;
  likesCount: number;
  createdAt: string;
}
// Cotation du bloc à une inclinaison (GET /boulders/:id, `angleGrades`).
export interface AngleGrade {
  angleDegrees: number;
  // Cotation effective ; sans cotation de départ, `null` tant que personne
  // n'y a envoyé le bloc.
  gradeRank: number | null;
  // Cotation de départ : celle du créateur à son inclinaison, celle de Kilter
  // pour un bloc importé. `null` s'il n'y en a pas.
  baseGradeRank: number | null;
  votesCount: number;
  // Peu de votes, sans cotation de départ.
  isEstimated: boolean;
}

// `gradeRank` et `angleDegrees` hérités de BoulderSummary restent la
// référence du créateur ; la cotation à afficher est dans `angleGrades`.
export interface BoulderDetail extends BoulderSummary {
  description: string | null;
  holds: Hold[];
  publicNotes: PublicNote[];
  angleGrades: AngleGrade[];
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
  gradeRank: number | null;
  angleDegrees: number;
  likedAt: string;
}
