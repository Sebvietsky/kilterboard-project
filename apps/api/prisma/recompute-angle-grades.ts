import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { recomputeAngleGrade } from '../src/boulders/community-grade';
import 'dotenv/config';

/**
 * Recalcule la cotation de toutes les lignes `boulder_angles` à partir des
 * votes en base, avec la même fonction que l'API.
 *
 * Sert après un changement de la règle (seuil, médiane) et après le seed de
 * dev, qui écrit des ascensions sans passer par l'API. Idempotent.
 *
 * `pnpm --filter api db:recompute-grades`
 */
export async function recomputeAllAngleGrades(
  db: PrismaClient,
): Promise<number> {
  const rows = await db.boulderAngle.findMany({
    select: { boulderId: true, angleId: true },
  });
  // Une transaction par ligne : le verrou de recomputeAngleGrade n'a de sens
  // que dans une transaction, et une ligne en échec n'annule pas les autres.
  for (const { boulderId, angleId } of rows) {
    await db.$transaction((tx) => recomputeAngleGrade(tx, boulderId, angleId));
  }
  return rows.length;
}

// Exécuté seulement en ligne de commande. Importé par seed-dev, le module ne
// crée pas de client : il utilise celui du seed.
if (require.main === module) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  recomputeAllAngleGrades(prisma)
    .then((count) => console.log(`✅ ${count} cotations recalculées`))
    .catch((error) => {
      console.error('❌ Recalcul échoué :', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
