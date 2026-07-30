// Date relative sans dépendance : Intl.RelativeTimeFormat est natif.
// Ajouter date-fns ou dayjs pour cette seule fonction coûterait plus en poids
// de bundle que le helper entier.

type Division = { amount: number; unit: Intl.RelativeTimeFormatUnit };

// Chaque palier convertit le delta dans l'unité suivante tant qu'il la dépasse.
const DIVISIONS: Division[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' }, // semaines par mois moyen
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

// Repli si Intl.RelativeTimeFormat manque : sur React Native, la présence
// d'Intl dépend de ce qu'embarque le moteur JS. Plutôt qu'un crash à
// l'affichage d'un commentaire, on rend une forme abrégée équivalente.
const NARROW_UNIT: Record<Intl.RelativeTimeFormatUnit, string> = {
  second: 's',
  seconds: 's',
  minute: 'm',
  minutes: 'm',
  hour: 'h',
  hours: 'h',
  day: 'd',
  days: 'd',
  week: 'w',
  weeks: 'w',
  month: 'mo',
  months: 'mo',
  quarter: 'q',
  quarters: 'q',
  year: 'y',
  years: 'y',
};

// Construit une seule fois : instancier un formateur Intl est coûteux, et
// cette fonction est appelée une fois par commentaire à chaque rendu.
const formatter = (() => {
  try {
    // 'always' et non 'auto' : on veut « 1d ago », pas « yesterday ».
    return new Intl.RelativeTimeFormat('en', {
      numeric: 'always',
      style: 'narrow',
    });
  } catch {
    return null;
  }
})();

function format(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  if (formatter) return formatter.format(value, unit);
  const suffix = NARROW_UNIT[unit];
  return value < 0 ? `${Math.abs(value)}${suffix} ago` : `in ${value}${suffix}`;
}

/**
 * « 2d ago », « 5mo ago ». `iso` est la date sérialisée renvoyée par l'API.
 * Renvoie une chaîne vide sur une date invalide — un commentaire sans date
 * lisible reste préférable à un « Invalid Date » affiché à l'utilisateur.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return '';

  // Négatif = passé, ce qu'attend RelativeTimeFormat.
  let delta = (timestamp - now.getTime()) / 1000;

  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(delta) < amount) return format(Math.round(delta), unit);
    delta /= amount;
  }
  return format(Math.round(delta), 'year');
}
