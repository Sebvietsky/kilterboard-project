import { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link, type Href } from 'expo-router';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';

// Châssis commun aux écrans (auth) : titre, carte du formulaire, lien de bas de
// page vers l'autre écran. Les deux écrans ont exactement cette forme, d'où un
// footer typé plutôt qu'un slot libre.
// Point d'entrée unique pour tout ce qui concerne la mise en page de ces écrans
// (ex. la gestion du clavier, qui manque encore aux deux).
export function AuthLayout({
  title,
  footerHref,
  footerLabel,
  children,
}: {
  title: string;
  footerHref: Href;
  footerLabel: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.card}>{children}</View>

      <Link href={footerHref} asChild>
        <Pressable>
          <Text style={styles.link}>{footerLabel}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    gap: spacing.lg,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.display,
    letterSpacing: typography.size.display * typography.letterSpacing.tight,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card,
  },
  link: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primary,
    textAlign: 'center',
  },
});
