import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

// Échantillon temporaire de contrôle des fonts (tâche 4) : les 3 rendus
// doivent être visiblement DIFFÉRENTS de la police système — seul moyen de
// détecter un fallback silencieux. À remplacer par le vrai écran Accueil.
export default function AccueilScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.display}>Kilterboard</Text>
      <Text style={styles.heading}>Session du jour</Text>
      <Text style={styles.body}>
        Un paragraphe en Figtree pour vérifier le rendu du corps de texte, avec
        assez de mots pour juger la lisibilité.
      </Text>
      <View style={styles.dataRow}>
        <Text style={styles.data}>47:12</Text>
        <Text style={styles.data}>45°</Text>
        <Text style={styles.data}>V6</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  display: {
    fontFamily: typography.family.display,
    fontSize: typography.size.display,
    // -0.02em : letterSpacing RN est en points absolus → proportionnel à la taille
    letterSpacing: typography.size.display * typography.letterSpacing.tight,
    color: colors.text,
  },
  heading: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  body: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
    color: colors.textMuted,
  },
  dataRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  data: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xxl,
    color: colors.primary,
  },
});
