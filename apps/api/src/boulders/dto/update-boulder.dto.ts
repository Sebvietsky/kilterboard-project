import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  BoulderHoldInputDto,
  MAX_HOLDS_PER_BOULDER,
} from './create-boulder.dto';

// Modification d'un brouillon (décision du 2026-11-18). Tout est facultatif,
// mais jamais vide s'il est fourni : la création l'exige, et l'édition ne
// doit pas permettre de le contourner.
//
// Pas d'inclinaison : elle est fixée à la création. Le même bloc à une autre
// inclinaison est un autre bloc (décision du 2026-10-15) ; un `angleDegrees`
// envoyé est refusé par le pipe (`forbidNonWhitelisted`).
export class UpdateBoulderDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150) // = VarChar(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // Cotation provisoire, modifiable jusqu'à la publication.
  @IsOptional()
  @IsInt()
  gradeRank?: number;

  // Remplace toutes les prises du bloc : le client envoie l'état complet,
  // pas un différentiel.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_HOLDS_PER_BOULDER)
  @ArrayUnique((hold: BoulderHoldInputDto) => hold.holdId)
  @ValidateNested({ each: true })
  @Type(() => BoulderHoldInputDto)
  holds?: BoulderHoldInputDto[];
}
