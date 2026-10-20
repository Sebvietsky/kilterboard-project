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
import { ChevronRight } from 'lucide-react-native';
import {
  EntryRow,
  GradeCircle,
  StatusBadge,
} from '@/components/session/EntryRow';
import { SessionHero } from '@/components/session/SessionHero';
import {
  useActiveSession,
  useEndSession,
  useMySessions,
  useStartSession,
} from '@/lib/sessions/queries';
import {
  formatDuration,
  formatElapsed,
  useElapsedSeconds,
} from '@/lib/sessions/elapsed';
import type { ActiveSession, SessionSummary } from '@/lib/sessions/types';
import { useMyProjects } from '@/lib/ascents/queries';
import { boulderHref } from '@/lib/boulders/href';
import type { MyProject } from '@/lib/ascents/types';
import { formatClockTime, formatDay } from '@/lib/format/clockTime';
import { plural } from '@/lib/format/plural';
import {
  colors,
  spacing,
  typography,
  radii,
  shadows,
  status as statusColors,
} from '@/constants/theme';

const PROJECT_CARD_WIDTH = spacing.xxxl * 4;
const CHEVRON_SIZE = spacing.xl - spacing.xs;

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
      onRefresh={() => void query.refetch()}
    />
  );
}

// Au repos, l'écran sert à deux choses : démarrer une séance, et retrouver les
// précédentes. L'historique est la liste ; la carte Start en est l'en-tête.
function NoSession() {
  const router = useRouter();
  const startSession = useStartSession();
  const history = useMySessions();

  return (
    <FlatList
      data={history.data}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/session/${item.id}`)}
          style={styles.rowPressable}
        >
          <PastSessionCard session={item} />
        </Pressable>
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={history.isRefetching}
          onRefresh={() => void history.refetch()}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <View style={styles.padded}>
            <View style={styles.startCard}>
              <Text style={styles.stateTitle}>No session in progress</Text>
              <Text style={styles.stateHint}>
                Start a session to time your climb and keep track of the
                boulders you log.
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
                <Text style={styles.errorText}>
                  {startSession.error.message}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.sectionHeader, styles.padded]}>
            <Text style={styles.sectionTitle}>Past sessions</Text>
            {history.data ? (
              <Text style={styles.sectionCount}>{history.data.length}</Text>
            ) : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.emptyList, styles.padded]}>
          {history.isLoading
            ? 'Loading your sessions…'
            : history.isError
              ? 'Couldn’t load your past sessions. Pull to retry.'
              : 'Sessions you finish will show up here.'}
        </Text>
      }
    />
  );
}

function PastSessionCard({ session }: { session: SessionSummary }) {
  return (
    <View style={styles.pastCard}>
      <View style={styles.pastCardText}>
        <Text style={styles.pastCardTitle}>{formatDay(session.startedAt)}</Text>
        <Text style={styles.pastCardMeta}>
          {formatClockTime(session.startedAt)}
          {/* Le filtre de l'historique garantit `endedAt`, mais le type ne le
              sait pas : sans durée, on n'affiche que l'heure. */}
          {session.endedAt
            ? ` · ${formatDuration(session.startedAt, session.endedAt)}`
            : ''}
          {' · '}
          {plural(session._count.entries, 'climb')}
        </Text>
      </View>
      <ChevronRight size={CHEVRON_SIZE} color={colors.textSubtle} />
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
      data={session.entries}
      // L'id du passage, pas celui de l'ascension : un projet travaillé deux
      // fois dans la séance donne deux lignes pour la même ascension.
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            router.push(
              boulderHref(
                item.ascent.boulderId,
                item.ascent.angle.valueDegrees,
              ),
            )
          }
          style={styles.rowPressable}
        >
          <EntryRow entry={item} />
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
          <View style={styles.padded}>
            <LiveSessionHero session={session} />
          </View>

          <View style={styles.padded}>
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

          <ContinueProjects />

          <View style={[styles.sectionHeader, styles.padded]}>
            <Text style={styles.sectionTitle}>Logged this session</Text>
            <Text style={styles.sectionCount}>{session.entries.length}</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.emptyList, styles.padded]}>
          Boulders you log during this session will show up here.
        </Text>
      }
    />
  );
}

// Le chrono vit ici et pas dans RunningSession : son état change chaque
// seconde, et seule la carte doit se re-rendre — pas la liste.
function LiveSessionHero({ session }: { session: ActiveSession }) {
  const elapsed = useElapsedSeconds(session.startedAt);

  return (
    <SessionHero
      active
      label="Active session"
      value={formatElapsed(elapsed)}
      caption={`Started ${formatClockTime(session.startedAt)}`}
      entries={session.entries}
    />
  );
}

// Les projets ouverts, pas ceux de la séance : c'est une invitation à en
// reprendre un. Section absente tant qu'il n'y en a aucun (ou que la liste
// charge) — un bandeau vide au milieu de l'écran n'apporterait rien.
function ContinueProjects() {
  const router = useRouter();
  const projects = useMyProjects();

  if (!projects.data?.length) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, styles.padded]}>
        <Text style={styles.sectionTitle}>Continue your projects</Text>
        <Pressable
          onPress={() => router.navigate('/library')}
          hitSlop={spacing.sm}
        >
          <Text style={styles.sectionLink}>See all</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={projects.data}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(boulderHref(item.boulderId, item.angle.valueDegrees))
            }
          >
            <ProjectCard project={item} />
          </Pressable>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.projectsContent}
      />
    </View>
  );
}

function ProjectCard({ project }: { project: MyProject }) {
  const { boulder, boulderAngle, attemptsCount, sessionsCount } = project;

  return (
    <View style={styles.projectCard}>
      <View style={styles.projectCardTop}>
        <GradeCircle label={boulderAngle.grade?.vScale ?? null} muted />
        <StatusBadge tone="project" label="Proj." />
      </View>
      <Text style={styles.projectName} numberOfLines={1}>
        {boulder.name}
      </Text>
      <Text style={styles.projectMeta}>
        {plural(attemptsCount, 'try', 'tries')} ·{' '}
        {plural(sessionsCount, 'session')}
      </Text>
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
    marginTop: spacing.sm,
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
  // lourd à l'œil que la carte du chrono, qui reste l'information principale.
  endButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.full,
    paddingVertical: spacing.lg,
  },
  endButtonPressed: {
    backgroundColor: statusColors.project.softBg,
  },
  endButtonText: {
    fontFamily: typography.family.bodyBold,
    fontSize: typography.size.md,
    color: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // ── Structure des listes ────────────────────────────────
  // Le padding horizontal est porté par chaque bloc (`padded`) et non par la
  // liste : le carrousel des projets doit pouvoir défiler jusqu'au bord.
  listContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  listHeader: {
    gap: spacing.lg,
    marginBottom: spacing.xs,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  rowPressable: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    gap: spacing.md,
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
  sectionLink: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.sm,
    color: colors.primary,
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
  // ── Au repos : Start et historique ──────────────────────
  startCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  pastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    ...shadows.card,
  },
  pastCardText: {
    flex: 1,
    gap: spacing.xs,
  },
  pastCardTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.text,
  },
  pastCardMeta: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  // ── Projets à reprendre ─────────────────────────────────
  projectsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    // Laisse la place à l'ombre des cartes, que le carrousel rognerait.
    paddingVertical: spacing.xs,
  },
  projectCard: {
    width: PROJECT_CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  projectCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  projectName: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.text,
  },
  projectMeta: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
});
