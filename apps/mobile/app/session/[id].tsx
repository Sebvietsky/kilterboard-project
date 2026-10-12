import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EntryRow } from '@/components/session/EntryRow';
import { SessionHero } from '@/components/session/SessionHero';
import { useSession } from '@/lib/sessions/queries';
import { formatDuration } from '@/lib/sessions/elapsed';
import type { SessionDetail } from '@/lib/sessions/types';
import { ApiError } from '@/lib/api/errors';
import { formatClockTime, formatDay } from '@/lib/format/clockTime';
import { colors, radii, spacing, typography } from '@/constants/theme';

// Compte rendu d'une session passée : la même carte et les mêmes lignes que
// la session en cours, figées. Aucune action ici — une session terminée ne se
// modifie pas.
export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const session = useSession(sessionId); // hook appelé inconditionnellement

  // id invalide, 404, ou 403 (session d'un autre) -> même écran « not found » :
  // dans les trois cas il n'y a rien à montrer à cet utilisateur.
  const isMissing =
    !Number.isFinite(sessionId) ||
    (session.error instanceof ApiError &&
      (session.error.status === 404 || session.error.status === 403));

  if (isMissing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Session not found</Text>
      </View>
    );
  }

  if (session.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (session.isError || !session.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Couldn&apos;t load this session</Text>
        <Pressable
          onPress={() => session.refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const data = session.data;

  return (
    <FlatList
      style={styles.screen}
      data={data.entries}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/boulder/${item.ascent.boulderId}`)}
        >
          <EntryRow entry={item} />
        </Pressable>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={session.isRefetching}
          onRefresh={session.refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <SessionHero {...heroProps(data)} entries={data.entries} />
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Logged</Text>
            <Text style={styles.sectionCount}>{data.entries.length}</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.emptyList}>
          No boulders were logged during this session.
        </Text>
      }
    />
  );
}

// Une session encore ouverte peut être ouverte par son URL : elle n'a pas de
// durée, on affiche alors son heure de début plutôt qu'un « 0m » trompeur.
function heroProps(session: SessionDetail) {
  const day = formatDay(session.startedAt);
  const startedAt = formatClockTime(session.startedAt);

  if (!session.endedAt) {
    return { label: day, value: startedAt, caption: 'Still in progress' };
  }

  return {
    label: day,
    value: formatDuration(session.startedAt, session.endedAt),
    caption: `${startedAt} – ${formatClockTime(session.endedAt)}`,
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
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
    marginTop: spacing.sm,
  },
  retryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  retryText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  listHeader: {
    gap: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  sectionCount: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  emptyList: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
});
