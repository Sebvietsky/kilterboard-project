import { IsInt, IsOptional } from 'class-validator';

export class AddBoulderDto {
  @IsInt()
  boulderId!: number;

  // Obligatoire, comme sur POST /ascents : une entrée de playlist est un bloc
  // à une inclinaison, et seul le client sait laquelle était affichée.
  @IsInt()
  angleDegrees!: number;

  @IsOptional()
  @IsInt()
  position?: number;
}

export class AddOrRemoveBoulderResponseDto {
  position?: number | null;
  addedAt!: Date;
  boulderId!: number;
  playlistId!: number;
  angleId!: number;
}
