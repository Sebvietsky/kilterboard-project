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
  feltGradeLabel!: string | null;
  likesCount!: number;
  createdAt!: Date;
}

export class BoulderSummaryDto {
  id!: number;
  name!: string;
  gradeLabel!: string;
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
  gradeLabel!: string | null;
  gradeRank!: number | null;
  angleDegrees!: number;
  likedAt!: Date;
}

export class BoulderDetailDto extends BoulderSummaryDto {
  description!: string | null;
  holds!: HoldDto[];
  publicNotes!: PublicNoteDto[];
}
