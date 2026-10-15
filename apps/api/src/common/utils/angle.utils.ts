import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Résout une inclinaison en degrés vers l'id de la table `angles`.
 *
 * Le client ne connaît que les degrés (ce qu'affiche le sélecteur), jamais
 * l'id en base. `valueDegrees` est @unique ; une inclinaison absente de la
 * table (47°, hors du pas de 5°) est une entrée invalide -> 400.
 */
/**
 * Cotation d'un bloc à une inclinaison donnée, `null` si elle n'est pas cotée.
 *
 * Étape 1 : seule l'inclinaison du créateur a une cotation, la sienne. Ailleurs
 * on ne sait pas encore : renvoyer la sienne laisserait croire qu'un 50° vaut
 * un 45°. À l'étape 2, cette fonction lira `boulder_angle_grades` : c'est le
 * seul endroit à changer pour les favoris et les playlists.
 */
export function gradeAtAngle<G>(
  boulder: { angleId: number; grade: G },
  angleId: number,
): G | null {
  return boulder.angleId === angleId ? boulder.grade : null;
}

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
