import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/Avatar';
import { AscentHistoryRow } from '@/components/profile/AscentHistoryRow';
import { useAuth } from '@/lib/auth/AuthContext';
import { useUser } from '@/lib/users/queries';
import { useMyRecentAscents } from '@/lib/ascents/queries';
import type { MyAscentHistoryItem } from '@/lib/ascents/types';
import { boulderHref } from '@/lib/boulders/href';
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
  // L'historique n'existe que pour soi : GET /ascents/me. Un profil tiers
  // attendra une route publique.
  const recent = useMyRecentAscents(isOwnProfile);

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

  const onRefresh = () => {
    void profile.refetch();
    if (isOwnProfile) void recent.refetch();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={profile.isRefetching || recent.isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
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

      {/* L'historique n'existe que pour soi : GET /ascents/me. Un profil tiers
          attendra une route publique. */}
      {isOwnProfile && (
        <RecentAscents
          ascents={recent.data?.data}
          total={recent.data?.meta.total ?? 0}
          isError={recent.isError}
          onRetry={() => void recent.refetch()}
        />
      )}

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

// Les dernières ascensions, et un lien vers l'historique complet quand il y
// en a davantage.
function RecentAscents({
  ascents,
  total,
  isError,
  onRetry,
}: {
  ascents: MyAscentHistoryItem[] | undefined;
  total: number;
  isError: boolean;
  onRetry: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ascents</Text>
        {ascents && total > ascents.length ? (
          <Pressable
            onPress={() => router.push('/ascents')}
            hitSlop={spacing.sm}
          >
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        ) : null}
      </View>

      {ascents && ascents.length > 0 ? (
        ascents.map((ascent) => (
          <Pressable
            key={ascent.id}
            onPress={() =>
              router.push(
                boulderHref(ascent.boulderId, ascent.angle.valueDegrees),
              )
            }
          >
            <AscentHistoryRow ascent={ascent} />
          </Pressable>
        ))
      ) : (
        <AscentsEmptyState
          isPending={!ascents && !isError}
          isError={isError}
          onRetry={onRetry}
        />
      )}
    </View>
  );
}

// La liste est vide pour trois raisons distinctes : premier chargement,
// échec, ou aucune ascension. Seule la dernière est un vrai « vide ».
// Partagé avec l'écran de l'historique complet.
export function AscentsEmptyState({
  isPending,
  isError,
  onRetry,
}: {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isError) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.stateTitle}>Couldn&apos;t load your ascents</Text>
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={onRetry}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (isPending) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={styles.emptyState}>
      <Text style={styles.stateTitle}>No ascents yet</Text>
    </View>
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
    color: colors.textOnPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
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
  // ── Ascents ─────────────────────────────────────────────
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionLink: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  sectionTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.text,
  },
});
