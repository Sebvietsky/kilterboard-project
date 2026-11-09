import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Résout une inclinaison en degrés vers l'id de la table `angles`.
 *
 * Le client ne connaît que les degrés (ce qu'affiche le sélecteur), jamais
 * l'id en base. `valueDegrees` est @unique ; une inclinaison absente de la
 * table (47°, hors du pas de 5°) est une entrée invalide -> 400.
 */
export async function resolveAngleId(
  prisma: PrismaService,
  degrees: number,
): Promise<number> {
  const angle = await prisma.angle.findUnique({
    where: { valueDegrees: degrees },
    select: { id: true },
  });
  if (!angle) {
    throw new BadRequestException('Invalid angle.');
  }
  return angle.id;
}
