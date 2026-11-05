import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Crée les lignes `boulder_angles` d'un bloc : une par inclinaison de la table
 * `angles`, la cotation du créateur sur la sienne, aucune ailleurs.
 *
 * Idempotent (`skipDuplicates`) : relancer le seed ne touche pas aux lignes
 * existantes, ni donc aux cotations et votes déjà calculés. Une inclinaison
 * ajoutée à la table reçoit sa ligne au prochain passage.
 */
export async function ensureBoulderAngles(
  prisma: PrismaClient,
  boulder: { id: number; angleId: number; gradeId: number },
): Promise<void> {
  const angles = await prisma.angle.findMany({ select: { id: true } });
  await prisma.boulderAngle.createMany({
    data: angles.map((angle) => ({
      boulderId: boulder.id,
      angleId: angle.id,
      gradeId: angle.id === boulder.angleId ? boulder.gradeId : null,
    })),
    skipDuplicates: true,
  });
}
