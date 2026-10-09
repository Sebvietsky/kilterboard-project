import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useActiveSession,
  useEndSession,
  useStartSession,
} from '@/lib/sessions/queries';
import type { ActiveSession, SessionAscent } from '@/lib/sessions/types';
import type { AscentStatus } from '@/lib/ascents/types';
import {
  colors,
  spacing,
  typography,
  radii,
  shadows,
  status as statusColors,
} from '@/constants/theme';

// Écran plein et non modal : Session est un onglet de premier niveau, on doit
// pouvoir en sortir et y revenir sans perdre son état. Rien n'est gardé en
// state local pour cette raison : la session vit côté serveur, l'écran la lit.
export default function SessionScreen() {
  const activeSession = useActiveSession();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Session</Text>
      </View>
      <SessionBody query={activeSession} />
    </View>
  );
}

function SessionBody({
  query,
}: {
  query: ReturnType<typeof useActiveSession>;
}) {
  if (query.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Couldn&apos;t load your session</Text>
        <Pressable
          onPress={() => query.refetch()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // `null` et non `undefined` : le serveur a répondu, et il n'y a pas de
  // session en cours. C'est l'état de départ normal de l'écran.
  if (!query.data) return <NoSession />;

  return (
    <RunningSession
      session={query.data}
      isRefetching={query.isRefetching}
      onRefresh={query.refetch}
    />
  );
}

function NoSession() {
  const startSession = useStartSession();

  return (
    <View style={styles.centered}>
      <Text style={styles.stateTitle}>No session in progress</Text>
      <Text style={styles.stateHint}>
        Start a session to time your climb and keep track of the boulders you
        log.
      </Text>
      <Pressable
        onPress={() => startSession.mutate()}
        disabled={startSession.isPending}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
          startSession.isPending && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.primaryButtonText}>Start session</Text>
      </Pressable>
      {startSession.isError ? (
        <Text style={styles.errorText}>{startSession.error.message}</Text>
      ) : null}
    </View>
  );
}

function RunningSession({
  session,
  isRefetching,
  onRefresh,
}: {
  session: ActiveSession;
  isRefetching: boolean;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const endSession = useEndSession();
  const elapsed = useElapsedSeconds(session.startedAt);

  // Confirmation : une session terminée ne se rouvre pas, et le bouton est à
  // portée de pouce pendant toute la séance.
  const confirmEnd = () => {
    Alert.alert('End session?', 'You won’t be able to resume it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: () => endSession.mutate(session.id),
      },
    ]);
  };

  return (
    <FlatList
      data={session.ascents}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/boulder/${item.boulderId}`)}>
          <AscentRow ascent={item} />
        </Pressable>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>
              {session.board?.name ?? session.title ?? 'Session'}
            </Text>
            <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
          </View>
          <Text style={styles.sectionTitle}>
            Boulders · {session.ascents.length}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyList}>
          Boulders you log during this session will show up here.
        </Text>
      }
      ListFooterComponent={
        <View style={styles.listFooter}>
          <Pressable
            onPress={confirmEnd}
            disabled={endSession.isPending}
            style={({ pressed }) => [
              styles.endButton,
              pressed && styles.endButtonPressed,
              endSession.isPending && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.endButtonText}>End session</Text>
          </Pressable>
          {endSession.isError ? (
            <Text style={styles.errorText}>{endSession.error.message}</Text>
          ) : null}
        </View>
      }
    />
  );
}

/**
 * Secondes écoulées depuis `startedAt`.
 *
 * Le chrono est DÉRIVÉ de la date de début, jamais compté : l'intervalle ne
 * sert qu'à redemander un rendu. Un compteur incrémenté chaque seconde
 * dériverait dès que l'app passe en arrière-plan (les timers JS y sont
 * suspendus) et repartirait de zéro au remontage de l'écran.
 */
function useElapsedSeconds(startedAt: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // max(0) : l'horloge du téléphone peut retarder sur celle du serveur.
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

const STATUS_BADGE: Record<
  AscentStatus,
  { label: string; recipe: (typeof statusColors)[keyof typeof statusColors] }
> = {
  FLASH: { label: 'Flash', recipe: statusColors.flash },
  SENT: { label: 'Sent', recipe: statusColors.ascent },
  PROJECT: { label: 'Project', recipe: statusColors.project },
};

function AscentRow({ ascent }: { ascent: SessionAscent }) {
  const { boulder, attemptsCount } = ascent;
  const badge = STATUS_BADGE[ascent.status];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {boulder.name}
        </Text>
        <View style={styles.gradeBadge}>
          <Text style={styles.gradeText}>{boulder.grade.vScale}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View
          style={[styles.statusBadge, { backgroundColor: badge.recipe.softBg }]}
        >
          <Text style={[styles.statusText, { color: badge.recipe.badgeText }]}>
            {badge.label}
          </Text>
        </View>
        <Text style={styles.metaData}>{boulder.angle.valueDegrees}°</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaData}>
          {attemptsCount} {attemptsCount === 1 ? 'attempt' : 'attempts'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.display,
    letterSpacing: typography.size.display * typography.letterSpacing.tight,
    color: colors.text,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  stateTitle: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  stateHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.danger,
    textAlign: 'center',
  },
  // ── Boutons ─────────────────────────────────────────────
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
  // Contour et non aplat : End est destructif mais ne doit pas peser plus
  // lourd à l'œil que le chrono, qui reste l'information principale.
  endButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
  },
  endButtonPressed: {
    backgroundColor: statusColors.project.softBg,
  },
  endButtonText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // ── Session en cours ────────────────────────────────────
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  listHeader: {
    gap: spacing.xl,
  },
  listFooter: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  timerCard: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  timerLabel: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.sm,
    color: colors.sky,
  },
  // tabular-nums : chiffres à chasse fixe, sinon le chrono tremble à chaque
  // seconde (un « 1 » est plus étroit qu'un « 8 »).
  timer: {
    fontFamily: typography.family.dataBold,
    fontSize: typography.size.display,
    fontVariant: ['tabular-nums'],
    color: colors.textOnInk,
  },
  sectionTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  emptyList: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  // ── Cartes ──────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    flex: 1,
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  gradeBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  gradeText: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
  },
  metaData: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  metaDot: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
});
