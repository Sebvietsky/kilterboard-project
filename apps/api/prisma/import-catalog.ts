import { PrismaPg } from '@prisma/adapter-pg';
import { HoldSet, PrismaClient } from '../src/generated/prisma/client';
import { DatabaseSync } from 'node:sqlite';
import 'dotenv/config';
import {
  BOARD_TYPE,
  KILTER_LAYOUT_ID,
  KILTER_LAYOUT_NAME,
  fetchJson,
  int,
  isArtifact,
  str,
  withSnapshot,
  type Artifact,
} from './kilter-snapshot';

/**
 * Importe le matériel Kilter (layout, tailles, prises, LED) depuis le catalogue
 * public de boardsesh (`docs/notes/kilter-data.md`).
 *
 * Le catalogue n'est pas commité (droits Kilter) : le script le télécharge par
 * le manifeste, ou lit un fichier déjà téléchargé passé en argument. À lancer
 * avant `db:seed`, dont les blocs désignent des prises du catalogue.
 *
 * Idempotent : relancer ajoute ce qui manque et ne modifie pas l'existant.
 *
 * `pnpm --filter api db:import-catalog [chemin/vers/catalog.db]`
 */

const MANIFEST_URL =
  'https://snapshots.boardsesh.com/board-snapshots/v1-catalog/manifest.json';

// Tailles importées : 12 x 12 with kickboard, la board de Seb (2026-10-23).
// Une autre taille s'ajoute ici : ses LED s'importent, les prises sont communes.
const KILTER_SIZE_IDS = [10];

// Sets Kilter (`board_sets`) vers notre enum.
const HOLD_SETS: Record<number, HoldSet> = {
  1: HoldSet.BOLT_ONS,
  20: HoldSet.SCREW_ONS,
};

// Un seul fichier pour toutes les boards : `artifact` dans le manifeste.
async function catalogArtifact(): Promise<Artifact> {
  const manifest = await fetchJson(MANIFEST_URL);
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('artifact' in manifest) ||
    !isArtifact(manifest.artifact)
  ) {
    throw new Error('Manifeste du catalogue : format inattendu');
  }
  return manifest.artifact;
}

type Placement = {
  kilterPlacementId: number;
  holeId: number;
  holdCode: string;
  set: HoldSet;
  x: number;
  y: number;
};

type Size = {
  kilterSizeId: number;
  name: string;
  edgeLeft: number;
  edgeRight: number;
  edgeBottom: number;
  edgeTop: number;
  // Position LED par trou Kilter
  leds: Map<number, number>;
};

function readCatalog(path: string): { placements: Placement[]; sizes: Size[] } {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const placements = db
      .prepare(
        `SELECT p.id AS placement_id, p.set_id, h.id AS hole_id, h.name, h.x, h.y
         FROM board_placements p
         JOIN board_holes h ON h.board_type = p.board_type AND h.id = p.hole_id
         WHERE p.board_type = ? AND p.layout_id = ?
         ORDER BY p.id`,
      )
      .all(BOARD_TYPE, KILTER_LAYOUT_ID)
      .map((row): Placement => {
        const setId = int(row, 'set_id');
        const set = HOLD_SETS[setId];
        if (!set) {
          throw new Error(`Catalogue : set ${setId} inconnu`);
        }
        return {
          kilterPlacementId: int(row, 'placement_id'),
          holeId: int(row, 'hole_id'),
          holdCode: str(row, 'name'),
          set,
          x: int(row, 'x'),
          y: int(row, 'y'),
        };
      });

    // Une LED désigne un trou, une prise du bloc un placement : la
    // correspondance n'est sûre que si chaque trou porte un seul placement.
    const holeIds = new Set(placements.map((p) => p.holeId));
    if (holeIds.size !== placements.length) {
      throw new Error('Catalogue : un trou porte plusieurs placements');
    }

    const sizes = KILTER_SIZE_IDS.map((sizeId): Size => {
      const row = db
        .prepare(
          `SELECT id, name, edge_left, edge_right, edge_bottom, edge_top
           FROM board_product_sizes WHERE board_type = ? AND id = ?`,
        )
        .get(BOARD_TYPE, sizeId);
      if (!row) {
        throw new Error(`Catalogue : taille ${sizeId} absente`);
      }

      const leds = new Map<number, number>();
      for (const led of db
        .prepare(
          `SELECT hole_id, position FROM board_leds
           WHERE board_type = ? AND product_size_id = ?`,
        )
        .all(BOARD_TYPE, sizeId)) {
        const holeId = int(led, 'hole_id');
        if (!holeIds.has(holeId)) {
          throw new Error(
            `Catalogue : la LED du trou ${holeId} (taille ${sizeId}) n'a pas de placement`,
          );
        }
        leds.set(holeId, int(led, 'position'));
      }

      return {
        kilterSizeId: sizeId,
        name: str(row, 'name'),
        edgeLeft: int(row, 'edge_left'),
        edgeRight: int(row, 'edge_right'),
        edgeBottom: int(row, 'edge_bottom'),
        edgeTop: int(row, 'edge_top'),
        leds,
      };
    });

    return { placements, sizes };
  } finally {
    db.close();
  }
}

async function importCatalog(
  prisma: PrismaClient,
  catalog: { placements: Placement[]; sizes: Size[] },
): Promise<void> {
  const layout = await prisma.boardLayout.upsert({
    where: { name: KILTER_LAYOUT_NAME },
    update: {},
    create: { name: KILTER_LAYOUT_NAME, manufacturer: 'Kilter' },
  });

  const holds = await prisma.hold.createMany({
    data: catalog.placements.map((p) => ({
      layoutId: layout.id,
      kilterPlacementId: p.kilterPlacementId,
      holdCode: p.holdCode,
      set: p.set,
      x: p.x,
      y: p.y,
    })),
    skipDuplicates: true,
  });
  console.log(
    `✅ ${holds.count} holds created (${catalog.placements.length} in catalog)`,
  );

  // Trou Kilter -> notre id de prise, pour rattacher les LED.
  const holdIdByPlacement = new Map(
    (
      await prisma.hold.findMany({
        where: { layoutId: layout.id },
        select: { id: true, kilterPlacementId: true },
      })
    ).map((hold) => [hold.kilterPlacementId, hold.id]),
  );
  const holdIdByHole = new Map<number, number>();
  for (const p of catalog.placements) {
    const holdId = holdIdByPlacement.get(p.kilterPlacementId);
    // skipDuplicates a pu écarter un placement dont le nom de trou existait
    // déjà sous un autre id : la base ne correspond plus au catalogue.
    if (holdId === undefined) {
      throw new Error(
        `Placement ${p.kilterPlacementId} (${p.holdCode}) absent de la base`,
      );
    }
    holdIdByHole.set(p.holeId, holdId);
  }

  for (const { leds, ...sizeData } of catalog.sizes) {
    const size = await prisma.boardSize.upsert({
      where: {
        layoutId_kilterSizeId: {
          layoutId: layout.id,
          kilterSizeId: sizeData.kilterSizeId,
        },
      },
      update: {},
      create: { ...sizeData, layoutId: layout.id },
    });

    const created = await prisma.holdLed.createMany({
      // readCatalog garantit que chaque trou à LED porte un placement.
      data: [...leds].map(([holeId, position]) => ({
        holdId: holdIdByHole.get(holeId) as number,
        sizeId: size.id,
        position,
      })),
      skipDuplicates: true,
    });
    console.log(
      `✅ ${size.name} : ${created.count} LEDs created (${leds.size} in catalog)`,
    );
  }
}

async function main(prisma: PrismaClient, path: string | undefined) {
  await withSnapshot(path, catalogArtifact, (catalogPath) =>
    importCatalog(prisma, readCatalog(catalogPath)),
  );
}

if (require.main === module) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  main(prisma, process.argv[2])
    .then(() => console.log('✅ Catalog imported'))
    .catch((error) => {
      console.error('❌ Import échoué :', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
