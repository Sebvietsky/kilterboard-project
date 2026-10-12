import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useUpdatePlaylist } from '@/lib/playlists/queries';
import type { PlaylistSummary } from '@/lib/playlists/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

/**
 * Feuille d'édition d'une playlist : nom, description, visibilité.
 *
 * Le formulaire travaille sur une copie locale et n'écrit qu'au Save : fermer
 * la feuille annule. Le parent la monte avec une `key` liée à l'ouverture,
 * pour que chaque ouverture reparte des valeurs enregistrées.
 */
export function EditPlaylistSheet({
  playlist,
  visible,
  onClose,
}: {
  playlist: PlaylistSummary;
  visible: boolean;
  onClose: () => void;
}) {
  const update = useUpdatePlaylist();
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? '');
  const [isPublic, setIsPublic] = useState(playlist.isPublic);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !update.isPending;

  function save() {
    if (!canSave) return;
    update.mutate(
      {
        playlistId: playlist.id,
        name: trimmedName,
        // Chaîne vide -> null : « pas de description » n'a qu'une seule
        // représentation en base.
        description: description.trim() || null,
        isPublic,
      },
      { onSuccess: onClose },
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
          <Pressable onPress={onClose} hitSlop={spacing.md}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Edit playlist</Text>
          <Pressable onPress={save} disabled={!canSave} hitSlop={spacing.md}>
            <Text style={[styles.save, !canSave && styles.saveDisabled]}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={100}
            returnKeyType="done"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            placeholderTextColor={colors.textSubtle}
            multiline
            style={[styles.input, styles.inputMultiline]}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Public</Text>
            <Text style={styles.switchHint}>
              {isPublic
                ? 'Anyone can open this playlist.'
                : 'Only you can see this playlist.'}
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        {update.isError ? (
          <Text style={styles.errorText}>{update.error.message}</Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  cancel: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  save: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.primary,
  },
  saveDisabled: {
    color: colors.textSubtle,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  input: {
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
  inputMultiline: {
    minHeight: spacing.xxxl * 2,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  switchText: {
    flex: 1,
    gap: spacing.xs,
  },
  switchLabel: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.text,
  },
  switchHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.danger,
  },
});
