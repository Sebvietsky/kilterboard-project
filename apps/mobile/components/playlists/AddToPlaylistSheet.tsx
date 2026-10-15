import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import {
  useCreatePlaylistWithBoulder,
  useMyPlaylistsForBoulder,
  useTogglePlaylistBoulder,
} from '@/lib/playlists/queries';
import type { PlaylistForBoulder } from '@/lib/playlists/types';
import { plural } from '@/lib/format/plural';
import { colors, radii, spacing, typography } from '@/constants/theme';

const ICON_SIZE = spacing.xl - spacing.xs;

/**
 * Feuille « Add to playlist » du détail d'un bloc.
 *
 * Chaque playlist est une bascule : un tap ajoute le bloc, un second le
 * retire. La coche EST la confirmation — pas de toast ici, il serait rendu
 * sous la feuille (un Modal natif passe au-dessus de toute l'app, ToastHost
 * compris).
 *
 * Le bloc est rangé à l'inclinaison affichée par l'écran : le même bloc à une
 * autre inclinaison est une autre entrée, et les coches ne valent que pour
 * celle-ci. Le sous-titre le dit, sans quoi rien ne l'indique dans la feuille.
 *
 * `pageSheet` : la feuille native d'iOS, qui se ferme d'un geste vers le bas.
 * Sur Android, `onRequestClose` répond au bouton retour.
 */
export function AddToPlaylistSheet({
  boulderId,
  angleDegrees,
  visible,
  onClose,
}: {
  boulderId: number;
  angleDegrees: number;
  visible: boolean;
  onClose: () => void;
}) {
  const playlists = useMyPlaylistsForBoulder(boulderId, angleDegrees, visible);
  const toggle = useTogglePlaylistBoulder();
  const create = useCreatePlaylistWithBoulder();
  const [name, setName] = useState('');

  const trimmedName = name.trim();
  const error = toggle.error ?? create.error;

  function createPlaylist() {
    if (!trimmedName || create.isPending) return;
    create.mutate(
      { name: trimmedName, boulderId, angleDegrees },
      { onSuccess: () => setName('') },
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Add to playlist</Text>
            <Text style={styles.subtitle}>At {angleDegrees}°</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={spacing.md}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.createRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="New playlist"
            placeholderTextColor={colors.textSubtle}
            returnKeyType="done"
            onSubmitEditing={createPlaylist}
            maxLength={100}
            style={styles.input}
          />
          <Pressable
            onPress={createPlaylist}
            disabled={!trimmedName || create.isPending}
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.createButtonPressed,
              (!trimmedName || create.isPending) && styles.createButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.createText,
                (!trimmedName || create.isPending) && styles.createTextDisabled,
              ]}
            >
              Create
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error.message}</Text> : null}

        {playlists.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : playlists.isError ? (
          <View style={styles.centered}>
            <Text style={styles.stateText}>
              Couldn&apos;t load your playlists
            </Text>
            <Pressable onPress={() => playlists.refetch()} hitSlop={spacing.sm}>
              <Text style={styles.done}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={playlists.data}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <PlaylistRow
                playlist={item}
                // Seule la ligne en cours de bascule est figée : les autres
                // restent utilisables pendant l'appel.
                pending={
                  toggle.isPending && toggle.variables?.playlistId === item.id
                }
                onPress={() =>
                  toggle.mutate({
                    playlistId: item.id,
                    boulderId,
                    angleDegrees,
                    contains: item.containsBoulder,
                  })
                }
              />
            )}
            ListEmptyComponent={
              <Text style={styles.stateText}>
                No playlists yet. Create your first one above.
              </Text>
            }
          />
        )}
      </View>
    </Modal>
  );
}

function PlaylistRow({
  playlist,
  pending,
  onPress,
}: {
  playlist: PlaylistForBoulder;
  pending: boolean;
  onPress: () => void;
}) {
  const { containsBoulder } = playlist;

  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: containsBoulder, busy: pending }}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        pending && styles.rowPending,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={styles.rowMeta}>
          {plural(playlist.boulderCount, 'boulder')}
        </Text>
      </View>
      <View style={[styles.check, containsBoulder && styles.checkOn]}>
        {containsBoulder ? (
          <Check size={ICON_SIZE} color={colors.textOnPrimary} />
        ) : (
          <Plus size={ICON_SIZE} color={colors.textMuted} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  headerText: {
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  subtitle: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  done: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.text,
  },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  createButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  createButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  createText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
  createTextDisabled: {
    color: colors.textSubtle,
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stateText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowPending: {
    opacity: 0.5,
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
  check: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  checkOn: {
    backgroundColor: colors.primary,
  },
});
