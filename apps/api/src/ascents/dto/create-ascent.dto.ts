import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AscentStatus } from '../../generated/prisma/client';

export class CreateAscentDto {
  @IsInt()
  @Type(() => Number)
  boulderId!: number;

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

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sessionId?: number;
}
