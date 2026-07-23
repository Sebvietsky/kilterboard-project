import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/constants/theme';

export default function SplashScreenComponent() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kilterboard</Text>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.lg,
  },
  title: {
    // Wordmark → display. Ce splash ne s'affiche que quand les fonts sont
    // chargées (gate dans _layout), donc pas de risque de fallback visible.
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    letterSpacing: typography.size.xxl * typography.letterSpacing.tight,
    color: colors.text,
  },
});
