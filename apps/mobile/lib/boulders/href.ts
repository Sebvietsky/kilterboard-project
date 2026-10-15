/**
 * Lien vers le détail d'un bloc, à une inclinaison donnée.
 *
 * L'écran s'ouvre à l'inclinaison du contexte d'où l'on vient : celle de
 * l'ascension pour un projet ou un passage de session, celle de la carte pour
 * Explore. Sans inclinaison, il prend celle du créateur, valeur par défaut du
 * bloc.
 */
export function boulderHref(boulderId: number, angleDegrees?: number): string {
  return angleDegrees === undefined
    ? `/boulder/${boulderId}`
    : `/boulder/${boulderId}?angle=${angleDegrees}`;
}
