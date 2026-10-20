// Nom diffusé par la board : `nom[#série][#niveauAPI]` (docs/ble-protocol.md,
// section 1). Sans niveau, on suppose 3.
// À VÉRIFIER sur une vraie board : avec un seul `#`, le segment peut être la
// série ou le niveau. On le lit comme un niveau s'il vaut 2 ou 3.
export function parseBoardName(advertisedName: string): {
  name: string;
  serial: string | null;
  apiLevel: 2 | 3;
} {
  const [name, ...segments] = advertisedName.split('#');
  const last = segments.at(-1);
  const hasApiLevel = last === '2' || last === '3';
  const serialSegments = hasApiLevel ? segments.slice(0, -1) : segments;

  return {
    name,
    serial: serialSegments[0] || null,
    apiLevel: last === '2' ? 2 : 3,
  };
}
