import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AscentStatus } from '../../generated/prisma/client';

export class CreateAscentDto {
  @IsInt()
  @Type(() => Number)
  boulderId!: number;

  // Obligatoire et sans défaut serveur : seul le client sait à quelle
  // inclinaison la board était réglée. Un défaut (celle du créateur) ferait
  // d'un oubli une donnée fausse et silencieuse plutôt qu'un 400.
  @IsInt()
  @Type(() => Number)
  angleDegrees!: number;

  @IsEnum(AscentStatus)
  status!: AscentStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  attemptsCount?: number;

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

  // Absent : le serveur rattache à la session active. `null` explicite : hors
  // session. `@IsOptional()` laisse passer les deux, d'où le type.
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sessionId?: number | null;
}
