import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * `?angle=50` : inclinaison en degrés d'une action sur un bloc (like, retrait
 * d'une playlist). En query et non dans le corps : GET et DELETE n'en ont pas.
 * Même nom que le filtre `angle` d'Explore.
 */
export class AngleQueryDto {
  @IsInt()
  @Type(() => Number)
  angle!: number;
}
