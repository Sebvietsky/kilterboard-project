import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AscentStatus } from '../../generated/prisma/client';

export class UpdateAscentDto {
  @IsOptional()
  @IsEnum(AscentStatus)
  status?: AscentStatus;

  /**
   * Essais réalisés pendant CETTE séance, jamais le cumul.
   *
   * Le nom porte le sens : `attemptsCount` laisserait croire à une valeur
   * absolue, et un client qui enverrait 3 après 12 essais ferait reculer le
   * compteur sans que rien ne s'y oppose. Ici seul le serveur additionne, donc
   * le total ne peut que croître.
   *
   * Min(1) : une séance sans essai n'en est pas une.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  attemptsToAdd?: number;

  // feltGradeRank et non feltGradeId : le client raisonne en rangs, stables et
  // lisibles. C'est déjà le contrat de POST /ascents ; les deux routes
  // divergeaient, ce qui obligeait le mobile à connaître les id de la table
  // Grade pour l'une et pas pour l'autre.
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  feltGradeRank?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating?: number;
}
