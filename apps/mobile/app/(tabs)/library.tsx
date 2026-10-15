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
import { Plus } from 'lucide-react-native';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PlaylistFormSheet } from '@/components/playlists/PlaylistFormSheet';
import { useMyProjects } from '@/lib/ascents/queries';
import { useMyPlaylists } from '@/lib/playlists/queries';
import { useMyLikedBoulders } from '@/lib/boulders/queries';
import { boulderHref } from '@/lib/boulders/href';
import type { MyProject } from '@/lib/ascents/types';
import type { PlaylistSummary } from '@/lib/playlists/types';
import type { BoulderLiked } from '@/lib/boulders/types';
import { colors, spacing, typography, radii, shadows } from '@/constants/theme';

type Segment = 'projects' | 'playlists' | 'liked';

// Bouton de création : rond de 56 pt, la taille d'usage d'un bouton flottant.
const FAB_SIZE = spacing.xxxl + spacing.sm;
const FAB_ICON_SIZE = spacing.xl + spacing.xs;

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'projects', label: 'Projects' },
  { value: 'liked', label: 'Liked' },
  { value: 'playlists', label: 'Playlists' },
];

// Un Record plutôt qu'une chaîne de ternaires : ajouter un segment au type
// sans sa liste devient une erreur de compilation.
const SEGMENT_LISTS: Record<Segment, () => React.JSX.Element> = {
  projects: ProjectsList,
  playlists: PlaylistsList,
  liked: LikedList,
};

export default function LibraryScreen() {
  const [segment, setSegment] = useState<Segment>('projects');
  const List = SEGMENT_LISTS[segment];

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

      {/* Une seule liste montée, et non toutes masquées sauf une : le
          composant démonté, sa query ne s'abonne plus. Des listes montées en
          parallèle lanceraient chacune sa requête et la garderaient fraîche
          pour rien. */}
      <List />
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
          <Pressable
            onPress={() =>
              router.push(boulderHref(item.boulderId, item.angle.valueDegrees))
            }
          >
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
  const router = useRouter();
  const playlists = useMyPlaylists();
  // Compteur et non booléen : il sert aussi de `key` à la feuille, qui repart
  // ainsi d'un formulaire vide à chaque ouverture.
  const [createOpenCount, setCreateOpenCount] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <View style={styles.fill}>
      <ListState
        query={playlists}
        emptyLabel="No playlists yet."
        emptyHint="Tap + to create your first playlist."
      >
        <FlatList
          data={playlists.data}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/playlist/${item.id}`)}>
              <PlaylistRow playlist={item} />
            </Pressable>
          )}
          contentContainerStyle={[styles.listContent, styles.listContentFab]}
          refreshControl={
            <RefreshControl
              refreshing={playlists.isRefetching}
              onRefresh={playlists.refetch}
              tintColor={colors.primary}
            />
          }
        />
      </ListState>

      {/* Hors de ListState : le bouton reste là quand la liste est vide,
          c'est même là qu'il sert le plus. */}
      <Pressable
        onPress={() => {
          setCreateOpenCount((count) => count + 1);
          setCreateOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="New playlist"
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Plus size={FAB_ICON_SIZE} color={colors.textOnPrimary} />
      </Pressable>

      <PlaylistFormSheet
        key={createOpenCount}
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </View>
  );
}

function LikedList() {
  const router = useRouter();
  const liked = useMyLikedBoulders();

  return (
    <ListState
      query={liked}
      emptyLabel="No liked boulders yet."
      emptyHint="Tap the heart on a boulder to save it here."
    >
      <FlatList
        data={liked.data}
        // Le même bloc peut être liké à deux inclinaisons : la clé reprend
        // celle du like en base, et la carte rouvre le bloc à son inclinaison.
        keyExtractor={(item) => `${item.id}-${item.angleDegrees}`}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(boulderHref(item.id, item.angleDegrees))}
          >
            <LikedCard boulder={item} />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={liked.isRefetching}
            onRefresh={liked.refetch}
            tintColor={colors.primary}
          />
        }
      />
    </ListState>
  );
}

/**
 * Chargement / erreur / vide, mutualisés entre les listes.
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
        <Text style={styles.metaData}>{project.angle.valueDegrees}°</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaData}>
          {attemptsCount} {attemptsCount === 1 ? 'attempt' : 'attempts'}
        </Text>
      </View>
    </View>
  );
}

// Même recette que ProjectCard, sans le compteur d'essais : un favori dit
// seulement « ce bloc m'intéresse ». La cotation est celle de l'inclinaison
// du like ; non cotée, la carte le dit plutôt que d'afficher celle du créateur.
function LikedCard({ boulder }: { boulder: BoulderLiked }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {boulder.name}
        </Text>
        {boulder.gradeLabel !== null ? (
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeText}>{boulder.gradeLabel}</Text>
          </View>
        ) : (
          <View style={styles.ungradedBadge}>
            <Text style={styles.ungradedText}>Not graded</Text>
          </View>
        )}
      </View>

      <Text style={styles.metaData}>{boulder.angleDegrees}°</Text>
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
  fill: {
    flex: 1,
  },
  // Place pour le bouton flottant : la dernière carte doit pouvoir remonter
  // au-dessus de lui, sinon il en masque le bas.
  listContentFab: {
    paddingBottom: FAB_SIZE + spacing.xxl,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  fabPressed: {
    backgroundColor: colors.primaryPressed,
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
  // Neutre, comme « Not graded yet » du détail : une absence d'information,
  // pas une alerte.
  ungradedBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ungradedText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.textSubtle,
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
