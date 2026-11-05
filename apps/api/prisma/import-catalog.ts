import { PrismaPg } from '@prisma/adapter-pg';
import { HoldSet, PrismaClient } from '../src/generated/prisma/client';
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import 'dotenv/config';

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

// Les ids se répètent d'une marque à l'autre : toujours filtrer sur la marque.
const BOARD_TYPE = 'kilter';

// Kilter Board Original (product 1, layout 1).
const KILTER_LAYOUT_ID = 1;
export const KILTER_LAYOUT_NAME = 'Kilter Board Original';

// Tailles importées : 12 x 12 with kickboard, la board de Seb (2026-10-23).
// Une autre taille s'ajoute ici : ses LED s'importent, les prises sont communes.
const KILTER_SIZE_IDS = [10];

// Sets Kilter (`board_sets`) vers notre enum.
const HOLD_SETS: Record<number, HoldSet> = {
  1: HoldSet.BOLT_ONS,
  20: HoldSet.SCREW_ONS,
};

type Row = Record<string, SQLOutputValue>;

// Les lignes SQLite ne sont pas typées : chaque champ est vérifié à la lecture,
// un catalogue dont le format a changé échoue ici plutôt qu'en base.
function int(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(
      `Catalogue : ${key} n'est pas un entier (${String(value)})`,
    );
  }
  return value;
}

function str(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new Error(`Catalogue : ${key} n'est pas un texte (${String(value)})`);
  }
  return value;
}

type Manifest = {
  artifact: { url: string; bytes: number; uncompressedBytes: number };
};

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== 'object' || value === null || !('artifact' in value)) {
    return false;
  }
  const { artifact } = value;
  return (
    typeof artifact === 'object' &&
    artifact !== null &&
    'url' in artifact &&
    typeof artifact.url === 'string' &&
    'uncompressedBytes' in artifact &&
    typeof artifact.uncompressedBytes === 'number'
  );
}

/**
 * Télécharge le catalogue dans un dossier temporaire neuf. Jamais d'URL
 * d'artefact en dur : les artefacts sont horodatés et supprimés après 14 jours.
 */
async function downloadCatalog(dir: string): Promise<string> {
  const manifestResponse = await fetch(MANIFEST_URL);
  if (!manifestResponse.ok) {
    throw new Error(`Manifeste : HTTP ${manifestResponse.status}`);
  }
  const manifest: unknown = await manifestResponse.json();
  if (!isManifest(manifest)) {
    throw new Error('Manifeste : format inattendu');
  }

  const { url, uncompressedBytes } = manifest.artifact;
  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalogue : HTTP ${response.status}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  // Gzip selon le manifeste ; fetch le décompresse déjà si le serveur annonce
  // l'encodage. On regarde donc les octets magiques plutôt que l'en-tête.
  const isGzip = body[0] === 0x1f && body[1] === 0x8b;
  const bytes = isGzip ? gunzipSync(body) : body;
  if (bytes.length !== uncompressedBytes) {
    throw new Error(
      `Catalogue : ${bytes.length} octets, ${uncompressedBytes} attendus`,
    );
  }

  const path = join(dir, 'catalog.db');
  writeFileSync(path, bytes);
  return path;
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
  if (path) {
    return importCatalog(prisma, readCatalog(path));
  }
  // Un dossier neuf pour le téléchargement, supprimé à la fin : 190 Mo.
  const dir = mkdtempSync(join(tmpdir(), 'kilter-catalog-'));
  try {
    await importCatalog(prisma, readCatalog(await downloadCatalog(dir)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
