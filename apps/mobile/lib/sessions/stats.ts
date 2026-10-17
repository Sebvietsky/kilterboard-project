import type { SessionEntry } from './types';

type Grade = NonNullable<SessionEntry['ascent']['boulderAngle']['grade']>;

export type SessionStats = {
  climbs: number;
  // Cotation la plus dure ENVOYÉE : un projet qui résiste encore n'est pas un
  // « hardest ». `null` tant qu'aucun bloc n'est tombé dans la session.
  hardest: string | null;
  flashes: number;
  projectsSent: number;
};

// Dérivé de la liste des passages, pas renvoyé par le serveur : l'écran les a
// déjà tous en main, et un total calculé à part pourrait contredire la liste
// affichée juste en dessous.
export function deriveSessionStats(entries: SessionEntry[]): SessionStats {
  const sends = entries.filter((entry) => entry.status !== 'PROJECT');
  // Cotation à l'inclinaison du passage. Le premier envoi d'un grimpeur y
  // vote, la ligne est donc presque toujours cotée ; un ancien envoi sans
  // grade ressenti peut toutefois la laisser à null, et il est alors ignoré.
  const hardest = sends
    .map((entry) => entry.ascent.boulderAngle.grade)
    .reduce<Grade | null>(
      (best, grade) =>
        grade && (!best || grade.rank > best.rank) ? grade : best,
      null,
    );

  return {
    climbs: entries.length,
    hardest: hardest?.vScale ?? null,
    flashes: entries.filter((entry) => entry.status === 'FLASH').length,
    // Un projet n'a qu'un seul passage SENT : celui de sa complétion.
    projectsSent: sends.filter(
      (entry) => entry.status === 'SENT' && entry.ascent.wasProject,
    ).length,
  };
}
