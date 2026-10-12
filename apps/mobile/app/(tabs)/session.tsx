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
import { formatElapsed, useElapsedSeconds } from '@/lib/sessions/elapsed';
import { deriveSessionStats } from '@/lib/sessions/stats';
import type { ActiveSession, SessionEntry } from '@/lib/sessions/types';
import { useMyProjects } from '@/lib/ascents/queries';
import type { MyProject } from '@/lib/ascents/types';
import { formatClockTime } from '@/lib/format/clockTime';
import {
  colors,
  spacing,
  typography,
  radii,
  shadows,
  status as statusColors,
} from '@/constants/theme';

const GRADE_CIRCLE_SIZE = spacing.xxl + spacing.sm;
const PROJECT_CARD_WIDTH = spacing.xxxl * 4;

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
          onPress={() => router.push(`/boulder/${item.ascent.boulderId}`)}
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
            <SessionCard session={session} />
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

// Le chrono vit dans la carte et pas dans RunningSession : son état change
// chaque seconde, et seul ce composant doit se re-rendre — pas la liste.
function SessionCard({ session }: { session: ActiveSession }) {
  const elapsed = useElapsedSeconds(session.startedAt);
  const stats = deriveSessionStats(session.entries);

  return (
    <View style={styles.sessionCard}>
      <View style={styles.activeRow}>
        <View style={styles.activeDot} />
        <Text style={styles.activeLabel}>Active session</Text>
      </View>

      <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
      <Text style={styles.startedAt}>
        Started {formatClockTime(session.startedAt)}
      </Text>

      <View style={styles.statsRow}>
        <StatChip label={plural(stats.climbs, 'climb')} />
        {stats.hardest ? <StatChip label={`${stats.hardest} hardest`} /> : null}
        {stats.flashes > 0 ? (
          <StatChip
            label={plural(stats.flashes, 'flash', 'flashes')}
            tone="flash"
          />
        ) : null}
        {stats.projectsSent > 0 ? (
          <StatChip
            label={`${plural(stats.projectsSent, 'project')} sent`}
            tone="project"
          />
        ) : null}
      </View>
    </View>
  );
}

// La teinte suit le code couleur des statuts partout dans l'app : gold pour
// un flash, coral pour un projet. Sans `tone`, une stat neutre.
function StatChip({
  label,
  tone,
}: {
  label: string;
  tone?: 'flash' | 'project';
}) {
  return (
    <View
      style={[
        styles.statChip,
        tone === 'flash' && styles.statChipFlash,
        tone === 'project' && styles.statChipProject,
      ]}
    >
      <Text
        style={[
          styles.statChipText,
          tone === 'flash' && styles.statChipTextFlash,
          tone === 'project' && styles.statChipTextProject,
        ]}
      >
        {label}
      </Text>
    </View>
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
          <Pressable onPress={() => router.push(`/boulder/${item.boulderId}`)}>
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
  const { boulder, attemptsCount, sessionsCount } = project;

  return (
    <View style={styles.projectCard}>
      <View style={styles.projectCardTop}>
        <GradeCircle label={boulder.grade.vScale} muted />
        <View style={[styles.badge, styles.badgeProject]}>
          <Text style={[styles.badgeText, styles.badgeProjectText]}>Proj.</Text>
        </View>
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

function EntryRow({ entry }: { entry: SessionEntry }) {
  const { boulder } = entry.ascent;

  return (
    <View style={styles.row}>
      <Text style={styles.rowTime}>{formatClockTime(entry.createdAt)}</Text>
      <GradeCircle
        label={boulder.grade.vScale}
        muted={entry.status === 'PROJECT'}
      />
      <Text style={styles.rowName} numberOfLines={1}>
        {boulder.name}
      </Text>
      <EntryBadge entry={entry} />
    </View>
  );
}

// Le badge dit ce qui s'est passé CETTE fois : flash, envoi en n essais, ou
// n essais sans envoi. Les essais sont ceux du passage, pas le cumul du projet.
function EntryBadge({ entry }: { entry: SessionEntry }) {
  const tries =
    entry.attempts > 0 ? plural(entry.attempts, 'try', 'tries') : '';

  if (entry.status === 'FLASH') {
    return (
      <View style={[styles.badge, styles.badgeFlash]}>
        <Text style={[styles.badgeText, styles.badgeFlashText]}>Flash</Text>
      </View>
    );
  }

  if (entry.status === 'SENT') {
    return (
      <View style={[styles.badge, styles.badgeSent]}>
        <Text style={[styles.badgeText, styles.badgeSentText]}>
          {tries || 'Sent'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.badgeProject]}>
      <Text style={[styles.badgeText, styles.badgeProjectText]}>
        {tries ? `${tries} → Proj.` : 'Proj.'}
      </Text>
    </View>
  );
}

function GradeCircle({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <View style={[styles.gradeCircle, muted && styles.gradeCircleMuted]}>
      <Text style={[styles.gradeText, muted && styles.gradeTextMuted]}>
        {label}
      </Text>
    </View>
  );
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
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
  // ── Structure de la liste ───────────────────────────────
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
  // ── Carte de la session ─────────────────────────────────
  sessionCard: {
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.gold,
  },
  activeLabel: {
    fontFamily: typography.family.dataBold,
    fontSize: typography.size.xs,
    color: colors.sky,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // tabular-nums : chiffres à chasse fixe, sinon le chrono tremble à chaque
  // seconde (un « 1 » est plus étroit qu'un « 8 »).
  timer: {
    fontFamily: typography.family.dataBold,
    fontSize: typography.size.display + typography.size.md,
    fontVariant: ['tabular-nums'],
    color: colors.textOnInk,
  },
  startedAt: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statChip: {
    backgroundColor: colors.chipOnInk,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statChipFlash: {
    backgroundColor: colors.chipOnInkFlash,
  },
  statChipProject: {
    backgroundColor: colors.chipOnInkProject,
  },
  statChipText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.sky,
  },
  statChipTextFlash: {
    color: colors.gold,
  },
  statChipTextProject: {
    color: colors.coral,
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
  // ── Lignes des passages ─────────────────────────────────
  rowPressable: {
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    ...shadows.card,
  },
  rowTime: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    fontVariant: ['tabular-nums'],
    color: colors.textSubtle,
  },
  rowName: {
    flex: 1,
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.text,
  },
  gradeCircle: {
    width: GRADE_CIRCLE_SIZE,
    height: GRADE_CIRCLE_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  // Bloc pas (encore) envoyé : la cotation passe en retrait.
  gradeCircleMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  gradeText: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  gradeTextMuted: {
    color: colors.textMuted,
  },
  // ── Badges de statut ────────────────────────────────────
  badge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontFamily: typography.family.dataBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
  },
  badgeFlash: {
    backgroundColor: statusColors.flash.badgeBg,
  },
  badgeFlashText: {
    color: statusColors.flash.badgeText,
  },
  badgeSent: {
    backgroundColor: statusColors.ascent.badgeBg,
  },
  badgeSentText: {
    color: statusColors.ascent.badgeText,
  },
  // Projet : fond transparent et bordure en pointillés, recette du thème.
  badgeProject: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: statusColors.project.badgeBorder,
  },
  badgeProjectText: {
    color: statusColors.project.badgeText,
  },
});
