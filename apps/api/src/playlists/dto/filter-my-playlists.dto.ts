import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterMyPlaylistsDto {
  // Fourni par l'écran « Add to playlist » : chaque playlist indique alors si
  // elle contient déjà ce bloc.
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  boulderId?: number;
}
