import { Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';

// Message d'erreur de soumission, dans la carte, au-dessus du CTA.
export function AuthError({ message }: { message: string }) {
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  error: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    color: colors.danger,
  },
});
