import { useLayoutEffect, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { colors, radii, shadows, spacing } from '@/constants/theme';

const THUMB_SIZE = spacing.xl;
const TRACK_HEIGHT = spacing.xxl + spacing.sm;
const RAIL_HEIGHT = spacing.xs;

type Thumb = 'low' | 'high';

type Props = {
  // Index du dernier cran : le curseur va de 0 à `max`. Il ne connaît que des
  // index ; l'appelant les traduit (cotations, inclinaisons…).
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  // Libellé d'un cran, lu par VoiceOver sur chaque poignée.
  formatValue: (index: number) => string;
};

// Cran le plus proche d'une position, en points depuis le bord gauche de la
// piste. La poignée se centre sur sa valeur : la course utile est donc la
// largeur moins une poignée, décalée d'une demi-poignée.
function indexAt(x: number, width: number, max: number): number {
  const course = width - THUMB_SIZE;
  if (course <= 0 || max <= 0) return 0;
  const index = Math.round(((x - THUMB_SIZE / 2) / course) * max);
  return Math.min(max, Math.max(0, index));
}

type SliderValues = {
  max: number;
  low: number;
  high: number;
  width: number;
  onChange: (low: number, high: number) => void;
};

// Logique du geste, hors du composant : un PanResponder créé une seule fois,
// avec son état dans cette fermeture. `sync` lui transmet les valeurs du
// dernier rendu ; le composant l'appelle après chaque rendu, et le geste
// suivant arrive toujours après.
function createSliderGesture(initial: SliderValues) {
  let values = initial;
  // Geste en cours : la poignée saisie et le point de départ du doigt.
  let thumb: Thumb = 'low';
  let startX = 0;

  // Déplace la poignée saisie vers un cran, sans dépasser l'autre poignée.
  const moveTo = (x: number) => {
    const { max, low, high, width, onChange } = values;
    const index = indexAt(x, width, max);
    if (thumb === 'low') {
      const next = Math.min(index, high);
      if (next !== low) onChange(next, high);
    } else {
      const next = Math.max(index, low);
      if (next !== high) onChange(low, next);
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // Une fois le curseur saisi, la ScrollView parente ne le reprend pas.
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const { max, low, high, width } = values;
      // `locationX` est relatif à la piste : les poignées et le rail sont en
      // `pointerEvents="none"`, le toucher arrive toujours sur elle.
      const x = event.nativeEvent.locationX;
      const index = indexAt(x, width, max);
      // La poignée la plus proche. À égalité (poignées confondues), celle qui
      // peut aller dans la direction du doigt.
      const toLow = Math.abs(index - low);
      const toHigh = Math.abs(index - high);
      thumb =
        toLow < toHigh || (toLow === toHigh && index < low) ? 'low' : 'high';
      startX = x;
      moveTo(x);
    },
    // Départ + déplacement cumulé, plutôt que `locationX` : quand le doigt
    // sort de la piste, `locationX` devient relatif à une autre vue.
    onPanResponderMove: (_event, state) => {
      moveTo(startX + state.dx);
    },
  });

  return {
    panHandlers: panResponder.panHandlers,
    sync: (next: SliderValues) => {
      values = next;
    },
  };
}

/**
 * Curseur à deux poignées, en JS pur (PanResponder), sans dépendance native.
 *
 * Remplace rn-range-slider 2.2.2, qui ne recevait plus aucun geste sous React
 * Native 0.88 et n'est plus maintenue. Deux différences de conception :
 * - la position du doigt est lue dans `onPanResponderMove` (départ + `dx`),
 *   sans `Animated.event` ni écouteur sur une `Animated.Value` ;
 * - le curseur prend la main dès le contact, un tap déplace donc la poignée
 *   la plus proche.
 *
 * Contrôlé : il n'a pas d'état propre pour les valeurs, seulement la largeur
 * mesurée. Le parent reçoit chaque changement de cran, et lui seul.
 * La logique du geste vit dans `createSliderGesture`, hors du rendu.
 */
export function RangeSlider({ max, low, high, onChange, formatValue }: Props) {
  const [width, setWidth] = useState(0);

  // Créé au premier rendu, conservé ensuite : un PanResponder recréé en plein
  // geste perdrait la poignée saisie.
  const [gesture] = useState(() =>
    createSliderGesture({ max, low, high, width, onChange }),
  );
  useLayoutEffect(() => {
    gesture.sync({ max, low, high, width, onChange });
  });

  const course = Math.max(0, width - THUMB_SIZE);
  const leftOf = (index: number) => (max > 0 ? (index / max) * course : 0);
  const lowLeft = leftOf(low);
  const highLeft = leftOf(high);

  // VoiceOver : chaque poignée se règle par balayage vertical (« adjustable »).
  const onAccessibilityAction =
    (thumb: Thumb) => (event: AccessibilityActionEvent) => {
      const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      if (thumb === 'low') {
        onChange(Math.min(Math.max(0, low + step), high), high);
      } else {
        onChange(low, Math.max(Math.min(max, high + step), low));
      }
    };

  return (
    <View
      style={styles.track}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      {...gesture.panHandlers}
    >
      <View style={styles.rail} pointerEvents="none" />
      <View
        pointerEvents="none"
        style={[
          styles.railSelected,
          { left: lowLeft + THUMB_SIZE / 2, width: highLeft - lowLeft },
        ]}
      />
      {(['low', 'high'] as const).map((thumb) => {
        const index = thumb === 'low' ? low : high;
        return (
          <View
            key={thumb}
            pointerEvents="none"
            style={[styles.thumb, { left: leftOf(index) }]}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={thumb === 'low' ? 'Minimum' : 'Maximum'}
            accessibilityValue={{ text: formatValue(index) }}
            accessibilityActions={[
              { name: 'increment' },
              { name: 'decrement' },
            ]}
            onAccessibilityAction={onAccessibilityAction(thumb)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: RAIL_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  railSelected: {
    position: 'absolute',
    height: RAIL_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.text,
    borderWidth: spacing.xs,
    borderColor: colors.surface,
    ...shadows.card,
  },
});
