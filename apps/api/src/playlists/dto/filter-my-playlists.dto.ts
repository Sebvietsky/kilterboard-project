import { IsInt, IsOptional, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterMyPlaylistsDto {
  // Fourni par l'écran « Add to playlist » : chaque playlist indique alors si
  // elle contient déjà ce bloc à cette inclinaison.
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  boulderId?: number;

  // Obligatoire dès que `boulderId` est là : « contient ce bloc » n'a plus de
  // sens sans inclinaison, le même bloc pouvant y figurer à deux inclinaisons.
  @ValidateIf((dto: FilterMyPlaylistsDto) => dto.boulderId !== undefined)
  @IsInt()
  @Type(() => Number)
  angle?: number;
}
