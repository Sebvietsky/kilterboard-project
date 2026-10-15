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
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { EditPlaylistSheet } from '@/components/playlists/EditPlaylistSheet';
import {
  useDeletePlaylist,
  usePlaylist,
  useTogglePlaylistBoulder,
} from '@/lib/playlists/queries';
import type { PlaylistDetail } from '@/lib/playlists/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { boulderHref } from '@/lib/boulders/href';
import { ApiError } from '@/lib/api/errors';
import { plural } from '@/lib/format/plural';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';

const ICON_SIZE = spacing.xl - spacing.xs;

type PlaylistItem = PlaylistDetail['boulders'][number];

export default function PlaylistDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlistId = Number(id);
  const playlist = usePlaylist(playlistId); // hook appelé inconditionnellement
  const removeBoulder = useTogglePlaylistBoulder();
  const deletePlaylist = useDeletePlaylist();
  // Compteur et non booléen : il sert aussi de `key` à la feuille d'édition,
  // qui repart ainsi des valeurs enregistrées à chaque ouverture.
  const [editOpenCount, setEditOpenCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  // id invalide, 404, ou 403 (playlist privée d'un autre) -> même écran « not
  // found » : dans les trois cas il n'y a rien à montrer à cet utilisateur.
  const isMissing =
    !Number.isFinite(playlistId) ||
    (playlist.error instanceof ApiError &&
      (playlist.error.status === 404 || playlist.error.status === 403));

  if (isMissing) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Playlist not found</Text>
      </View>
    );
  }

  if (playlist.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (playlist.isError || !playlist.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Couldn&apos;t load this playlist</Text>
        <Pressable
          onPress={() => playlist.refetch()}
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

  const data = playlist.data;
  // Une playlist publique peut être ouverte par quelqu'un d'autre : retirer un
  // bloc ou supprimer la playlist ne s'offre qu'à son propriétaire. Le serveur
  // le vérifie aussi ; ici on évite seulement d'afficher un bouton voué au 403.
  const isOwner = user?.id === data.userId;
  const actionError = removeBoulder.error ?? deletePlaylist.error;

  const confirmRemove = (item: PlaylistItem) => {
    Alert.alert('Remove from playlist?', item.boulder.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeBoulder.mutate({
            playlistId,
            boulderId: item.boulder.id,
            angleDegrees: item.boulder.angleDegrees,
            contains: true,
          }),
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete playlist?',
      'The boulders stay in the app, only the playlist is deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deletePlaylist.mutate(playlistId, {
              onSuccess: () => router.back(),
            }),
        },
      ],
    );
  };

  return (
    <>
      <FlatList
        style={styles.screen}
        data={data.boulders}
        // Le bloc seul ne suffit plus comme clé : il peut figurer deux fois,
        // à deux inclinaisons. La clé reprend celle de l'entrée en base.
        keyExtractor={(item) =>
          `${item.boulder.id}-${item.boulder.angleDegrees}`
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(
                boulderHref(item.boulder.id, item.boulder.angleDegrees),
              )
            }
          >
            <BoulderRow
              item={item}
              onRemove={isOwner ? () => confirmRemove(item) : undefined}
            />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={playlist.isRefetching}
            onRefresh={playlist.refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{data.name}</Text>
              {!data.isPublic && (
                <View style={styles.privateBadge}>
                  <Text style={styles.privateText}>Private</Text>
                </View>
              )}
              {isOwner ? (
                <Pressable
                  onPress={() => {
                    setEditOpenCount((count) => count + 1);
                    setEditOpen(true);
                  }}
                  hitSlop={spacing.md}
                  style={styles.editButton}
                >
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.meta}>
              {plural(data.boulderCount, 'boulder')} · by {data.creatorUsername}
            </Text>
            {data.description ? (
              <Text style={styles.description}>{data.description}</Text>
            ) : null}
            {actionError ? (
              <Text style={styles.errorText}>{actionError.message}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyList}>
            No boulders yet. Open a boulder and tap “Add to playlist”.
          </Text>
        }
        ListFooterComponent={
          isOwner ? (
            <Pressable
              onPress={confirmDelete}
              disabled={deletePlaylist.isPending}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
                deletePlaylist.isPending && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.deleteText}>Delete playlist</Text>
            </Pressable>
          ) : null
        }
      />
      <EditPlaylistSheet
        key={editOpenCount}
        playlist={data}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}

function BoulderRow({
  item,
  onRemove,
}: {
  item: PlaylistItem;
  onRemove?: () => void;
}) {
  const { boulder } = item;

  return (
    <View style={styles.row}>
      {/* Cotation à l'inclinaison de l'entrée : non cotée, la ligne le dit
          plutôt que d'afficher celle du créateur. */}
      {boulder.vScale !== null ? (
        <View style={styles.gradeBadge}>
          <Text style={styles.gradeText}>{boulder.vScale}</Text>
        </View>
      ) : (
        <View style={styles.ungradedBadge}>
          <Text style={styles.ungradedText}>Not graded</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {boulder.name}
        </Text>
        <Text style={styles.rowMeta}>{boulder.angleDegrees}°</Text>
      </View>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${boulder.name} from playlist`}
        >
          <X size={ICON_SIZE} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
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
  header: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flexShrink: 1,
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    letterSpacing: typography.size.xxl * typography.letterSpacing.tight,
    color: colors.text,
  },
  // marginLeft auto : pousse « Edit » au bord droit, quel que soit le nombre
  // d'éléments avant lui (titre seul, ou titre et badge Private).
  editButton: {
    marginLeft: 'auto',
  },
  editText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  meta: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  description: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    color: colors.textSubtle,
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.danger,
  },
  emptyList: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  // Badge neutre, comme dans Library : « privé » est un état, pas une alerte.
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    ...shadows.card,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowName: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
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
  // Contour et non aplat : destructif, mais relégué en bas de liste.
  deleteButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
  deleteText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
