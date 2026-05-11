import { HoldRole } from '../../generated/prisma/client';

export class HoldDto {
  holdCode!: string;
  x!: number;
  y!: number;
  role!: HoldRole;
}

export class PublicNoteDto {
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

export class BoulderDetailDto extends BoulderSummaryDto {
  description!: string | null;
  holds!: HoldDto[];
  publicNotes!: PublicNoteDto[];
}
