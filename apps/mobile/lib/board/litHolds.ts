import type { BoardSize } from '@/lib/boardSizes/types';
import type { Hold, HoldRole } from '@/lib/boulders/types';
import type { LedRole, LitHold } from './protocol';

// Rôle d'une prise du bloc (API) -> rôle LED du protocole. Map explicite :
// les noms diffèrent (HAND / hand), pas de toLowerCase.
const LED_ROLE: Record<HoldRole, LedRole> = {
  START: 'start',
  HAND: 'hand',
  FOOT: 'foot',
  FINISH: 'finish',
};

// Prises d'un bloc à allumer sur une taille de board : la LED de chacune dans
// cette taille, par son nom de trou (unique sur le layout). Fonction pure,
// partagée avec la future création de bloc.
// `missing` : prises du bloc hors du cadre de cette taille, donc sans LED.
export function litHolds(
  holds: Hold[],
  size: BoardSize,
): { lit: LitHold[]; missing: string[] } {
  const positionByCode = new Map(
    size.holds.map((hold) => [hold.holdCode, hold.ledPosition]),
  );
  const lit: LitHold[] = [];
  const missing: string[] = [];
  for (const hold of holds) {
    const position = positionByCode.get(hold.holdCode);
    if (position === undefined) {
      missing.push(hold.holdCode);
    } else {
      lit.push({ position, role: LED_ROLE[hold.role] });
    }
  }
  return { lit, missing };
}
