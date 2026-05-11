import { IsInt, IsOptional } from 'class-validator';

export class AddBoulderDto {
  @IsInt()
  boulderId!: number;

  @IsOptional()
  @IsInt()
  position?: number;
}

export class AddOrRemoveBoulderResponseDto {
  position?: number | null;
  addedAt!: Date;
  boulderId!: number;
  playlistId!: number;
}
