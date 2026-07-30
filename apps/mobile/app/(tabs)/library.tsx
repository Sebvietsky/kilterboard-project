import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useMyProjects } from '@/lib/ascents/queries';
import { useMyPlaylists } from '@/lib/playlists/queries';
import type { MyProject } from '@/lib/ascents/types';
import type { PlaylistSummary } from '@/lib/playlists/types';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';

type Segment = 'projects' | 'playlists';

// Liked ne figure pas ici : aucun concept de favori n'existe côté backend
// (AscentNoteLike porte sur un COMMENTAIRE, pas sur un bloc). Un troisième
// segment vide ou désactivé se lirait comme une panne — on l'ajoutera avec la
// fonctionnalité, pas avant.
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'projects', label: 'Projects' },
  { value: 'playlists', label: 'Playlists' },
];

export default function LibraryScreen() {
  const [segment, setSegment] = useState<Segment>('projects');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <SegmentedControl
          options={SEGMENTS}
          value={segment}
          onChange={setSegment}
        />
      </View>

      {/* Rendu conditionnel et non deux listes masquées : le composant
          démonté, sa query ne s'abonne plus. Deux listes montées lanceraient
          deux requêtes et les garderaient fraîches pour rien. */}
      {segment === 'projects' ? <ProjectsList /> : <PlaylistsList />}
    </View>
  );
}

function ProjectsList() {
  const router = useRouter();
  const projects = useMyProjects();

  return (
    <ListState
      query={projects}
      emptyLabel="No projects yet."
      emptyHint="Log a boulder as a project to track it here."
    >
      <FlatList
        data={projects.data}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          // boulderId et non boulder.id : la réponse n'expose pas l'id du
          // bloc dans la relation imbriquée, seulement au niveau de
          // l'ascension.
          <Pressable onPress={() => router.push(`/boulder/${item.boulderId}`)}>
            <ProjectCard project={item} />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={projects.isRefetching}
            onRefresh={projects.refetch}
            tintColor={colors.primary}
          />
        }
      />
    </ListState>
  );
}

function PlaylistsList() {
  const playlists = useMyPlaylists();

  return (
    <ListState
      query={playlists}
      emptyLabel="No playlists yet."
      emptyHint="Playlists you create will show up here."
    >
      <FlatList
        data={playlists.data}
        keyExtractor={(item) => String(item.id)}
        // Pas de Pressable : l'écran de détail n'existe pas encore. Une ligne
        // qui s'enfonce sous le doigt sans rien ouvrir se lit comme un bug ;
        // inerte, elle se lit comme une information.
        renderItem={({ item }) => <PlaylistRow playlist={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={playlists.isRefetching}
            onRefresh={playlists.refetch}
            tintColor={colors.primary}
          />
        }
      />
    </ListState>
  );
}

/**
 * Chargement / erreur / vide, mutualisés entre les deux listes.
 *
 * Le type d'entrée est structurel plutôt qu'un UseQueryResult<T> : les deux
 * queries portent des données différentes, et seuls ces quatre champs
 * intéressent l'affichage d'état.
 */
function ListState({
  query,
  emptyLabel,
  emptyHint,
  children,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    data?: unknown[];
    refetch: () => void;
  };
  emptyLabel: string;
  emptyHint: string;
  children: React.ReactNode;
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
        <Text style={styles.stateTitle}>Couldn&apos;t load this list</Text>
        <Pressable
          onPress={() => query.refetch()}
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

  // L'état vide est rendu ici plutôt qu'en ListEmptyComponent : il occupe la
  // hauteur restante et se centre, ce qu'une FlatList vide ne fait pas sans
  // contentContainerStyle dédié.
  if (!query.data?.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>{emptyLabel}</Text>
        <Text style={styles.stateHint}>{emptyHint}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

// Carte distincte de celle d'Explore, et pas par commodité : /users/me/projects
// ne renvoie ni ascentCount, ni averageRating, ni creatorUsername. Surtout, un
// projet ne parle pas de la communauté mais de TES essais.
function ProjectCard({ project }: { project: MyProject }) {
  const { boulder, attemptsCount } = project;

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
        <Text style={styles.metaData}>{boulder.angle.valueDegrees}°</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaData}>
          {attemptsCount} {attemptsCount === 1 ? 'attempt' : 'attempts'}
        </Text>
      </View>
    </View>
  );
}

function PlaylistRow({ playlist }: { playlist: PlaylistSummary }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {playlist.name}
        </Text>
        {!playlist.isPublic && (
          <View style={styles.privateBadge}>
            <Text style={styles.privateText}>Private</Text>
          </View>
        )}
      </View>

      <Text style={styles.metaData}>
        {playlist.boulderCount}{' '}
        {playlist.boulderCount === 1 ? 'boulder' : 'boulders'}
      </Text>

      {playlist.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {playlist.description}
        </Text>
      ) : null}
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
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.family.display,
    fontSize: typography.size.display,
    letterSpacing: typography.size.display * typography.letterSpacing.tight,
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
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
  // L'état vide explique quoi faire : un écran qui dit seulement « rien ici »
  // laisse l'utilisateur sans porte de sortie.
  stateHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
    textAlign: 'center',
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
  description: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    color: colors.textSubtle,
  },
  // Badge neutre : « privé » est un état, pas une alerte — surfaceMuted plutôt
  // qu'une couleur de statut, qui suggérerait une action à mener.
  privateBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  privateText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
});
