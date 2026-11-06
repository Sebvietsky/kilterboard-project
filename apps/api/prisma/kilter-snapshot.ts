import { type SQLOutputValue } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/**
 * Outils communs aux imports depuis les snapshots publics de boardsesh
 * (`docs/notes/kilter-data.md`) : téléchargement par le manifeste et lecture
 * typée des lignes SQLite. Utilisés par `import-catalog.ts` (matériel) et
 * `import-climbs.ts` (blocs).
 */

// Les ids se répètent d'une marque à l'autre : toujours filtrer sur la marque.
export const BOARD_TYPE = 'kilter';

// Kilter Board Original (product 1, layout 1).
export const KILTER_LAYOUT_ID = 1;
export const KILTER_LAYOUT_NAME = 'Kilter Board Original';

export type Row = Record<string, SQLOutputValue>;

// Les lignes SQLite ne sont pas typées : chaque champ est vérifié à la lecture,
// un snapshot dont le format a changé échoue ici plutôt qu'en base.
export function int(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Snapshot : ${key} n'est pas un entier (${String(value)})`);
  }
  return value;
}

export function num(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== 'number') {
    throw new Error(`Snapshot : ${key} n'est pas un nombre (${String(value)})`);
  }
  return value;
}

export function str(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new Error(`Snapshot : ${key} n'est pas un texte (${String(value)})`);
  }
  return value;
}

// Champs facultatifs : `null` en base reste `null`, un autre type échoue.
export function optional<T>(
  read: (row: Row, key: string) => T,
): (row: Row, key: string) => T | null {
  return (row, key) => (row[key] === null ? null : read(row, key));
}

// Ce que le manifeste dit d'un fichier : où le prendre, et sa taille une fois
// décompressé, qui sert de contrôle.
export type Artifact = { url: string; uncompressedBytes: number };

export function isArtifact(value: unknown): value is Artifact {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof value.url === 'string' &&
    'uncompressedBytes' in value &&
    typeof value.uncompressedBytes === 'number'
  );
}

export async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} : HTTP ${response.status}`);
  }
  return response.json();
}

async function download(artifact: Artifact, path: string): Promise<void> {
  console.log(`Downloading ${artifact.url}...`);
  const response = await fetch(artifact.url);
  if (!response.ok) {
    throw new Error(`Snapshot : HTTP ${response.status}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  // Gzip selon le manifeste ; fetch le décompresse déjà si le serveur annonce
  // l'encodage. On regarde donc les octets magiques plutôt que l'en-tête.
  const isGzip = body[0] === 0x1f && body[1] === 0x8b;
  const bytes = isGzip ? gunzipSync(body) : body;
  if (bytes.length !== artifact.uncompressedBytes) {
    throw new Error(
      `Snapshot : ${bytes.length} octets, ${artifact.uncompressedBytes} attendus`,
    );
  }
  writeFileSync(path, bytes);
}

/**
 * Donne à `use` le chemin d'un snapshot : celui passé en argument, ou un
 * fichier téléchargé dans un dossier temporaire neuf, supprimé à la fin.
 * Jamais d'URL d'artefact en dur : `resolve` la lit dans le manifeste, les
 * artefacts étant horodatés et supprimés après 14 jours.
 */
export async function withSnapshot<T>(
  path: string | undefined,
  resolve: () => Promise<Artifact>,
  use: (path: string) => Promise<T>,
): Promise<T> {
  if (path) {
    return use(path);
  }
  const dir = mkdtempSync(join(tmpdir(), 'kilter-snapshot-'));
  try {
    const downloaded = join(dir, 'snapshot.db');
    await download(await resolve(), downloaded);
    return await use(downloaded);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
