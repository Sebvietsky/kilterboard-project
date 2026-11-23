import type { HoldRole } from '../boulders/types';
import type { BoardSize } from '../boardSizes/types';
import type { DraftHold } from './types';

// Même valeur que `MAX_HOLDS_PER_BOULDER` dans
// `apps/api/src/boulders/dto/create-boulder.dto.ts` (décision du 2026-11-23) :
// l'API refuse au-delà, l'écran bloque avant d'envoyer.
export const MAX_HOLDS_PER_BOULDER = 45;

// Prises d'un brouillon en cours d'édition : id de la prise -> rôle. Une Map
// et non le tableau du DTO : une prise n'a qu'un rôle par bloc, la clé le
// garantit, et un tap lit ou change le rôle d'une prise sans parcourir la
// liste.
export type DraftHolds = ReadonlyMap<number, HoldRole>;

// Ordre des rôles au tap, celui de l'app Kilter. Après FOOT, la prise est
// retirée.
const ROLE_CYCLE: readonly HoldRole[] = ['START', 'HAND', 'FINISH', 'FOOT'];

export type CycleResult =
  | { kind: 'changed'; holds: DraftHolds }
  | { kind: 'limit' };

/**
 * Un tap sur une prise : la pose en START, puis passe au rôle suivant, puis la
 * retire. Une nouvelle Map à chaque fois (état React immuable). Poser une
 * prise de plus que la limite est refusé ; changer le rôle d'une prise déjà
 * posée ou la retirer reste toujours possible.
 */
export function cycleHold(holds: DraftHolds, holdId: number): CycleResult {
  const current = holds.get(holdId);
  const next = new Map(holds);

  if (current === undefined) {
    if (holds.size >= MAX_HOLDS_PER_BOULDER) return { kind: 'limit' };
    next.set(holdId, ROLE_CYCLE[0]);
    return { kind: 'changed', holds: next };
  }

  const index = ROLE_CYCLE.indexOf(current);
  if (index === ROLE_CYCLE.length - 1) {
    next.delete(holdId);
  } else {
    next.set(holdId, ROLE_CYCLE[index + 1]);
  }
  return { kind: 'changed', holds: next };
}

// Au plus 2 prises de départ et 2 de fin par bloc (Seb, 2026-11-23). Vérifié
// à l'enregistrement et non au tap : poser une 3e prise de départ avant d'en
// changer une autre doit rester possible pendant la saisie.
export const MAX_END_HOLDS = 2;

export function endRolesOverLimit(holds: DraftHolds): HoldRole[] {
  const counts = new Map<HoldRole, number>();
  for (const role of holds.values()) {
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }
  return (['START', 'FINISH'] as const).filter(
    (role) => (counts.get(role) ?? 0) > MAX_END_HOLDS,
  );
}

// Règle de la publication côté API : au moins un START et un FINISH.
export function canPublish(holds: DraftHolds): boolean {
  const roles = new Set(holds.values());
  return roles.has('START') && roles.has('FINISH');
}

export function toDraftHolds(holds: readonly DraftHold[]): DraftHolds {
  return new Map(holds.map((h) => [h.holdId, h.role]));
}

// Forme du DTO. Triée par id : deux états égaux donnent le même tableau, ce
// qui permet de comparer un état à celui enregistré.
export function toHoldsInput(holds: DraftHolds): DraftHold[] {
  return [...holds]
    .map(([holdId, role]) => ({ holdId, role }))
    .sort((a, b) => a.holdId - b.holdId);
}

// Au-delà de cette distance (unités Kilter), un tap ne désigne aucune prise.
// Deux prises voisines sont à environ 5,6 unités : la moitié laisse à chaque
// prise sa zone, sans qu'un tap entre deux en attrape une au hasard.
const TAP_RADIUS = 4;

/**
 * La prise la plus proche d'un tap, ou `undefined`. Le tap arrive en pixels
 * dans le dessin de la board (`width` x `height`) ; il est ramené en
 * coordonnées Kilter (y vers le haut), comme `toPosition` de `BoardLED` dans
 * l'autre sens.
 */
export function holdAtPoint(
  size: BoardSize,
  point: { x: number; y: number },
  layout: { width: number; height: number },
): number | undefined {
  const x =
    size.edgeLeft + (point.x / layout.width) * (size.edgeRight - size.edgeLeft);
  const y =
    size.edgeTop - (point.y / layout.height) * (size.edgeTop - size.edgeBottom);

  let nearest: number | undefined;
  let nearestDistance = TAP_RADIUS;
  for (const hold of size.holds) {
    const distance = Math.hypot(hold.x - x, hold.y - y);
    if (distance <= nearestDistance) {
      nearest = hold.id;
      nearestDistance = distance;
    }
  }
  return nearest;
}
