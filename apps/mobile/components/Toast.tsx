import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOAST_VISIBLE_MS, useToastStore } from '@/lib/toast/useToastStore';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';

const FADE_MS = 180;

// Point de rendu unique des toasts, monté une fois à la racine de l'app.
//
// En haut de l'écran et non en bas : le bas est occupé par la tab bar, et par
// le clavier sur le formulaire de log — là où la confirmation est attendue.
// `pointerEvents="none"` : un toast informe, il ne doit jamais intercepter un
// tap destiné à l'écran en dessous.
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const toast = useToastStore((state) => state.toast);
  const hide = useToastStore((state) => state.hide);
  // useState et non useRef : l'Animated.Value est lue pendant le rendu (dans
  // le style), ce que les règles de React interdisent pour une ref. L'état
  // n'est jamais remplacé, il garantit seulement une instance stable.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toast) return;

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // Si un nouveau toast a interrompu la sortie, c'est lui qui reste.
        if (finished) hide();
      });
    }, TOAST_VISIBLE_MS);

    // Un nouveau toast (nouvel objet, nouvel id) annule le délai du précédent.
    return () => clearTimeout(timeout);
  }, [toast, progress, hide]);

  if (!toast) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.host, { top: insets.top + spacing.sm }]}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-spacing.lg, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.dot} />
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.ink,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.success,
  },
  message: {
    flexShrink: 1,
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.sm,
    color: colors.textOnInk,
  },
});
