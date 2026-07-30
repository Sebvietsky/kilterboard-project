import { View, StyleSheet, type DimensionValue } from 'react-native';
import { colors, radii, holds, boardDots } from '@/constants/theme';
import { Hold, HoldRole } from '@/lib/boulders/types';

// Grille du Kilterboard : 12 colonnes (A-L) × 12 lignes.
// Depuis le seed : x = 1..12 (colonne), y = 1..12 (ligne, 1 = BAS).
const COLS = 12;
const ROWS = 12;

// Géométrie des points (pixels — pas des tokens de design, c'est du dessin).
const HOLD_SIZE = 20;
const DOT_SIZE = 5;

// Rôle backend (START/HAND/FOOT/FINISH) -> couleur du theme (start/hands/feet/finish).
// Map EXPLICITE : les noms ne correspondent pas (HAND != hands), pas de toLowerCase.
const HOLD_COLOR: Record<HoldRole, string> = {
  START: holds.start, // moss
  HAND: holds.hands, // sky
  FOOT: holds.feet, // coral
  FINISH: holds.finish, // gold
};

// Position en % du CENTRE d'une cellule de la grille.
// - x : de gauche à droite, on centre dans la cellule -> (x - 0.5) / COLS.
// - y : INVERSÉ (y=1 est en bas, mais top=0 est en haut) -> (ROWS - y + 0.5) / ROWS.
// Le +0.5 / -0.5 garde tous les points à l'intérieur (pas de rognage sur les bords).
function toPosition(
  x: number,
  y: number,
): {
  left: DimensionValue;
  top: DimensionValue;
} {
  return {
    left: `${((x - 0.5) / COLS) * 100}%`,
    top: `${((ROWS - y + 0.5) / ROWS) * 100}%`,
  };
}

// Toutes les positions de la grille -> points de fond ("LED éteintes").
const GRID_DOTS = Array.from({ length: COLS * ROWS }, (_, i) => ({
  x: (i % COLS) + 1,
  y: Math.floor(i / COLS) + 1,
}));

export function BoardLED({ holds: boulderHolds }: { holds: Hold[] }) {
  return (
    <View style={styles.board}>
      {/* Fond : la grille complète, points discrets. */}
      {GRID_DOTS.map(({ x, y }) => (
        <View key={`dot-${x}-${y}`} style={[styles.dot, toPosition(x, y)]} />
      ))}

      {/* Prises du bloc : anneaux colorés par rôle, par-dessus la grille. */}
      {boulderHolds.map((h) => (
        <View
          key={h.holdCode}
          style={[
            styles.hold,
            toPosition(h.x, h.y),
            { borderColor: HOLD_COLOR[h.role] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    width: '100%',
    aspectRatio: 1, // carré : la grille est 12×12
    backgroundColor: colors.ink,
    borderRadius: radii.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  // marginLeft/Top = -taille/2 : recentre le point sur sa coordonnée
  // (left/top placent le COIN, pas le centre).
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radii.full,
    backgroundColor: boardDots,
    marginLeft: -DOT_SIZE / 2,
    marginTop: -DOT_SIZE / 2,
  },
  hold: {
    position: 'absolute',
    width: HOLD_SIZE,
    height: HOLD_SIZE,
    borderRadius: radii.full,
    borderWidth: 2.5,
    marginLeft: -HOLD_SIZE / 2,
    marginTop: -HOLD_SIZE / 2,
  },
});
