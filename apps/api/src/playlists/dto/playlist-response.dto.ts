export class PlaylistSummaryDto {
  id!: number;
  userId!: number;
  name!: string;
  description!: string | null;
  isPublic!: boolean;
  creatorUsername!: string;
  boulderCount!: number;
  createdAt!: Date;
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
  vScale!: string;
  fontScale!: string;
  angleDegrees!: number;
}
