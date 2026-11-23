import type { DiscoveredBoard } from './types';

// Ajoute une board vue au scan à la liste. Déjà connue (même série), elle ne
// crée pas de seconde ligne : son nouvel identifiant BLE rejoint les siens, à
// la suite. Liste inchangée (même référence) si rien n'est nouveau, pour ne
// pas relancer le rendu à chaque annonce.
export function mergeBoard(
  boards: DiscoveredBoard[],
  found: DiscoveredBoard,
): DiscoveredBoard[] {
  const known = boards.find((board) => board.key === found.key);
  if (!known) return [...boards, found];

  const newIds = found.deviceIds.filter((id) => !known.deviceIds.includes(id));
  if (newIds.length === 0) return boards;

  return boards.map((board) =>
    board === known
      ? { ...board, deviceIds: [...board.deviceIds, ...newIds] }
      : board,
  );
}
