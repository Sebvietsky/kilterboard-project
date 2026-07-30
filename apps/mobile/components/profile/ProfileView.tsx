import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUser } from '@/lib/users/queries';
import type { GradeSystem } from '@/lib/auth/types';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';

const GRADE_SYSTEM_LABEL: Record<GradeSystem, string> = {
  V_SCALE: 'V-scale',
  FONT_SCALE: 'Font',
};

/**
 * Vue de profil, la même pour soi et pour un tiers.
 *
 * `username` absent = profil courant. Le composant vit hors de app/ parce
 * qu'il servira aussi une future route /user/[username] : le laisser dans
 * l'écran d'onglet obligerait à l'en extraire ce jour-là, avec un diff qui
 * mélangerait déplacement et nouveautés.
 */
export function ProfileView({ username }: { username?: string }) {
  const { user: currentUser, logout } = useAuth();
  const profile = useUser(username);

  // Vrai aussi quand on atteint son propre profil par son username — le cas
  // arrivera avec les liens profonds et la recherche.
  const isOwnProfile = !username || username === currentUser?.username;

  if (profile.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Couldn&apos;t load this profile</Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={() => profile.refetch()}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const { username: name, avatarUrl, bio, country, gradeSystem } = profile.data;
  const counts = profile.data._count;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerCard}>
        <Avatar uri={avatarUrl} name={name} />

        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            {country ? <Text style={styles.meta}>{country}</Text> : null}
            <View style={styles.gradePill}>
              <Text style={styles.gradePillText}>
                {GRADE_SYSTEM_LABEL[gradeSystem]}
              </Text>
            </View>
          </View>
        </View>

        {bio ? <Text style={styles.bio}>{bio}</Text> : null}
      </View>

      <View style={styles.statsCard}>
        <Stat label="Ascents" value={counts.ascents} />
        <View style={styles.statDivider} />
        <Stat label="Boulders" value={counts.boulders} />
        <View style={styles.statDivider} />
        <Stat label="Followers" value={counts.followedBy} />
        <View style={styles.statDivider} />
        <Stat label="Following" value={counts.follows} />
      </View>

      {/* Emplacement des actions. Sur un profil tiers viendra ici un bouton
          Follow — non implémenté : aucun endpoint ne dit si on suit déjà la
          personne, le bouton n'aurait pas d'état initial. */}
      <View style={styles.actions}>
        {isOwnProfile && (
          <>
            {/* Désactivé plutôt qu'inerte : un bouton qui ne répond pas au
                doigt se lit comme une panne. Grisé, il annonce « bientôt ». */}
            <Pressable disabled style={[styles.button, styles.buttonDisabled]}>
              <Text style={[styles.buttonText, styles.buttonTextDisabled]}>
                Edit profile
              </Text>
            </Pressable>

            <Pressable
              onPress={logout}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.buttonText, styles.logoutText]}>
                Log out
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // flexGrow et non flex : le contenu doit pouvoir dépasser l'écran quand la
  // bio est longue, tout en remplissant la hauteur quand il est court.
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  stateTitle: {
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
  retryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  retryText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.surface,
  },
  // ── Header ──────────────────────────────────────────────
  headerCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  identity: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  // Même recette que la pastille de cotation ailleurs dans l'app : c'est de
  // la même nature d'information — un système de cotation.
  gradePill: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  gradePillText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.primary,
  },
  bio: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // ── Stats ───────────────────────────────────────────────
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    ...shadows.card,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  // Le chiffre domine, le libellé sert de légende : c'est la valeur qu'on
  // vient chercher du regard, pas son nom.
  statValue: {
    fontFamily: typography.family.data,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  statLabel: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // ── Actions ─────────────────────────────────────────────
  actions: {
    gap: spacing.md,
  },
  button: {
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: {
    backgroundColor: colors.surface,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.text,
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
  logoutText: {
    color: colors.danger,
  },
});
