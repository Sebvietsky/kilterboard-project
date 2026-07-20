// constants/theme.ts

// Palette brute : les couleurs "physiques" de la marque.
// Ne pas consommer directement dans les composants pour un rôle — passer par
// les tokens sémantiques (colors) qui donnent l'intention au point d'usage.
const palette = {
  mist: "#F4F8FF",
  white: "#FFFFFF",
  cloud: "#EEF0F3",
  ink: "#141E36",
  slate: "#5B6470",
  fog: "#9099A3",
  blue: "#2E66E5",
  blueDark: "#2455C4",
  blueSoft: "#E6EEFF",
  line: "#E4E9F2",
  lineStrong: "#C9D6F2",
  sky: "#9DB8FF",   // accents fond sombre, progression, holds hands
  gold: "#FFD166",  // flash, records, session active, holds finish
  moss: "#2EBD85",  // ascent, board connecté, holds start
  coral: "#FF6B57", // project, likes, destructif, holds feet
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
  border: palette.line,       // tertiaire
  borderStrong: palette.lineStrong, // secondaire
  // Rôles forts / statuts
  ink: palette.ink,   // surfaces sombres (carte board LED)
  blue: palette.blue,
  sky: palette.sky,
  gold: palette.gold,
  moss: palette.moss,
  coral: palette.coral,
  // Rôles sémantiques d'état (mappés sur la palette forte)
  danger: palette.coral,   // erreurs, actions destructives
  success: palette.moss,   // confirmations, ascension validée
  warning: palette.gold,   // alertes, records, flash
  info: palette.sky,       // informations, progression
  // Overlays
  overlay: "rgba(20, 30, 54, 0.5)",
} as const;

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
} as const;

export const radii = {
  sm: 6, md: 10, lg: 14,
  card: 16, // Beta cartes standard
  xl: 20,   // grosses cartes
  full: 9999, // pill
} as const;

export const typography = {
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, display: 34 },
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
  lineHeight: { tight: 1.2, normal: 1.4, relaxed: 1.6 },
  // family: {...} → ajouté à l'étape 3, une fois les fonts chargées
} as const;

export const shadows = {
  card: {
    shadowColor: "#141E36", // ink teinté
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2, // Android
  },
} as const;

// Un statut d'ascension = couleur forte + recette de badge
export const status = {
  flash:   { color: colors.gold,  badgeBg: "#FFD166", badgeText: "#553D00" },
  ascent:  { color: colors.moss,  badgeBg: "#D9F3E7", badgeText: "#177350" },
  project: { color: colors.coral, badgeBorder: "#FF9A83", badgeText: "#C2452F" }, // fond transparent, bordure dashed
} as const;

// Prises sur la carte board LED
export const holds = {
  start: colors.moss, hands: colors.sky, finish: colors.gold, feet: colors.coral,
} as const;

export const boardDots = "rgba(157,184,255,0.22)";

export const theme = {
  colors, spacing, radii, typography, shadows, status, holds, boardDots,
} as const;
export type Theme = typeof theme;
