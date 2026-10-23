// Nom diffusé par la board : `nom[#série][@niveauAPI]`. Format relevé sur une
// vraie board le 2026-10-23 : `Kilter Board#75804@3`. Le niveau d'API suit un
// `@`, et non un second `#` comme le supposait docs/ble-protocol.md.
// Sans niveau, on suppose 3 (le standard actuel).
const BOARD_NAME = /^([^#@]*)(?:#([^@]*))?(?:@(\d+))?$/;

export function parseBoardName(advertisedName: string): {
  name: string;
  serial: string | null;
  apiLevel: 2 | 3;
} {
  const match = BOARD_NAME.exec(advertisedName);
  // Nom hors format : on le garde entier, sans série, au niveau par défaut.
  if (!match) return { name: advertisedName, serial: null, apiLevel: 3 };

  const [, name, serial, level] = match;
  return {
    name,
    serial: serial || null,
    // Seul un `@2` explicite donne le format à 2 octets par prise.
    apiLevel: level === '2' ? 2 : 3,
  };
}
