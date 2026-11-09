import { PrismaPg } from '@prisma/adapter-pg';
import { HoldRole, Prisma, PrismaClient } from '../src/generated/prisma/client';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import {
  BOARD_TYPE,
  KILTER_LAYOUT_ID,
  KILTER_LAYOUT_NAME,
  fetchJson,
  int,
  isArtifact,
  num,
  optional,
  str,
  withSnapshot,
  type Artifact,
  type Row,
} from './kilter-snapshot';

/**
 * Importe les blocs de la Kilter Board Original depuis le snapshot public de
 * boardsesh (`docs/notes/kilter-data.md`), décisions du 2026-11-06 :
 * - seulement les blocs grimpés par au moins MIN_ASCENSIONISTS personnes à une
 *   inclinaison de notre table (20 à 70°), et compatibles avec toutes les
 *   tailles importées ;
 * - créateur en base : le compte système `kilter` ; le pseudo Kilter va dans
 *   `boulders.setter_name` ;
 * - cotation de départ à chaque inclinaison où Kilter a des statistiques
 *   (`boulder_angles.base_grade_id`), statistiques brutes dans
 *   `kilter_angle_stats`.
 *
 * À lancer après `db:import-catalog` et `db:seed` (prises, inclinaisons,
 * cotations). Idempotent : un bloc déjà importé (même `kilter_uuid`) n'est ni
 * recréé ni modifié.
 *
 * `pnpm --filter api db:import-climbs [chemin/vers/climbs.db]`
 */

const MANIFEST_URL =
  'https://snapshots.boardsesh.com/board-snapshots/v1-gzip/manifest.json';

const MIN_ASCENSIONISTS = 20;

// Compte système, créateur de tous les blocs importés. Mot de passe aléatoire
// jamais conservé : personne ne s'y connecte.
const KILTER_USERNAME = 'kilter';
const KILTER_EMAIL = 'kilter@kilterboard.invalid';

// Rôles Kilter (`board_placement_roles`, product 1) vers les nôtres.
const ROLES: Record<number, HoldRole> = {
  12: HoldRole.START,
  13: HoldRole.HAND,
  14: HoldRole.FINISH,
  15: HoldRole.FOOT,
};

// Longueurs des colonnes : quelques noms Kilter les dépassent.
const NAME_MAX = 150;
const SETTER_MAX = 100;

// Blocs écrits par transaction : chacun arrive avec ses prises et ses
// inclinaisons, ou pas du tout.
const BATCH_SIZE = 500;

// Un fichier par (marque, layout) : l'entrée de la Kilter Original.
async function climbsArtifact(): Promise<Artifact> {
  const manifest = await fetchJson(MANIFEST_URL);
  const entries =
    typeof manifest === 'object' &&
    manifest !== null &&
    'entries' in manifest &&
    Array.isArray(manifest.entries)
      ? (manifest.entries as unknown[])
      : null;
  if (!entries) {
    throw new Error('Manifeste des blocs : format inattendu');
  }
  const entry = entries.find(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      'boardType' in e &&
      e.boardType === BOARD_TYPE &&
      'layoutId' in e &&
      e.layoutId === KILTER_LAYOUT_ID,
  );
  if (!isArtifact(entry)) {
    throw new Error('Manifeste des blocs : Kilter Original introuvable');
  }
  return entry;
}

type KilterStat = {
  angle: number;
  difficulty: number;
  ascensionistCount: number;
  qualityAverage: number | null;
  isBenchmark: boolean;
};

type KilterClimb = {
  uuid: string;
  name: string;
  description: string | null;
  setterName: string | null;
  setterAngle: number | null;
  frames: string;
  compatibleSizeIds: number[];
  createdAt: string | null;
  stats: KilterStat[];
};

// `[7,10,16]` -> [7, 10, 16]
function parseIdList(value: string): number[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every(Number.isInteger)) {
    throw new Error(`Snapshot : liste d'ids invalide (${value})`);
  }
  return parsed as number[];
}

/**
 * Lit les blocs candidats et leurs statistiques aux inclinaisons gardées.
 * Le tri fin (prises, cotations) se fait ensuite, bloc par bloc.
 */
function readClimbs(path: string, angles: Set<number>): KilterClimb[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const angleList = [...angles].join(',');
    // Un bloc publié, d'une seule image (frames_count = 1 : les blocs animés
    // n'ont pas d'équivalent chez nous), assez grimpé à une inclinaison gardée.
    const climbs = db
      .prepare(
        `SELECT c.uuid, c.name, c.description, c.setter_username, c.angle,
                c.frames, c.compatible_size_ids, c.created_at
         FROM board_climbs c
         WHERE c.board_type = ? AND c.layout_id = ?
           AND c.is_listed = 1 AND c.is_draft = 0
           AND coalesce(c.is_hidden, 0) = 0 AND c.frames_count = 1
           AND EXISTS (
             SELECT 1 FROM board_climb_stats s
             WHERE s.board_type = c.board_type AND s.climb_uuid = c.uuid
               AND s.angle IN (${angleList})
               AND s.ascensionist_count >= ?)
         ORDER BY c.uuid`,
      )
      .all(BOARD_TYPE, KILTER_LAYOUT_ID, MIN_ASCENSIONISTS)
      .map(
        (row: Row): KilterClimb => ({
          uuid: str(row, 'uuid'),
          name: str(row, 'name'),
          description: optional(str)(row, 'description'),
          setterName: optional(str)(row, 'setter_username'),
          setterAngle: optional(int)(row, 'angle'),
          frames: str(row, 'frames'),
          compatibleSizeIds: parseIdList(str(row, 'compatible_size_ids')),
          createdAt: optional(str)(row, 'created_at'),
          stats: [],
        }),
      );

    const byUuid = new Map(climbs.map((climb) => [climb.uuid, climb]));
    for (const row of db
      .prepare(
        `SELECT climb_uuid, angle, display_difficulty, ascensionist_count,
                quality_average, benchmark_difficulty
         FROM board_climb_stats
         WHERE board_type = ? AND angle IN (${angleList})
           AND display_difficulty IS NOT NULL`,
      )
      .iterate(BOARD_TYPE)) {
      const climb = byUuid.get(str(row, 'climb_uuid'));
      if (!climb) continue;
      climb.stats.push({
        angle: int(row, 'angle'),
        difficulty: num(row, 'display_difficulty'),
        ascensionistCount: int(row, 'ascensionist_count'),
        qualityAverage: optional(num)(row, 'quality_average'),
        isBenchmark: row.benchmark_difficulty !== null,
      });
    }
    return climbs;
  } finally {
    db.close();
  }
}

/**
 * `p1091r15p1131r12` -> [{ placement: 1091, role: 15 }, ...]. `null` si la
 * chaîne n'est pas entièrement faite de ces paires.
 */
function parseFrames(
  frames: string,
): { placement: number; role: number }[] | null {
  if (!/^(p\d+r\d+)+$/.test(frames)) return null;
  return [...frames.matchAll(/p(\d+)r(\d+)/g)].map((match) => ({
    placement: Number(match[1]),
    role: Number(match[2]),
  }));
}

// Cotation Kilter décimale -> rang de notre table, s'il y en a un (4a à 8c+).
function toRank(difficulty: number, ranks: Map<number, number>): number | null {
  const rank = Math.round(difficulty);
  return ranks.has(rank) ? rank : null;
}

type Reference = {
  holdIdByPlacement: Map<number, number>;
  angleIdByDegrees: Map<number, number>;
  gradeIdByRank: Map<number, number>;
  sizeIds: number[];
  layoutId: number;
  creatorId: number;
};

type PreparedBoulder = {
  boulder: Prisma.BoulderCreateManyInput;
  holds: { holdId: number; role: HoldRole }[];
  // Cotation de départ par inclinaison (id de `angles` -> id de `grades`)
  baseGrades: Map<number, number>;
  stats: (KilterStat & { angleId: number })[];
};

type Skip =
  | 'taille incompatible'
  | 'prises illisibles'
  | 'prise ou rôle inconnu'
  | 'prise en double'
  | 'aucune cotation';

/**
 * Un bloc Kilter -> ce qu'on écrit en base, ou la raison de l'écarter.
 * Inclinaison de référence (`boulders.angle_id`) : celle du setter si elle est
 * cotée, sinon la plus grimpée parmi les cotées.
 */
function prepare(climb: KilterClimb, ref: Reference): PreparedBoulder | Skip {
  if (!ref.sizeIds.every((id) => climb.compatibleSizeIds.includes(id))) {
    return 'taille incompatible';
  }

  const frames = parseFrames(climb.frames);
  if (!frames) return 'prises illisibles';
  const holds: PreparedBoulder['holds'] = [];
  for (const { placement, role } of frames) {
    const holdId = ref.holdIdByPlacement.get(placement);
    const holdRole = ROLES[role];
    if (holdId === undefined || !holdRole) return 'prise ou rôle inconnu';
    holds.push({ holdId, role: holdRole });
  }
  // UNIQUE(boulder_id, hold_id) : une prise n'a qu'un rôle par bloc.
  if (new Set(holds.map((h) => h.holdId)).size !== holds.length) {
    return 'prise en double';
  }

  const stats = climb.stats.flatMap((stat) => {
    const angleId = ref.angleIdByDegrees.get(stat.angle);
    return angleId === undefined ? [] : [{ ...stat, angleId }];
  });
  const baseGrades = new Map<number, number>();
  for (const stat of stats) {
    const rank = toRank(stat.difficulty, ref.gradeIdByRank);
    if (rank !== null) {
      baseGrades.set(stat.angleId, ref.gradeIdByRank.get(rank) as number);
    }
  }

  const graded = stats.filter((stat) => baseGrades.has(stat.angleId));
  const reference =
    graded.find((stat) => stat.angle === climb.setterAngle) ??
    [...graded].sort((a, b) => b.ascensionistCount - a.ascensionistCount)[0];
  if (!reference) return 'aucune cotation';

  const createdAt = climb.createdAt ? new Date(climb.createdAt) : null;
  return {
    boulder: {
      kilterUuid: climb.uuid,
      name: climb.name.trim().slice(0, NAME_MAX),
      description: climb.description?.trim() || null,
      setterName: climb.setterName?.slice(0, SETTER_MAX) ?? null,
      gradeId: baseGrades.get(reference.angleId) as number,
      angleId: reference.angleId,
      creatorId: ref.creatorId,
      layoutId: ref.layoutId,
      isPublic: true,
      isDraft: false,
      ...(createdAt && !Number.isNaN(createdAt.getTime()) && { createdAt }),
    },
    holds,
    baseGrades,
    stats,
  };
}

async function loadReference(prisma: PrismaClient): Promise<{
  ref: Reference;
  angleIds: number[];
  angles: Set<number>;
}> {
  const layout = await prisma.boardLayout.findUnique({
    where: { name: KILTER_LAYOUT_NAME },
    select: {
      id: true,
      holds: { select: { id: true, kilterPlacementId: true } },
      sizes: { select: { id: true, kilterSizeId: true } },
    },
  });
  const angles = await prisma.angle.findMany({
    select: { id: true, valueDegrees: true },
  });
  const grades = await prisma.grade.findMany({
    select: { id: true, rank: true },
  });
  if (!layout || layout.sizes.length === 0 || angles.length === 0) {
    throw new Error('Run db:import-catalog then db:seed first');
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const creator = await prisma.user.upsert({
    where: { username: KILTER_USERNAME },
    update: {},
    create: {
      username: KILTER_USERNAME,
      email: KILTER_EMAIL,
      passwordHash,
      bio: 'Boulders imported from the Kilter Board catalog.',
    },
  });

  return {
    ref: {
      holdIdByPlacement: new Map(
        layout.holds.map((hold) => [hold.kilterPlacementId, hold.id]),
      ),
      angleIdByDegrees: new Map(angles.map((a) => [a.valueDegrees, a.id])),
      gradeIdByRank: new Map(grades.map((g) => [g.rank, g.id])),
      sizeIds: layout.sizes.map((size) => size.kilterSizeId),
      layoutId: layout.id,
      creatorId: creator.id,
    },
    angleIds: angles.map((a) => a.id),
    angles: new Set(angles.map((a) => a.valueDegrees)),
  };
}

async function writeBatch(
  prisma: PrismaClient,
  batch: PreparedBoulder[],
  angleIds: number[],
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      // Les blocs déjà importés sont écartés ici, et seulement ici : leurs
      // prises et inclinaisons existent déjà.
      const created = await tx.boulder.createManyAndReturn({
        data: batch.map((b) => b.boulder),
        skipDuplicates: true,
        select: { id: true, kilterUuid: true },
      });
      const idByUuid = new Map(created.map((b) => [b.kilterUuid, b.id]));
      const fresh = batch.flatMap((b) => {
        const id = idByUuid.get(b.boulder.kilterUuid ?? null);
        return id === undefined ? [] : [{ ...b, id }];
      });

      await tx.boulderHold.createMany({
        data: fresh.flatMap((b) =>
          b.holds.map((hold) => ({ boulderId: b.id, ...hold })),
        ),
      });
      // Une ligne par inclinaison de la table, comme pour tout bloc. Pas encore
      // de vote : la cotation effective est la cotation de départ.
      await tx.boulderAngle.createMany({
        data: fresh.flatMap((b) =>
          angleIds.map((angleId) => {
            const base = b.baseGrades.get(angleId) ?? null;
            const stat = b.stats.find((s) => s.angleId === angleId);
            return {
              boulderId: b.id,
              angleId,
              baseGradeId: base,
              gradeId: base,
              // Clé de tri d'Explore, copie des statistiques Kilter.
              kilterAscensionists: stat?.ascensionistCount ?? 0,
            };
          }),
        ),
      });
      await tx.kilterAngleStat.createMany({
        data: fresh.flatMap((b) =>
          b.stats.map((stat) => ({
            boulderId: b.id,
            angleId: stat.angleId,
            difficulty: stat.difficulty,
            ascensionistCount: stat.ascensionistCount,
            qualityAverage: stat.qualityAverage,
            isBenchmark: stat.isBenchmark,
          })),
        ),
      });
      return fresh.length;
    },
    { timeout: 60_000 },
  );
}

async function importClimbs(prisma: PrismaClient, path: string) {
  const { ref, angleIds, angles } = await loadReference(prisma);
  const climbs = readClimbs(path, angles);
  console.log(
    `${climbs.length} climbs with ${MIN_ASCENSIONISTS}+ ascensionists`,
  );

  const prepared: PreparedBoulder[] = [];
  const skipped = new Map<Skip, number>();
  for (const climb of climbs) {
    const result = prepare(climb, ref);
    if (typeof result === 'string') {
      skipped.set(result, (skipped.get(result) ?? 0) + 1);
    } else {
      prepared.push(result);
    }
  }
  for (const [reason, count] of skipped) {
    console.log(`  skipped (${reason}) : ${count}`);
  }

  let created = 0;
  for (let start = 0; start < prepared.length; start += BATCH_SIZE) {
    created += await writeBatch(
      prisma,
      prepared.slice(start, start + BATCH_SIZE),
      angleIds,
    );
  }
  console.log(
    `✅ ${created} boulders created (${prepared.length - created} already imported)`,
  );
}

if (require.main === module) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  withSnapshot(process.argv[2], climbsArtifact, (path) =>
    importClimbs(prisma, path),
  )
    .then(() => console.log('✅ Climbs imported'))
    .catch((error) => {
      console.error('❌ Import échoué :', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
