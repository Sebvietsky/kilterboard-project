import { Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFiltersStore } from '@/lib/filters/useFiltersStore';
import { gradeLabel, tagLabel } from '@/lib/filters/const';
import { colors, spacing, typography, radii } from '@/constants/theme';

// Récap des filtres actifs, sous la barre de recherche d'Explore.
// Le composant lit et écrit le store directement : il n'existe que pour lui,
// le faire piloter par des props ne ferait que déplacer la même connaissance
// dans l'écran appelant.
// La recherche par nom n'y figure pas — elle est déjà visible dans son champ.
export function ActiveFilters() {
  const creator = useFiltersStore((s) => s.creator);
  const angle = useFiltersStore((s) => s.angle);
  const gradeMin = useFiltersStore((s) => s.gradeMin);
  const gradeMax = useFiltersStore((s) => s.gradeMax);
  const tags = useFiltersStore((s) => s.tags);
  const setFilters = useFiltersStore((s) => s.setFilters);
  const reset = useFiltersStore((s) => s.reset);

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (creator) {
    chips.push({
      key: 'creator',
      label: `by ${creator}`,
      onRemove: () => setFilters({ creator: undefined }),
    });
  }

  if (angle !== undefined) {
    chips.push({
      key: 'angle',
      label: `${angle}°`,
      onRemove: () => setFilters({ angle: undefined }),
    });
  }

  // gradeMin et gradeMax sont posés ensemble par l'écran de filtres (et effacés
  // ensemble quand la plage couvre tout) : une seule chip pour les deux.
  if (gradeMin !== undefined && gradeMax !== undefined) {
    chips.push({
      key: 'grade',
      label:
        gradeMin === gradeMax
          ? gradeLabel(gradeMin)
          : `${gradeLabel(gradeMin)} — ${gradeLabel(gradeMax)}`,
      onRemove: () => setFilters({ gradeMin: undefined, gradeMax: undefined }),
    });
  }

  for (const slug of tags) {
    chips.push({
      key: `tag-${slug}`,
      label: tagLabel(slug),
      onRemove: () => setFilters({ tags: tags.filter((t) => t !== slug) }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={chip.onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove filter ${chip.label}`}
          style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
        >
          <Text style={styles.chipText}>{chip.label}</Text>
          <Text style={styles.chipRemove}>×</Text>
        </Pressable>
      ))}

      {chips.length > 1 && (
        <Pressable
          onPress={reset}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.clearAll,
            pressed && styles.chipPressed,
          ]}
        >
          <Text style={styles.clearAllText}>Clear all</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow: 0 — sans ça, un ScrollView horizontal dans un conteneur en colonne
  // s'étire pour occuper l'espace restant et pousse la liste hors de l'écran.
  scroll: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.full,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipPressed: {
    opacity: 0.6,
  },
  chipText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  // Le × est agrandi pour rester une cible confortable sans gonfler la chip.
  chipRemove: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    lineHeight: typography.size.md,
    color: colors.primary,
  },
  clearAll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  clearAllText: {
    fontFamily: typography.family.bodyMedium,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
