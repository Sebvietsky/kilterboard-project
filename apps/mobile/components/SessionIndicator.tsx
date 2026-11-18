import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useActiveSession } from '@/lib/sessions/queries';
import { formatElapsed, useElapsedSeconds } from '@/lib/sessions/elapsed';
import { colors, radii, spacing, typography } from '@/constants/theme';

// État de la session dans le header, visible depuis tous les onglets : la
// session est la fonctionnalité centrale de l'app, on doit savoir si elle
// tourne sans aller sur son écran. Un tap y mène.
//
// Volontairement discret : une pastille à droite du logo, pas un bandeau. Elle
// informe sans disputer la place au contenu de l'écran.
//
// Absente de l'onglet Session, qui affiche déjà tout cela en grand. Absente
// aussi pendant le chargement et sur erreur : mieux vaut aucun indicateur
// qu'un « No session » affiché à tort.
export function SessionHeaderPill() {
  const router = useRouter();
  const pathname = usePathname();
  const activeSession = useActiveSession();

  if (pathname === '/session' || !activeSession.isSuccess) return null;

  const session = activeSession.data;

  return (
    <Pressable
      onPress={() => router.navigate('/session')}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={
        session
          ? 'Session in progress. Open Session'
          : 'No session in progress. Open Session'
      }
      style={({ pressed }) => [
        styles.pill,
        session ? styles.pillActive : styles.pillIdle,
        pressed && styles.pillPressed,
      ]}
    >
      {session ? (
        <>
          <View style={[styles.dot, styles.dotActive]} />
          <Text style={styles.label}>Session</Text>
          <ElapsedTime startedAt={session.startedAt} />
        </>
      ) : (
        <>
          <View style={[styles.dot, styles.dotIdle]} />
          <Text style={styles.label}>No session</Text>
        </>
      )}
    </Pressable>
  );
}

// Composant à part : son état change chaque seconde, et lui seul doit se
// re-rendre — pas la pastille, ni le header.
function ElapsedTime({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedSeconds(startedAt);

  return <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
  },
  // Au repos : contour neutre, sans fond. Ne pas avoir de session n'est pas un
  // problème, donc aucune couleur d'alerte.
  pillIdle: {
    borderColor: colors.borderStrong,
  },
  // En cours : un voile translucide, sans contour visible. Le point gold porte
  // seul le signal « actif » (couleur que le thème réserve à la session).
  pillActive: {
    backgroundColor: colors.surfaceVeil,
    borderColor: colors.surfaceVeil,
  },
  pillPressed: {
    opacity: 0.6,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.full,
  },
  dotActive: {
    backgroundColor: colors.gold,
  },
  // Point creux : la même forme que le point plein, à l'état éteint.
  dotIdle: {
    borderWidth: 1,
    borderColor: colors.textSubtle,
  },
  label: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  // tabular-nums : chiffres à chasse fixe, sinon la pastille change de largeur
  // à chaque seconde.
  timer: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
});
