import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { HoldRole } from '../../generated/prisma/client';

export class BoulderHoldInputDto {
  // Id de la prise en base, celui que renvoie `GET /board-sizes/:id`.
  @IsInt()
  holdId!: number;

  @IsEnum(HoldRole)
  role!: HoldRole;
}

// Création d'un brouillon (décision du 2026-11-18) : un bloc pas fini, que
// son créateur affine avant de le publier. Tout est obligatoire sauf la
// description ; la cotation est provisoire. Au moins un START et un FINISH ne
// s'exigent qu'à la publication.
//
// Pas de layout : il se déduit des prises, et un layout envoyé à côté
// pourrait les contredire.
export class CreateBoulderDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150) // = VarChar(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  // Inclinaison de référence du bloc, celle de sa cotation de départ.
  @IsInt()
  angleDegrees!: number;

  // Rang et non id, comme le grade ressenti : le client raisonne en rangs.
  @IsInt()
  gradeRank!: number;

  // Une prise n'a qu'un rôle par bloc (`boulder_holds` a pour clé
  // `(boulder_id, hold_id)`) : un doublon se refuse ici en 400, au lieu
  // d'une violation de clé en base.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((hold: BoulderHoldInputDto) => hold.holdId)
  @ValidateNested({ each: true })
  @Type(() => BoulderHoldInputDto)
  holds!: BoulderHoldInputDto[];
}
