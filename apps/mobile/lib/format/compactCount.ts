// « 850 », « 1.2k », « 104k » : un compteur lisible d'un coup d'œil sur une
// carte. Arrondi vers le bas, pour ne jamais annoncer plus que la réalité.
// En dur plutôt qu'Intl.NumberFormat (notation compacte) : Hermes ne la
// garantit pas sur toutes les versions d'iOS.
export function compactCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10_000) {
    return `${Math.floor(count / 100) / 10}k`;
  }
  return `${Math.floor(count / 1000)}k`;
}
