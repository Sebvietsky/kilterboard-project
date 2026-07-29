import { Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, typography, radii } from '@/constants/theme';

// CTA principal des écrans (auth). `disabled` porte l'état combiné du formulaire
// (champs vides OU soumission en cours) : la décision reste dans l'écran.
export function AuthButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonText: {
    // TODO: token textOnPrimary — colors.surface donne le bon rendu mais exprime
    // mal l'intention (c'est un texte sur fond primaire, pas une surface).
    color: colors.surface,
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
  },
});
