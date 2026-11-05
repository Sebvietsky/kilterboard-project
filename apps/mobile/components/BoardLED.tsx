import { View, StyleSheet, type DimensionValue } from 'react-native';
import { colors, radii, holds, boardDots } from '@/constants/theme';
import { Hold, HoldRole } from '@/lib/boulders/types';
import { BoardSize } from '@/lib/boardSizes/types';

// Géométrie des points (pixels — pas des tokens de design, c'est du dessin).
// Deux prises voisines sont à environ 5,6 unités Kilter, soit 14 px sur un
// iPhone : un anneau plus large mordrait sur la prise d'à côté.
const HOLD_SIZE = 12;
const DOT_SIZE = 4;

// Rôle backend (START/HAND/FOOT/FINISH) -> couleur du theme (start/hands/feet/finish).
// Map EXPLICITE : les noms ne correspondent pas (HAND != hands), pas de toLowerCase.
const HOLD_COLOR: Record<HoldRole, string> = {
  START: holds.start, // moss
  HAND: holds.hands, // sky
  FOOT: holds.feet, // coral
  FINISH: holds.finish, // gold
};

type Frame = Pick<
  BoardSize,
  'edgeLeft' | 'edgeRight' | 'edgeBottom' | 'edgeTop'
>;

// Position en % dans le cadre de la taille, en coordonnées Kilter.
// - x : de gauche à droite depuis edgeLeft.
// - y : INVERSÉ (y croît vers le haut, mais top=0 est en haut) -> depuis edgeTop.
function toPosition(
  frame: Frame,
  x: number,
  y: number,
): {
  left: DimensionValue;
  top: DimensionValue;
} {
  const width = frame.edgeRight - frame.edgeLeft;
  const height = frame.edgeTop - frame.edgeBottom;
  return {
    left: `${((x - frame.edgeLeft) / width) * 100}%`,
    top: `${((frame.edgeTop - y) / height) * 100}%`,
  };
}

// `size` absent tant que la taille se charge : le fond seul, sans prises.
export function BoardLED({
  size,
  holds: boulderHolds,
}: {
  size: BoardSize | undefined;
  holds: Hold[];
}) {
  if (!size) {
    return <View style={styles.board} />;
  }

  const aspectRatio =
    (size.edgeRight - size.edgeLeft) / (size.edgeTop - size.edgeBottom);

  return (
    <View style={[styles.board, { aspectRatio }]}>
      {/* Fond : toutes les prises de la taille, points discrets ("LED éteintes"). */}
      {size.holds.map((h) => (
        <View key={h.id} style={[styles.dot, toPosition(size, h.x, h.y)]} />
      ))}

      {/* Prises du bloc : anneaux colorés par rôle, par-dessus. */}
      {boulderHolds.map((h) => (
        <View
          key={h.holdCode}
          style={[
            styles.hold,
            toPosition(size, h.x, h.y),
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
    aspectRatio: 1, // remplacé par le ratio du cadre une fois la taille chargée
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
    borderWidth: 2,
    marginLeft: -HOLD_SIZE / 2,
    marginTop: -HOLD_SIZE / 2,
  },
});
