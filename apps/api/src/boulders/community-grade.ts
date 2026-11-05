import { AscentStatus, Prisma } from '../generated/prisma/client';

/**
 * Cotation communautaire d'un bloc à une inclinaison.
 *
 * Un vote = le grade ressenti du premier envoi d'un grimpeur à cette
 * inclinaison (un seul par grimpeur, garanti par l'index partiel
 * `ascents_one_felt_grade_per_user_boulder_angle`).
 *
 * - Inclinaison du créateur : sa cotation tant qu'il y a moins de
 *   COMMUNITY_GRADE_THRESHOLD votes, la médiane des votes ensuite.
 * - Autre inclinaison : pas de cotation sans vote, la médiane dès le premier,
 *   « estimée » sous le seuil.
 *
 * Toute la règle vit ici : le service des ascensions l'appelle à chaque vote,
 * le script `prisma/recompute-angle-grades.ts` pour les données existantes.
 */

// Seuil de 5 et non 10 : les votes sont fragmentés par inclinaison, et une
// médiane sur 5 résiste encore à deux avis aberrants.
export const COMMUNITY_GRADE_THRESHOLD = 5;

type Ranked = { rank: number };

/**
 * Médiane basse : avec un nombre pair de votes, la plus facile des deux
 * cotations du milieu. On stocke une vraie cotation de la table `grades`, et
 * « V5,5 » n'en est pas une. C'est la médiane discrète usuelle, celle de
 * `percentile_disc(0.5)` en SQL.
 */
export function medianGrade<T extends Ranked>(grades: readonly T[]): T | null {
  if (grades.length === 0) return null;
  const sorted = [...grades].sort((a, b) => a.rank - b.rank);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/**
 * Cotation effective à une inclinaison. `creatorGrade` n'est fourni que pour
 * l'inclinaison du créateur ; partout ailleurs il vaut `null`.
 */
export function effectiveGrade<T extends Ranked>(
  votes: readonly T[],
  creatorGrade: T | null,
): T | null {
  if (creatorGrade && votes.length < COMMUNITY_GRADE_THRESHOLD) {
    return creatorGrade;
  }
  return medianGrade(votes);
}

/** « Estimée » ne se stocke pas : peu de votes, hors inclinaison du créateur. */
export function isEstimatedGrade(
  votesCount: number,
  isCreatorAngle: boolean,
): boolean {
  return (
    !isCreatorAngle && votesCount > 0 && votesCount < COMMUNITY_GRADE_THRESHOLD
  );
}

/**
 * Recalcule la ligne `boulder_angles` d'un bloc à une inclinaison à partir des
 * votes en base. À appeler dans la transaction qui écrit le vote.
 *
 * Le verrou de ligne (FOR UPDATE) sérialise deux votes simultanés sur le même
 * bloc à la même inclinaison : sans lui, chacun pourrait relire les votes
 * avant que l'autre soit commité, et le dernier à écrire en oublierait un.
 * Prisma n'exprime pas FOR UPDATE, d'où la requête brute (paramétrée).
 */
export async function recomputeAngleGrade(
  db: Prisma.TransactionClient,
  boulderId: number,
  angleId: number,
): Promise<void> {
  await db.$queryRaw`
    SELECT 1 FROM boulder_angles
    WHERE boulder_id = ${boulderId} AND angle_id = ${angleId}
    FOR UPDATE`;

  const boulder = await db.boulder.findUniqueOrThrow({
    where: { id: boulderId },
    select: { angleId: true, grade: { select: { id: true, rank: true } } },
  });
  // Le filtre sur le statut double l'invariant : seul un envoi vote.
  const ascents = await db.ascent.findMany({
    where: {
      boulderId,
      angleId,
      status: { in: [AscentStatus.SENT, AscentStatus.FLASH] },
      feltGradeId: { not: null },
    },
    select: { feltGrade: { select: { id: true, rank: true } } },
  });
  const votes = ascents.flatMap((a) => (a.feltGrade ? [a.feltGrade] : []));

  const grade = effectiveGrade(
    votes,
    boulder.angleId === angleId ? boulder.grade : null,
  );

  await db.boulderAngle.update({
    where: { boulderId_angleId: { boulderId, angleId } },
    data: { gradeId: grade?.id ?? null, votesCount: votes.length },
  });
}
