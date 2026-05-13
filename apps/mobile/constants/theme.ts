export const colors = {
  // Surfaces
  background: "#FFFFFF",
  surface: "#F7F8FA", // cards, sections légèrement surélevées
  surfaceMuted: "#EEF0F3", // pilules, inputs, badges

  // Texte
  text: "#0B0F14", // texte principal
  textMuted: "#5B6470", // texte secondaire, labels
  textSubtle: "#9099A3", // métadonnées, hints

  // Accent (le bleu des wireframes)
  primary: "#2E5BFF",
  primaryPressed: "#234AD4",
  primaryMuted: "#E5EBFF", // fond de boutons secondaires bleus, pilules sélectionnées

  // Bordures
  border: "#E4E7EB",
  borderStrong: "#CFD4DA",

  // Sémantique
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",

  // Overlays
  overlay: "rgba(11, 15, 20, 0.5)",
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
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  // Tailles
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  // Poids (React Native attend des strings)
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  // Line height ratios
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

// Ombres : iOS et Android utilisent des props différentes
export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2, // Android
  },
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
} as const;

export type Theme = typeof theme;
