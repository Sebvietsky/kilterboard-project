export class PlaylistSummaryDto {
  id!: number;
  userId!: number;
  name!: string;
  description!: string | null;
  isPublic!: boolean;
  creatorUsername!: string;
  boulderCount!: number;
  createdAt!: Date;
  // Présent uniquement quand la liste est demandée pour un bloc donné, à une
  // inclinaison donnée (GET /playlists/me?boulderId=…&angle=…).
  containsBoulder?: boolean;
}

export class PlaylistBoulderDto {
  position!: number | null;
  addedAt!: Date;
  boulder!: PlaylistBoulderItemDto;
}

export class PlaylistDetailDto extends PlaylistSummaryDto {
  boulders!: PlaylistBoulderDto[];
}

export class PlaylistResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  isPublic!: boolean;
  createdAt!: Date;
}

export class PlaylistBoulderItemDto {
  id!: number;
  name!: string;
  // Cotation à l'inclinaison de l'entrée ; `null` quand elle n'est pas cotée.
  gradeRank!: number | null;
  // Inclinaison de l'entrée, pas celle du créateur : le même bloc peut
  // figurer deux fois dans une playlist, à deux inclinaisons.
  angleDegrees!: number;
}
