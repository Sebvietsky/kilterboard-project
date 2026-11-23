import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '@/constants/theme';

type Props = {
  onRetry: () => void;
};

// Affiché au lancement quand le serveur n'a pas répondu. Hors navigation,
// comme le splash : la session est inconnue, aucun groupe de routes n'est
// légitime.
export default function OfflineScreen({ onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kilterboard</Text>
      <Text style={styles.message}>Couldn&apos;t reach the server.</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryButton,
          pressed && styles.retryPressed,
        ]}
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    letterSpacing: typography.size.xxl * typography.letterSpacing.tight,
    color: colors.text,
  },
  message: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  retryText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
});
