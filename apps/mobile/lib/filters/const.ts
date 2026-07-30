export const ANGLES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 70];

export const GRADES = [
  { rank: 2, label: 'V0' },
  { rank: 3, label: 'V1' },
  { rank: 4, label: 'V2' },
  { rank: 5, label: 'V3' },
  { rank: 6, label: 'V4' },
  { rank: 7, label: 'V5' },
  { rank: 8, label: 'V6' },
  { rank: 9, label: 'V7' },
  { rank: 10, label: 'V8' },
  { rank: 11, label: 'V9' },
  { rank: 12, label: 'V10' },
  { rank: 13, label: 'V11' },
  { rank: 14, label: 'V12' },
  { rank: 15, label: 'V13' },
  { rank: 16, label: 'V14' },
  { rank: 17, label: 'V15' },
  { rank: 18, label: 'V16' },
] as const;

// Bornes dérivées de GRADES, pas écrites en dur : ajouter une cotation en tête
// ou en queue de la liste suffit, les bornes suivent.
export const GRADE_MIN_RANK = GRADES[0].rank;
export const GRADE_MAX_RANK = GRADES[GRADES.length - 1].rank;

// Tags "style" (slugs du seed). En dur pour l'instant, comme ANGLES.
export const TAGS = [
  { slug: 'crimp', label: 'Crimp' },
  { slug: 'sloper', label: 'Sloper' },
  { slug: 'dyno', label: 'Dyno' },
  { slug: 'compression', label: 'Compression' },
  { slug: 'coordination', label: 'Coordination' },
  { slug: 'power', label: 'Power' },
  { slug: 'technical', label: 'Technical' },
] as const;

const GRADE_LABEL_BY_RANK = new Map<number, string>(
  GRADES.map((g) => [g.rank, g.label]),
);
const TAG_LABEL_BY_SLUG = new Map<string, string>(
  TAGS.map((t) => [t.slug, t.label]),
);

// Libellés partagés entre l'écran de filtres et le récap de filtres actifs.
// Repli sur la valeur brute plutôt que sur un calcul (`V${rank - 2}`) : un
// calcul se désynchroniserait silencieusement de GRADES.
export const gradeLabel = (rank: number): string =>
  GRADE_LABEL_BY_RANK.get(rank) ?? String(rank);

export const tagLabel = (slug: string): string =>
  TAG_LABEL_BY_SLUG.get(slug) ?? slug;
