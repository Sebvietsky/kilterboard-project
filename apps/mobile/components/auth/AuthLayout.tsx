import { ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Link, type Href } from 'expo-router';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';

// Châssis commun aux écrans (auth) : titre, carte du formulaire, lien de bas de
// page vers l'autre écran. Les deux écrans ont exactement cette forme, d'où un
// footer typé plutôt qu'un slot libre.
//
// Gestion du clavier, centralisée ici :
// - KeyboardAvoidingView remonte le contenu au-dessus du clavier. `padding` sur
//   iOS ; sur Android le redimensionnement de fenêtre (adjustResize) fait déjà
//   le travail, un behavior explicite se cumulerait et sur-décalerait.
// - Pas de keyboardVerticalOffset : le stack (auth) est en headerShown: false,
//   donc la vue démarre au bord de l'écran. À rétablir si un header apparaît.
// - ScrollView pour les petits écrans, où register (3 champs + hint) dépasse
//   même clavier remonté.
// - keyboardShouldPersistTaps="handled" : sans ça, le premier tap sur le CTA
//   ne fait que fermer le clavier et l'utilisateur doit taper deux fois.
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text style={styles.title}>{title}</Text>

        <View style={styles.card}>{children}</View>

        <Link href={footerHref} asChild>
          <Pressable>
            <Text style={styles.link}>{footerLabel}</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // flexGrow (pas flex) : le contenu occupe l'écran quand il est plus court,
  // et reprend sa hauteur naturelle quand il faut défiler.
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
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
