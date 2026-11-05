// Mêmes valeurs que la table `angles` (prisma/seed.ts) : la Kilter se règle
// par pas de 5°. Une valeur absente ici ou là-bas donne un 400 au log.
export const ANGLES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];

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

const TAG_LABEL_BY_SLUG = new Map<string, string>(
  TAGS.map((t) => [t.slug, t.label]),
);

// Les cotations vivent dans `lib/grades/scale.ts` : leur libellé dépend de
// l'échelle de l'utilisateur.

export const tagLabel = (slug: string): string =>
  TAG_LABEL_BY_SLUG.get(slug) ?? slug;
