import { HoldRole } from '../../generated/prisma/client';

export class HoldDto {
  holdCode!: string;
  x!: number;
  y!: number;
  role!: HoldRole;
}

export class PublicNoteDto {
  id!: number;
  // Inclinaison de l'ascension commentée : un bloc à 40° et à 50° se
  // commente séparément, et le client filtre sur l'inclinaison affichée.
  angleDegrees!: number;
  username!: string;
  avatarUrl!: string | null;
  content!: string;
  feltGradeRank!: number | null;
  likesCount!: number;
  createdAt!: Date;
}

export class BoulderSummaryDto {
  id!: number;
  name!: string;
  // Le rang seul : le client l'affiche dans l'échelle de l'utilisateur
  // (Font ou V), que cette route publique ne connaît pas.
  gradeRank!: number;
  angleDegrees!: number;
  creatorUsername!: string;
  tags!: string[];
  ascentCount!: number;
  averageRating!: number | null;
  isPublic!: boolean;
  createdAt!: Date;
}

export class BoulderLikeStatusDto {
  liked!: boolean;
}

export class LikedBoulderDto {
  id!: number;
  name!: string;
  // Cotation à l'inclinaison du like ; `null` quand elle n'est pas cotée.
  gradeRank!: number | null;
  angleDegrees!: number;
  likedAt!: Date;
}

// Cotation du bloc à une inclinaison (ligne de `boulder_angles`).
export class AngleGradeDto {
  angleDegrees!: number;
  // Cotation effective ; `null` tant que personne n'y a envoyé le bloc.
  gradeRank!: number | null;
  votesCount!: number;
  // Peu de votes, hors inclinaison du créateur.
  isEstimated!: boolean;
}

export class BoulderDetailDto extends BoulderSummaryDto {
  description!: string | null;
  holds!: HoldDto[];
  publicNotes!: PublicNoteDto[];
  // Une entrée par inclinaison, dans l'ordre croissant. `gradeRank` et
  // `angleDegrees` au premier niveau restent la référence du créateur.
  angleGrades!: AngleGradeDto[];
}
