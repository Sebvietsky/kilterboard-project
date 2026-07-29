// constants/theme.ts

// Palette brute : les couleurs "physiques" de la marque.
// Ne pas consommer directement dans les composants pour un rôle — passer par
// les tokens sémantiques (colors) qui donnent l'intention au point d'usage.
const palette = {
  mist: '#F4F8FF',
  white: '#FFFFFF',
  cloud: '#EEF0F3',
  ink: '#141E36',
  slate: '#5B6470',
  fog: '#9099A3',
  blue: '#2E66E5',
  blueDark: '#2455C4',
  blueSoft: '#E6EEFF',
  line: '#E4E9F2',
  lineStrong: '#C9D6F2',
  sky: '#9DB8FF', // accents fond sombre, progression, holds hands
  gold: '#FFD166', // flash, records, session active, holds finish
  moss: '#2EBD85', // ascent, board connecté, holds start
  coral: '#FF6B57', // project, likes, destructif, holds feet
  // Déclinaisons (badges, overlays, dots) — uniquement référencées par les tokens
  goldSoft: '#FFF0CC',
  goldInk: '#553D00',
  mossSoft: '#D9F3E7',
  mossInk: '#177350',
  coralSoft: '#FFF1EE',
  coralLine: '#FF9A83',
  coralInk: '#C2452F',
  skyDots: 'rgba(157, 184, 255, 0.22)',
  inkOverlay: 'rgba(20, 30, 54, 0.5)',
} as const;

// Tokens sémantiques : ce que le code applicatif consomme.
// Chaque clé décrit un RÔLE ; sa valeur pointe vers la palette. Changer la
// couleur d'un rôle = une seule ligne ici, sans toucher aux composants.
export const colors = {
  // Surfaces (modèle Beta : fond mist, cartes blanches par-dessus)
  background: palette.mist,
  surface: palette.white,
  surfaceMuted: palette.cloud, // chips/inputs
  // Texte
  text: palette.ink,
  textMuted: palette.slate,
  textSubtle: palette.fog,
  // Primaire
  primary: palette.blue,
  primaryPressed: palette.blueDark,
  primaryMuted: palette.blueSoft, // pastille cotation / chip sélectionné
  // Bordures (liées aux tiers de bouton)
  border: palette.line, // tertiaire
  borderStrong: palette.lineStrong, // secondaire
  // Rôles forts / statuts
  ink: palette.ink, // surfaces sombres (carte board LED)
  blue: palette.blue,
  sky: palette.sky,
  gold: palette.gold,
  moss: palette.moss,
  coral: palette.coral,
  // Rôles sémantiques d'état (mappés sur la palette forte)
  danger: palette.coral, // erreurs, actions destructives
  success: palette.moss, // confirmations, ascension validée
  warning: palette.gold, // alertes, records, flash
  info: palette.sky, // informations, progression
  // Overlays
  overlay: palette.inkOverlay,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  card: 16, // Beta cartes standard
  xl: 20, // grosses cartes
  full: 9999, // pill
} as const;

export const typography = {
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, display: 34 },
  // ⚠️ fontWeight n'a AUCUN effet sur une police custom en React Native :
  // la graisse se choisit via fontFamily (nom de la variante ci-dessous).
  // weight ne sert que pour la police système (fallback, splash natif…).
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.2, normal: 1.4, relaxed: 1.6 },
  // Familles par RÔLE (les clés = noms enregistrés par useFonts dans _layout).
  // Ne jamais combiner family.* avec weight.* — une variante = une graisse.
  family: {
    display: 'BricolageGrotesque_800ExtraBold', // gros titres, wordmark
    heading: 'BricolageGrotesque_700Bold', // titres de section, noms de blocs, cotations
    body: 'Figtree_400Regular',
    bodyMedium: 'Figtree_500Medium',
    bodySemibold: 'Figtree_600SemiBold',
    bodyBold: 'Figtree_700Bold',
    data: 'SpaceGrotesk_600SemiBold', // données chiffrées : timer, stats, angles, compteurs
    dataBold: 'SpaceGrotesk_700Bold',
  },
  // La DA demande -0.02em sur les gros titres. RN n'a pas d'unité em :
  // letterSpacing est en points absolus → appliquer proportionnellement,
  // ex. letterSpacing: size.display * letterSpacing.tight
  letterSpacing: { tight: -0.02 },
} as const;

export const shadows = {
  card: {
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2, // Android
  },
} as const;

// Un statut d'ascension = couleur forte + recette de badge.
// softBg : aplat pâle de poids homogène entre les trois statuts, pour les
// surfaces plus larges qu'un badge (segment sélectionné). Contraste vérifié
// avec badgeText — flash 9,0:1 · ascent 5,0:1 · project 4,6:1 (AA ≥ 4,5:1).
export const status = {
  flash: {
    color: colors.gold,
    badgeBg: palette.gold,
    badgeText: palette.goldInk,
    softBg: palette.goldSoft,
  },
  ascent: {
    color: colors.moss,
    badgeBg: palette.mossSoft,
    badgeText: palette.mossInk,
    softBg: palette.mossSoft,
  },
  project: {
    color: colors.coral,
    badgeBorder: palette.coralLine,
    badgeText: palette.coralInk,
    softBg: palette.coralSoft,
  }, // badge : fond transparent, bordure dashed
} as const;

// Prises sur la carte board LED
export const holds = {
  start: colors.moss,
  hands: colors.sky,
  finish: colors.gold,
  feet: colors.coral,
} as const;

export const boardDots = palette.skyDots;

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  status,
  holds,
  boardDots,
} as const;
export type Theme = typeof theme;
